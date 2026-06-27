import * as admin from 'firebase-admin';
import { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions } from 'firebase-functions/v2';

setGlobalOptions({ region: 'southamerica-east1' });

admin.initializeApp();

const db        = admin.firestore();
const messaging = admin.messaging();

// ── Tipos ──────────────────────────────────────────────────────────────────────

type OSStatus =
  | 'nova'
  | 'em_andamento'
  | 'em_diagnostico'
  | 'orcamento_aprovado'
  | 'concluida';

type TipoServico = 'preventiva' | 'corretiva';
interface ServicoRealizadoMetricas { tipo?: TipoServico; valor?: number }

/**
 * Conta serviços preventivos e corretivos de uma OS.
 * Prioriza servicosRealizados; usa gastoPreventiva/gastoCorretiva como fallback
 * para OS antigas ou que ainda não têm serviços registrados.
 */
function calcularCountsPrevCorr(os: FirebaseFirestore.DocumentData): {
  preventiva: number;
  corretiva:  number;
} {
  const servicos: ServicoRealizadoMetricas[] = Array.isArray(os.servicosRealizados)
    ? os.servicosRealizados
    : [];

  if (servicos.length > 0) {
    return servicos.reduce(
      (acc, s) => {
        if (s.tipo === 'preventiva') acc.preventiva += 1;
        if (s.tipo === 'corretiva')  acc.corretiva  += 1;
        return acc;
      },
      { preventiva: 0, corretiva: 0 },
    );
  }

  return {
    preventiva: Number(os.gastoPreventiva ?? 0) > 0 ? 1 : 0,
    corretiva:  Number(os.gastoCorretiva  ?? 0) > 0 ? 1 : 0,
  };
}

// ── Helpers de data (America/Sao_Paulo) ───────────────────────────────────────

/**
 * Retorna o range do mês atual em America/Sao_Paulo como Timestamps do Firestore.
 *
 * Usa toLocaleString para determinar o ano/mês correto no timezone SP,
 * depois constrói os limites com offset explícito '-03:00' para que o
 * Date seja posicionado corretamente em UTC antes de virar Timestamp.
 *
 * Exemplo (referência 2026-06-08T02:30Z = 2026-06-07T23:30 SP):
 *   mes   = "2026-06"   ← já é junho em UTC mas ainda maio às 23:30 no SP
 *   início = 2026-06-01T00:00:00-03:00 → 2026-06-01T03:00:00Z
 *   fim    = 2026-07-01T00:00:00-03:00 → 2026-07-01T03:00:00Z
 */
function getMesRangeSP(date = new Date()): {
  mes:   string;
  inicio: admin.firestore.Timestamp;
  fim:    admin.firestore.Timestamp;
} {
  // toLocaleString com en-US retorna "MM/DD/YYYY, HH:MM:SS AM/PM"
  const spStr = date.toLocaleString('en-US', {
    timeZone: 'America/Sao_Paulo',
    year:  'numeric',
    month: '2-digit',
    day:   '2-digit',
  });
  const [mm, , yyyy] = spStr.split('/');
  const year  = parseInt(yyyy, 10);
  const month = parseInt(mm,   10); // 1-indexed

  const mes = `${year}-${String(month).padStart(2, '0')}`;
  const pad = (n: number) => String(n).padStart(2, '0');

  const nextYear  = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return {
    mes,
    inicio: admin.firestore.Timestamp.fromDate(new Date(`${year}-${pad(month)}-01T00:00:00-03:00`)),
    fim:    admin.firestore.Timestamp.fromDate(new Date(`${nextYear}-${pad(nextMonth)}-01T00:00:00-03:00`)),
  };
}

/**
 * Retorna os limites do dia atual em America/Sao_Paulo como Timestamps.
 * Mesmo padrão de getMesRangeSP: determina ano/mês/dia via IANA,
 * depois constrói os limites com offset explícito '-03:00'.
 */
