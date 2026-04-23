"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onOSStatusUpdated = exports.onOSCreated = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();
const STATUS_MESSAGES = {
    nova: { title: 'Nova OS', body: (id) => `OS ${id.toUpperCase()} foi aberta` },
    em_andamento: { title: 'OS em andamento', body: (id) => `Sua OS ${id.toUpperCase()} está sendo atendida` },
    em_diagnostico: { title: 'OS em diagnóstico', body: (id) => `Sua OS ${id.toUpperCase()} está em diagnóstico` },
    orcamento_aprovado: { title: 'Orçamento aprovado', body: (id) => `O orçamento da OS ${id.toUpperCase()} foi aprovado` },
    concluida: { title: 'OS concluída', body: (id) => `Sua OS ${id.toUpperCase()} foi concluída com sucesso` },
};
// ── Helpers ────────────────────────────────────────────────────────────────────
async function getGestorTokens() {
    const snap = await db
        .collection('usuarios')
        .where('perfil', '==', 'gestor')
        .get();
    return snap.docs
        .map((d) => d.data().fcmToken)
        .filter((t) => !!t);
}
async function getCondutorToken(condutorId) {
    const snap = await db.collection('usuarios').doc(condutorId).get();
    return snap.data()?.fcmToken ?? null;
}
// ── Trigger 1: OS criada → notifica gestores ───────────────────────────────────
exports.onOSCreated = (0, firestore_1.onDocumentCreated)('ordens-servico/{id}', async (event) => {
    const data = event.data?.data();
    if (!data)
        return;
    const osId = event.params.id;
    const condutorNome = data.condutorNome ?? 'Condutor';
    const placa = data.placa ?? '';
    const tokens = await getGestorTokens();
    if (tokens.length === 0)
        return;
    await messaging.sendEachForMulticast({
        tokens,
        notification: {
            title: 'Nova OS aguardando análise',
            body: `Aberta por ${condutorNome} · ${placa}`,
        },
        data: { osId },
        android: {
            priority: 'high',
            notification: { channelId: 'os-updates', sound: 'default' },
        },
        apns: {
            payload: { aps: { sound: 'default', badge: 1 } },
        },
    });
});
// ── Trigger 2: Status atualizado → notifica condutor ──────────────────────────
exports.onOSStatusUpdated = (0, firestore_1.onDocumentUpdated)('ordens-servico/{id}', async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after)
        return;
    // Só dispara quando o campo status mudou
    if (before.status === after.status)
        return;
    const osId = event.params.id;
    const newStatus = after.status;
    const condutorId = after.condutorId;
    const msg = STATUS_MESSAGES[newStatus];
    if (!msg)
        return; // status desconhecido
    const token = await getCondutorToken(condutorId);
    if (!token)
        return;
    await messaging.send({
        token,
        notification: {
            title: msg.title,
            body: msg.body(osId),
        },
        data: { osId },
        android: {
            priority: 'high',
            notification: { channelId: 'os-updates', sound: 'default' },
        },
        apns: {
            payload: { aps: { sound: 'default', badge: 1 } },
        },
    });
});
//# sourceMappingURL=index.js.map