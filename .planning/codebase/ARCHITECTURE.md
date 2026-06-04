# ARCHITECTURE.md — System Architecture

Generated: 2026-05-22 | Branch: feat/tela-checklist

---

## System Overview

FrotaAtiva is a fleet vehicle maintenance management app. The architecture is a **4-layer system**:

```
┌─────────────────────────────────────────────────────┐
│  Screens (app/ — expo-router file-based navigation) │
│  Local state: useState + useFocusEffect             │
└────────────────────┬────────────────────────────────┘
                     │ calls
┌────────────────────▼────────────────────────────────┐
│  Services (services/*.service.ts)                   │
│  onSnapshot subscriptions + one-shot getDocs        │
└────────────────────┬────────────────────────────────┘
                     │ uses
┌────────────────────▼────────────────────────────────┐
│  Firebase JS SDK (lib/firebase.ts — singleton)       │
│  auth, db (Firestore), storage                      │
└────────────────────┬────────────────────────────────┘
                     │ connects to
┌────────────────────▼────────────────────────────────┐
│  Firebase Cloud                                     │
│  Auth · Firestore · Storage · FCM · Functions v2    │
└─────────────────────────────────────────────────────┘
```

Global state lives in **Zustand** stores, accessed directly by screens without prop drilling.

---

## Auth & Navigation Flow

```
app/_layout.tsx
  └─ useAuthListener (called once)
       └─ onAuthStateChanged
            ├─ sign-in  → buildAppUser() → fetch /usuarios/{uid} (create stub if missing)
            │              → setUser(AppUser) in useAuthStore
            └─ sign-out → setUser(null)

app/index.tsx
  └─ if loading → ActivityIndicator
     if currentUser → Redirect to /(tabs)
     else           → Redirect to /login
```

### Role branching

- `app/(tabs)/_layout.tsx` — tabs differ by `currentUser.perfil`:
  - **condutor**: Home + Meus Veículos + Configurações
  - **gestor**: Home + Veículos + Fornecedores + Configurações
  - Unused tabs hidden via `href: null` (not rendered at all)
- `app/(tabs)/index.tsx` renders `<CondutorHome>` or `<GestorDashboard>` based on `perfil`

---

## State Management

### Zustand Stores

| Store | File | Contents |
|---|---|---|
| `useAuthStore` | `store/auth.store.ts` | `currentUser`, `loading`, `error`, `login`, `loginWithGoogle`, `logout`, `updatePhoto` |
| `useNovaOSStore` | `store/novaOS.store.ts` | Multi-step form state for 6-step OS creation, `reset()` |
| `useNotificationStore` | `store/notification.store.ts` | `fcmToken`, `setFcmToken` |

### Local State

Screens own their own data via `useState` + subscription hooks. No global data cache — each screen subscribes independently.

---

## Real-Time Subscription Pattern

```ts
// In screen:
useFocusEffect(useCallback(() => {
  const unsub = subscribeToX(uid, (items) => setItems(items));
  return unsub; // Firebase Unsubscribe called on blur
}, [uid]));

// In service:
export function subscribeToX(uid: string, cb: (items: X[]) => void): Unsubscribe {
  const q = query(collection(db, 'collection'), where('field', '==', uid));
  return onSnapshot(q, snap => cb(snap.docs.map(docToX)));
}
```

Home screen (`app/(tabs)/index.tsx`) uses `useEffect` instead for a permanent listener.

---

## Key Architectural Constraints

### No composite Firestore indexes
`where('status', 'in', [...])` + `orderBy` on a different field requires a composite index.  
**Solution:** Omit server-side `orderBy`, sort client-side with `byDate()`.

### Undefined stripping before writes
Firestore rejects documents with `undefined` values.  
**Solution:** `Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))` before every `addDoc`/`updateDoc`.

### Firebase SDK v12 persistence
`getReactNativePersistence` was removed in Firebase v12.  
**Solution:** `inMemoryPersistence` — users re-authenticate after app restart in Expo Go.

### FCM native module guard
`@react-native-firebase/messaging` does not load in Expo Go.  
**Solution:** `services/notification.service.ts` uses conditional `require()` behind a runtime check.

---

## Cloud Functions

Deployed at `functions/src/index.ts`, Firebase Functions v2, Node 20 runtime.

| Trigger | Event | Action |
|---|---|---|
| `onOSCreated` | `ordens-servico` onCreate | Notify all gestores via FCM |
| `onOSStatusUpdated` | `ordens-servico` onUpdate (status change) | Notify condutor via FCM |
| `onVinculoCriado` | `vinculos` onCreate | Notify condutor of new vehicle assignment |
| `enviarLembretesOS` | Scheduled (pubsub) | Send reminders for open OS |

Stale FCM tokens are automatically deleted from Firestore when FCM returns a permanent error.

---

## Multi-Step OS Creation Flow

6-screen form backed by `useNovaOSStore` (Zustand):
- Step 1: Vínculo/veículo selection
- Step 2: Descrição + foto upload  
- Step 3: Serviços (categories from `constants/servicosCategorias.ts`)
- Step 4: Cidade (`CidadeAutocomplete` + `data/municipios.ts`)
- Step 5: Data/horário desejado
- Step 6: Review + `addDoc` to Firestore → store.reset()

---

## Checklist Flow

Condutor fills checklist (entrada/saída) linked to a `Vinculo`:
- Screen: `app/checklist/[vinculoId]/[tipo].tsx`
- Creates `checklists/{id}` document + updates `vinculos/{id}.checklistEntradaId|SaidaId`
- Can trigger OS creation from checklist screen (`app/checklists/[id].tsx`)

---

## Gestor: Account Creation

`app/novo-usuario.tsx` uses a **secondary Firebase App instance** so the gestor is not logged out when creating a condutor account via `createUserAccount()` in `auth.service.ts`.
