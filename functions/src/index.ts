import * as admin from 'firebase-admin';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

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

interface TokenEntry { uid: string; token: string }

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
  'ordens-servico/{id}',
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

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
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
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
        expiresAt,
        read: false,
      });
    });
    await batch.commit();
  },
);

// ── Trigger 2: Status atualizado → notifica condutor ──────────────────────────

export const onOSStatusUpdated = onDocumentUpdated(
  'ordens-servico/{id}',
  async (event) => {
    const before = event.data?.before.data();
    const after  = event.data?.after.data();
    if (!before || !after) return;

    if (before.status === after.status) return;

    const osId       = event.params.id;
    const newStatus  = after.status as OSStatus;
    const condutorId = after.condutorId as string;

    const msg = STATUS_MESSAGES[newStatus];
    if (!msg) return;

    const condutorDoc = await db.collection('usuarios').doc(condutorId).get();
    const token = condutorDoc.data()?.fcmToken as string | undefined;
    if (!token) return;

    const title = msg.title;
    const body  = msg.body(osId);

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

      // Persiste histórico para o condutor
      const now = new Date();
      await db.collection('notificacoes').add({
        userId: condutorId,
        type: 'status_atualizado',
        title,
        body,
        osId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
        read: false,
      });
    } catch (err: any) {
      if (isStaleToken(err?.errorInfo?.code)) {
        await removeStaleToken(condutorId);
      }
    }
  },
);

// ── Trigger 3: Lembretes diários de OS agendadas ──────────────────────────────

const ACTIVE_STATUSES = ['nova', 'em_andamento', 'em_diagnostico', 'orcamento_aprovado'];
const SP_OFFSET_MS = -3 * 60 * 60 * 1000; // UTC-3 (Brasília, sem horário de verão)

export const enviarLembretesOS = onSchedule(
  { schedule: 'every day 07:00', timeZone: 'America/Sao_Paulo' },
  async () => {
    const hojeStr = new Date(Date.now() + SP_OFFSET_MS).toISOString().slice(0, 10);

    const snap = await db
      .collection('ordens-servico')
      .where('status', 'in', ACTIVE_STATUSES)
      .get();

    const candidatas = snap.docs.filter((d) => {
      const data = d.data();
      if (!data.dataDesejada || data.lembreteEnviadoEm) return false;
      const osDateSP = new Date(new Date(data.dataDesejada).getTime() + SP_OFFSET_MS);
      return osDateSP.toISOString().slice(0, 10) === hojeStr;
    });

    await Promise.all(
      candidatas.map(async (d) => {
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

        const now = new Date();
        await db.collection('notificacoes').add({
          userId: os.condutorId,
          type: 'lembrete_os',
          title,
          body,
          osId: d.id,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
          read: false,
        });

        await d.ref.update({
          lembreteEnviadoEm: admin.firestore.FieldValue.serverTimestamp(),
        });
      }),
    );
  },
);