function getDiaRangeSP(date = new Date()): {
  inicio: admin.firestore.Timestamp;
  fim:    admin.firestore.Timestamp;
} {
  const spStr = date.toLocaleString('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const [mm, dd, yyyy] = spStr.split('/');
  const pad = (n: string | number) => String(n).padStart(2, '0');

  return {
    inicio: admin.firestore.Timestamp.fromDate(
      new Date(`${yyyy}-${pad(mm)}-${pad(dd)}T00:00:00-03:00`),
    ),
    fim: admin.firestore.Timestamp.fromDate(
      new Date(`${yyyy}-${pad(mm)}-${pad(dd)}T23:59:59.999-03:00`),
    ),
  };
}

// ── Agregação de métricas ──────────────────────────────────────────────────────

async function recalcularMetricas(): Promise<void> {
  const { mes, inicio, fim } = getMesRangeSP();

  // 1. OS ativas (todos os status menos concluída)
  const activeSnap = await db
    .collection('ordens-servico')
    .where('status', 'in', ACTIVE_STATUSES)
    .get();

  const activeOS = activeSnap.docs.map((d) => d.data());

  const osAguardando          = activeOS.filter((os) => os.status === 'nova').length;
  const osEmAndamento         = activeOS.filter((os) => os.status === 'em_andamento').length;
  const osEmDiagnostico       = activeOS.filter((os) => os.status === 'em_diagnostico').length;
  const osAguardandoAprovacao = activeOS.filter((os) => os.status === 'orcamento_aprovado').length;
  const totalOSAtivas         = activeOS.length;

  const veiculosEmOficinaSet = new Set(
    activeOS
      .filter((os) => os.entregueOficinaEm && !os.retornouOficinaEm)
      .map((os) => os.veiculoId as string | undefined)
      .filter((id): id is string => !!id),
  );

  // 2. OS do mês corrente (qualquer status) para gasto e proporção
  // criadoEm é gravado como serverTimestamp() → admin.firestore.Timestamp
  const mesSnap = await db
    .collection('ordens-servico')
    .where('criadoEm', '>=', inicio)
    .where('criadoEm', '<',  fim)
    .get();

  let gastoPreventiva = 0;
  let gastoCorretiva  = 0;
  let countPreventiva = 0;
  let countCorretiva  = 0;

  mesSnap.docs.forEach((d) => {
    const os = d.data();
    gastoPreventiva += Number(os.gastoPreventiva ?? 0);
    gastoCorretiva  += Number(os.gastoCorretiva  ?? 0);
    const counts = calcularCountsPrevCorr(os);
    countPreventiva += counts.preventiva;
    countCorretiva  += counts.corretiva;
  });

  const { inicio: diaInicio, fim: diaFim } = getDiaRangeSP();
  const osConcluidasHoje = mesSnap.docs.filter((d) => {
    const os = d.data();
    if (os.status !== 'concluida') return false;
    const ts = os.criadoEm as admin.firestore.Timestamp | undefined;
    if (!ts?.toMillis) return false;
    const ms = ts.toMillis();
    return ms >= diaInicio.toMillis() && ms <= diaFim.toMillis();
  }).length;

  await db.collection('metricas-frota').doc('geral').set({
    osAguardando,
    osEmAndamento,
    osEmDiagnostico,
    osAguardandoAprovacao,
    osConcluidasHoje,
    totalOSAtivas,
    veiculosEmOficina: veiculosEmOficinaSet.size,
    gastoMes: {
      total:      gastoPreventiva + gastoCorretiva,
      preventiva: gastoPreventiva,
      corretiva:  gastoCorretiva,
      mes,
    },
    prevVsCorr: {
      preventiva: countPreventiva,
      corretiva:  countCorretiva,
      mes,
    },
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });
}

interface TokenEntry { uid: string; token: string }

const ACTIVE_STATUSES = ['nova', 'em_andamento', 'em_diagnostico', 'orcamento_aprovado'];

// ── Mensagens por status ───────────────────────────────────────────────────────

const STATUS_MESSAGES: Record<OSStatus, { title: string; body: (osId: string) => string }> = {
  nova:               { title: 'Nova OS',            body: (id) => `OS ${id.toUpperCase()} foi aberta` },
  em_andamento:       { title: 'OS em andamento',    body: (id) => `Sua OS ${id.toUpperCase()} está sendo atendida` },
  em_diagnostico:     { title: 'OS em diagnóstico',  body: (id) => `Sua OS ${id.toUpperCase()} está em diagnóstico` },
  orcamento_aprovado: { title: 'Orçamento aprovado', body: (id) => `O orçamento da OS ${id.toUpperCase()} foi aprovado` },
  concluida:          { title: 'OS concluída',       body: (id) => `Sua OS ${id.toUpperCase()} foi concluída com sucesso` },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Erros que indicam token permanentemente inválido — deve ser removido. */
function isStaleToken(code: string | undefined): boolean {
  return (
    code === 'messaging/registration-token-not-registered' ||
    code === 'messaging/invalid-registration-token' ||
    code === 'messaging/invalid-argument'
  );
}

/** Remove o fcmToken de um usuário no Firestore (token expirado ou substituído). */
async function removeStaleToken(uid: string): Promise<void> {
  await db
    .collection('usuarios')
    .doc(uid)
    .update({ fcmToken: admin.firestore.FieldValue.delete() });
}

/**
 * Busca todos os gestores que têm fcmToken registrado.
 * Retorna pares {uid, token} para permitir limpeza de tokens stale.
 */
async function getGestorTokenEntries(): Promise<TokenEntry[]> {
  const snap = await db
    .collection('usuarios')
    .where('perfil', '==', 'gestor')
    .select('fcmToken')
    .get();

  return snap.docs
    .filter((d) => !!d.data().fcmToken)
    .map((d) => ({ uid: d.id, token: d.data().fcmToken as string }));
}

/**
 * Envia uma mensagem multicast em lotes de 500 (limite do FCM).
 * Remove automaticamente tokens inválidos do Firestore após cada lote.
 */
async function sendMulticast(
  entries: TokenEntry[],
  message: Omit<admin.messaging.MulticastMessage, 'tokens'>,
): Promise<void> {
  const BATCH = 500;

  for (let i = 0; i < entries.length; i += BATCH) {
    const chunk = entries.slice(i, i + BATCH);

    const response = await messaging.sendEachForMulticast({
      ...message,
      tokens: chunk.map((e) => e.token),
    });

    // Coletar UIDs cujos tokens retornaram erro permanente
    const stale: string[] = [];
    response.responses.forEach((r, idx) => {
      if (!r.success && isStaleToken(r.error?.code)) {
        stale.push(chunk[idx].uid);
      }
    });

    if (stale.length > 0) {
      const batch = db.batch();
      stale.forEach((uid) =>
        batch.update(db.collection('usuarios').doc(uid), {
          fcmToken: admin.firestore.FieldValue.delete(),
        }),
      );
      await batch.commit();
    }
  }
}

// ── Trigger 1: OS criada → notifica gestores ───────────────────────────────────

export const onOSCreated = onDocumentCreated(
  { document: 'ordens-servico/{id}', minInstances: 1 },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    await db.collection('metricas-frota').doc('geral').set(
      {
        osAguardando:  admin.firestore.FieldValue.increment(1),
        totalOSAtivas: admin.firestore.FieldValue.increment(1),
      },
      { merge: true },
    );

    const osId         = event.params.id;
    const condutorNome = (data.condutorNome as string) ?? 'Condutor';
    const placa        = (data.placa as string) ?? '';

    const entries = await getGestorTokenEntries();
    if (entries.length === 0) return;

    const title = 'Nova OS aguardando análise';
    const body  = `Aberta por ${condutorNome} · ${placa}`;

    await sendMulticast(entries, {
      notification: { title, body },
      data:    { osId },
      android: {
        priority: 'high',
        notification: { channelId: 'os-updates', sound: 'default' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    });

    // Persiste histórico para cada gestor destinatário
    const batch = db.batch();
    entries.forEach(({ uid }) => {
      const ref = db.collection('notificacoes').doc();
      batch.set(ref, {
        userId: uid,
        type: 'os_criada',
        title,
        body,
        osId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 90 * 24 * 60 * 60 * 1000),
        read: false,
      });
    });
    await batch.commit();
  },
);

// ── Trigger 2: Status atualizado → notifica condutor ──────────────────────────

export const onOSStatusUpdated = onDocumentUpdated(
  { document: 'ordens-servico/{id}' },
  async (event) => {
    const before = event.data?.before.data();
    const after  = event.data?.after.data();
    if (!before || !after) return;

    if (before.status === after.status) return;

    const osId       = event.params.id;
    const newStatus  = after.status as OSStatus;
    const condutorId = after.condutorId as string | undefined;

    const msg = STATUS_MESSAGES[newStatus];
    if (!msg) return;

    // OS administrativa (aberta pelo gestor sem condutor) não tem ninguém a notificar.
    if (!condutorId) return;

    const condutorDoc = await db.collection('usuarios').doc(condutorId).get();
    const token = condutorDoc.data()?.fcmToken as string | undefined;

    const title = msg.title;
    const body  = msg.body(osId);

    if (token) {
      try {
        await messaging.send({
          token,
          notification: { title, body },
          data:    { osId },
          android: {
            priority: 'high',
            notification: { channelId: 'os-updates', sound: 'default' },
          },
          apns: {
            payload: { aps: { sound: 'default', badge: 1 } },
          },
        });
      } catch (err: any) {
        if (isStaleToken(err?.errorInfo?.code)) {
          await removeStaleToken(condutorId);
        }
      }
    }

    // Persiste histórico independentemente de token ou sucesso do push
    await db.collection('notificacoes').add({
      userId: condutorId,
      type: 'status_atualizado',
      title,
      body,
      osId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 90 * 24 * 60 * 60 * 1000),
      read: false,
    });
  },
);

// ── Trigger 3: Vínculo criado → notifica condutor ─────────────────────────────

export const onVinculoCriado = onDocumentCreated(
  { document: 'vinculos/{id}' },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const condutorId   = data.condutorId   as string;
    const veiculoMarca = data.veiculoMarca  as string;
    const veiculoModelo= data.veiculoModelo as string;
    const veiculoFrota = data.veiculoFrota  as string;

    const condutorDoc = await db.collection('usuarios').doc(condutorId).get();
    const token = condutorDoc.data()?.fcmToken as string | undefined;
    if (!token) return;

    const title = 'Veículo vinculado';
    const body  = `${veiculoMarca} ${veiculoModelo} (Frota ${veiculoFrota}) foi vinculado a você. Faça o checklist de entrada para começar.`;

    try {
      await messaging.send({
        token,
        notification: { title, body },
        android: {
          priority: 'high',
          notification: { channelId: 'os-updates', sound: 'default' },
        },
        apns: {
          payload: { aps: { sound: 'default', badge: 1 } },
        },
      });
    } catch (err: any) {
      if (isStaleToken(err?.errorInfo?.code)) {
        await removeStaleToken(condutorId);
      }
    }
  },
);

