import * as admin from 'firebase-admin';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

// ── Mensagens por status ───────────────────────────────────────────────────────

type OSStatus = 'nova' | 'em_andamento' | 'em_diagnostico' | 'orcamento_aprovado' | 'concluida';

const STATUS_MESSAGES: Record<OSStatus, { title: string; body: (osId: string) => string }> = {
  nova:               { title: 'Nova OS',            body: (id) => `OS ${id.toUpperCase()} foi aberta` },
  em_andamento:       { title: 'OS em andamento',    body: (id) => `Sua OS ${id.toUpperCase()} está sendo atendida` },
  em_diagnostico:     { title: 'OS em diagnóstico',  body: (id) => `Sua OS ${id.toUpperCase()} está em diagnóstico` },
  orcamento_aprovado: { title: 'Orçamento aprovado', body: (id) => `O orçamento da OS ${id.toUpperCase()} foi aprovado` },
  concluida:          { title: 'OS concluída',        body: (id) => `Sua OS ${id.toUpperCase()} foi concluída com sucesso` },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

async function getGestorTokens(): Promise<string[]> {
  const snap = await db
    .collection('usuarios')
    .where('perfil', '==', 'gestor')
    .get();
  return snap.docs
    .map((d) => d.data().fcmToken as string | undefined)
    .filter((t): t is string => !!t);
}

async function getCondutorToken(condutorId: string): Promise<string | null> {
  const snap = await db.collection('usuarios').doc(condutorId).get();
  return (snap.data()?.fcmToken as string | undefined) ?? null;
}

// ── Trigger 1: OS criada → notifica gestores ───────────────────────────────────

export const onOSCreated = onDocumentCreated(
  'ordens-servico/{id}',
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const osId        = event.params.id;
    const condutorNome = (data.condutorNome as string) ?? 'Condutor';
    const placa       = (data.placa as string) ?? '';

    const tokens = await getGestorTokens();
    if (tokens.length === 0) return;

    await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: 'Nova OS aguardando análise',
        body:  `Aberta por ${condutorNome} · ${placa}`,
      },
      data:    { osId },
      android: {
        priority: 'high',
        notification: { channelId: 'os-updates', sound: 'default' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    });
  }
);

// ── Trigger 2: Status atualizado → notifica condutor ──────────────────────────

export const onOSStatusUpdated = onDocumentUpdated(
  'ordens-servico/{id}',
  async (event) => {
    const before = event.data?.before.data();
    const after  = event.data?.after.data();
    if (!before || !after) return;

    // Só dispara quando o campo status mudou
    if (before.status === after.status) return;

    const osId      = event.params.id;
    const newStatus = after.status as OSStatus;
    const condutorId = after.condutorId as string;

    const msg = STATUS_MESSAGES[newStatus];
    if (!msg) return; // status desconhecido

    const token = await getCondutorToken(condutorId);
    if (!token) return;

    await messaging.send({
      token,
      notification: {
        title: msg.title,
        body:  msg.body(osId),
      },
      data:    { osId },
      android: {
        priority: 'high',
        notification: { channelId: 'os-updates', sound: 'default' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    });
  }
);