// ── Trigger 4: Condutor entregou veículo na oficina → notifica gestor ────────

export const onOSEntregueOficina = onDocumentUpdated(
  { document: 'ordens-servico/{id}' },
  async (event) => {
    const before = event.data?.before.data();
    const after  = event.data?.after.data();
    if (!before || !after) return;

    if (before.entregueOficinaEm || !after.entregueOficinaEm) return;

    const osId        = event.params.id;
    const condutorNome  = (after.condutorNome as string) ?? 'Condutor';
    const veiculo       = (after.veiculoModelo as string | undefined) || (after.placa as string | undefined) || `Frota ${after.frota as string}`;
    const gestorId      = (after.gestorId    as string | undefined);

    const title = 'Veículo entregue na oficina';
    const body  = `${condutorNome} entregou o veículo ${veiculo} na oficina`;

    if (gestorId) {
      const gestorDoc = await db.collection('usuarios').doc(gestorId).get();
      const token = gestorDoc.data()?.fcmToken as string | undefined;

      if (token) {
        try {
          await messaging.send({
            token,
            notification: { title, body },
            data:    { osId },
            android: {
              priority: 'high',
              notification: { channelId: 'os-updates', sound: 'default' },
            },
            apns: { payload: { aps: { sound: 'default', badge: 1 } } },
          });
        } catch (err: any) {
          if (isStaleToken(err?.errorInfo?.code)) {
            await removeStaleToken(gestorId);
          }
        }
      }

      await db.collection('notificacoes').add({
        userId: gestorId,
        type: 'entregue_oficina',
        title,
        body,
        osId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 90 * 24 * 60 * 60 * 1000),
        read: false,
      });
    } else {
      const entries = await getGestorTokenEntries();

      if (entries.length > 0) {
        await sendMulticast(entries, {
          notification: { title, body },
          data:    { osId },
          android: {
            priority: 'high',
            notification: { channelId: 'os-updates', sound: 'default' },
          },
          apns: { payload: { aps: { sound: 'default', badge: 1 } } },
        });
      }

      const batch = db.batch();
      entries.forEach(({ uid }) => {
        const ref = db.collection('notificacoes').doc();
        batch.set(ref, {
          userId: uid,
          type: 'entregue_oficina',
          title,
          body,
          osId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 90 * 24 * 60 * 60 * 1000),
          read: false,
        });
      });
      if (entries.length > 0) await batch.commit();
    }
  },
);

// ── Trigger 4: Usuário deletado → remove conta Firebase Auth ─────────────────

export const onUsuarioDeleted = onDocumentDeleted(
  { document: 'usuarios/{uid}' },
  async (event) => {
    const uid = event.params.uid;
    try {
      await admin.auth().deleteUser(uid);
    } catch (err: unknown) {
      const code = (err as { errorInfo?: { code?: string } })?.errorInfo?.code;
      if (code !== 'auth/user-not-found') throw err;
    }
  },
);

// ── Trigger 5: Lembretes diários de OS agendadas ──────────────────────────────

export const enviarLembretesOS = onSchedule(
  { schedule: 'every day 07:00', timeZone: 'America/Sao_Paulo' },
  async () => {
    const { inicio, fim } = getDiaRangeSP();

    // Query server-side: apenas OS ativas, agendadas para hoje e ainda não notificadas.
    // Requer índice composto: status + lembreteEnviado + dataDesejada (firestore.indexes.json).
    const snap = await db
      .collection('ordens-servico')
      .where('status',           'in', ACTIVE_STATUSES)
      .where('lembreteEnviado',  '==', false)
      .where('dataDesejada',     '>=', inicio)
      .where('dataDesejada',     '<=', fim)
      .get();

    await Promise.all(
      snap.docs.map(async (d) => {
        const os = d.data();
        const title = 'Lembrete de OS agendada';
        const body  = `Sua OS do veículo ${os.placa} está marcada para hoje. Não se esqueça de levar à oficina!`;

        const condutorDoc = await db.collection('usuarios').doc(os.condutorId).get();
        const token = condutorDoc.data()?.fcmToken as string | undefined;

        if (token) {
          try {
            await messaging.send({
              token,
              notification: { title, body },
              data: { osId: d.id },
              android: {
                priority: 'high',
                notification: { channelId: 'os-updates', sound: 'default' },
              },
              apns: { payload: { aps: { sound: 'default', badge: 1 } } },
            });
          } catch (err: any) {
            if (isStaleToken(err?.errorInfo?.code)) {
              await removeStaleToken(os.condutorId);
            }
          }
        }

        const batch = db.batch();

        const notifRef = db.collection('notificacoes').doc();
        batch.set(notifRef, {
          userId: os.condutorId,
          type: 'lembrete_os',
          title,
          body,
          osId: d.id,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: admin.firestore.Timestamp.fromMillis(
            Date.now() + 90 * 24 * 60 * 60 * 1000
          ),
          read: false,
        });

        batch.update(d.ref, {
          lembreteEnviado:   true,
          lembreteEnviadoEm: admin.firestore.FieldValue.serverTimestamp(),
        });

        await batch.commit();
      }),
    );
  },
);

// ── Trigger: gasto ou entrega/retorno de oficina atualizado → recalcula ────────

export const onOSGastoOuOficinaUpdated = onDocumentUpdated(
  { document: 'ordens-servico/{id}' },
  async (event) => {
    const before = event.data?.before.data();
    const after  = event.data?.after.data();
    if (!before || !after) return;

    const inc: Record<string, admin.firestore.FieldValue> = {};

    // STATUS → contadores por status + totalOSAtivas
    if (before.status !== after.status) {
      const STATUS_FIELD: Record<string, string> = {
        nova:               'osAguardando',
        em_andamento:       'osEmAndamento',
        em_diagnostico:     'osEmDiagnostico',
        orcamento_aprovado: 'osAguardandoAprovacao',
      };

      const fieldBefore = STATUS_FIELD[before.status];
      const fieldAfter  = STATUS_FIELD[after.status];

      if (fieldBefore) inc[fieldBefore] = admin.firestore.FieldValue.increment(-1);
      if (fieldAfter)  inc[fieldAfter]  = admin.firestore.FieldValue.increment(1);

      if (before.status !== 'concluida' && after.status === 'concluida') {
        inc['totalOSAtivas'] = admin.firestore.FieldValue.increment(-1);
      } else if (before.status === 'concluida' && after.status !== 'concluida') {
        inc['totalOSAtivas'] = admin.firestore.FieldValue.increment(1);
      }
    }

    // GASTO → gastoMes + prevVsCorr
    const deltaPreventiva = Number(after.gastoPreventiva ?? 0) - Number(before.gastoPreventiva ?? 0);
    const deltaCorretiva  = Number(after.gastoCorretiva  ?? 0) - Number(before.gastoCorretiva  ?? 0);
    const deltaTotal      = deltaPreventiva + deltaCorretiva;

    if (deltaTotal !== 0)      inc['gastoMes.total']        = admin.firestore.FieldValue.increment(deltaTotal);
    if (deltaPreventiva !== 0) inc['gastoMes.preventiva']   = admin.firestore.FieldValue.increment(deltaPreventiva);
    if (deltaCorretiva !== 0)  inc['gastoMes.corretiva']    = admin.firestore.FieldValue.increment(deltaCorretiva);
    if (deltaPreventiva !== 0) inc['prevVsCorr.preventiva'] = admin.firestore.FieldValue.increment(deltaPreventiva);
    if (deltaCorretiva !== 0)  inc['prevVsCorr.corretiva']  = admin.firestore.FieldValue.increment(deltaCorretiva);

    // OFICINA → veiculosEmOficina
    if (!before.entregueOficinaEm && after.entregueOficinaEm) {
      inc['veiculosEmOficina'] = admin.firestore.FieldValue.increment(1);
    }
    if (!before.retornouOficinaEm && after.retornouOficinaEm) {
      inc['veiculosEmOficina'] = admin.firestore.FieldValue.increment(-1);
    }

    if (Object.keys(inc).length === 0) return;

    await db.collection('metricas-frota').doc('geral').update(inc);
  },
);

// ── Scheduled: recalcula diariamente (cobre virada de mês) ────────────────────

export const recalcularMetricasDiario = onSchedule(
  { schedule: 'every day 00:05', timeZone: 'America/Sao_Paulo' },
  async () => { await recalcularMetricas(); },
);

// ── HTTP callable: recalcula sob demanda (gestores autenticados) ───────────────

export const recalcularMetricasManual = onCall(
  { enforceAppCheck: false },
  async (request) => {
    if (!request.auth) throw new Error('Não autenticado');
    const userDoc = await db.collection('usuarios').doc(request.auth.uid).get();
    if (userDoc.data()?.perfil !== 'gestor') throw new Error('Sem permissão');
    await recalcularMetricas();
    return { ok: true };
  },
);
