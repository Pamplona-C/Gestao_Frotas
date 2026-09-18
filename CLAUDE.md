# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start              # Start Expo dev server
npm run ios            # Run on iOS simulator
npm run android        # Run on Android emulator
npm run web            # Run in browser (PWA preview)
npm run lint           # Run ESLint via expo lint
npx tsc --noEmit       # TypeScript type check
```

No test runner is configured. Expo CLI is the primary build tool.

## Project: FrotaAtiva

Fleet vehicle maintenance management app for a Brazilian company. Data is fully live; `mocks/` directory is a legacy artifact and is not imported anywhere — ignore it.

### Dois backends, uma flag

O app fala com **um de dois backends**, escolhido em build time por `lib/flags.ts`:

```ts
export const USAR_BACKEND = process.env.EXPO_PUBLIC_USAR_BACKEND === 'true';
```

- **`false` (modo atual)** — Firebase: Auth, Firestore, Storage e Cloud Functions.
- **`true`** — `moovia-backend`, uma API REST em Spring Boot + PostgreSQL que vive em
  `~/projects/moovia-backend`. O cliente HTTP é `lib/api.ts` (injeta o Bearer, renova no
  401 com refresh rotativo single-flight) e a sessão fica em `lib/session.ts`.

Cada service tem um par: `x.service.ts` (Firestore) e `x.backend.ts` (REST). **Toda função
exportada consulta a flag** e desvia. `services/auth.service.ts` reexporta a flag como
`AUTH_BACKEND` — é um alias, não uma segunda flag (comentários no código citam um
`EXPO_PUBLIC_AUTH_BACKEND` que **não existe**).

A chave é uma só de propósito: sem sessão Firebase as Firestore Rules recusam tudo, então
não existe estado intermediário em execução.

**Efeitos de `false` que surpreendem:**
- "Esqueci minha senha" some da tela de login (`app/login.tsx`) — o fluxo de código por
  e-mail só existe no backend Java.
- O pull-to-refresh da home vira no-op (`app/(tabs)/index.tsx`); quem mantém os dados vivos
  é o `onSnapshot`.

**A flag é build time.** O perfil `preview` do `eas.json` declara `environment: "production"`,
então build do EAS lê as variáveis do servidor da Expo (`eas env:list --environment production`),
**não** o `.env` local. Build local (`npx expo run:android`) lê o `.env`. Mantenha os dois iguais.

All text is in Brazilian Portuguese. All dates use `date-fns` with `ptBR` locale.

## Architecture

**Stack:** Expo SDK 54 + expo-router v6 (file-based nav) · TypeScript · React Native · react-native-paper (MD3) · Zustand (global state) · react-hook-form + zod (forms) · Firebase JS SDK v12

### Data flow

```
lib/firebase.ts  ──►  services/*.service.ts  ──►  screens (local useState + useFocusEffect)
  (auth, db)              Firestore onSnapshot                   ↕
                          + one-shot reads              store/auth.store.ts   (Zustand)
                                                        store/novaOS.store.ts (Zustand)
```

### Firebase (`lib/firebase.ts`)

Singleton initialization with Fast Refresh safety. Exports `app, auth, db, storage`.

- Persistence: **AsyncStorage** via `getReactNativePersistence` (`lib/firebase.ts:39`), resolvido
  por `require` porque o export condicional `react-native` do `@firebase/auth` não aparece nos
  tipos. A sessão **sobrevive** ao fechar e reabrir o app.
- **Google Sign-In não existe mais.** Todo o bloco está comentado em `app/login.tsx` (linhas 4-5,
  23, 32-65) e não há componente `GoogleSignInButton` no projeto. As `EXPO_PUBLIC_GOOGLE_*`
  continuam no `.env` mas não são lidas por nenhum código ativo, e nem estão no ambiente do EAS.

### Environment variables (`.env`)

```
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID

# Escolha do backend (build time — veja "Dois backends, uma flag")
EXPO_PUBLIC_USAR_BACKEND                # 'true' = moovia-backend REST · qualquer outra coisa = Firebase
EXPO_PUBLIC_API_URL                     # base do moovia-backend; só usado com a flag ligada

# Legado: lidas por código comentado, mantidas por precaução
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
```

### Firestore collections

| Collection | Purpose |
|---|---|
| `usuarios/{uid}` | User profiles (nome, email, perfil, departamento, photoURL, fcmToken) |
| `ordens-servico/{id}` | Work orders (OrdemServico shape) |
| `fornecedores/{id}` | Suppliers |
| `veiculos/{id}` | Fleet vehicles |
| `vinculos/{id}` | Driver↔vehicle assignment; gates OS creation (see below) |
| `checklists/{id}` | Entry/exit photo checklists, immutable after creation |
| `despesas-veiculo/{id}` | Vehicle expenses, including fuel (`tipo: 'abastecimento'`) |
| `departamentos/{id}` | Departments |
| `catalogo-servicos/{id}` | Service catalog |
| `notificacoes/{id}` | In-app notification history, written **only** by Cloud Functions |
| `metricas-frota/geral` | Single pre-aggregated doc with dashboard KPIs; client read-only |

**`vinculos` gates everything the condutor does.** `app/nova-os/etapa-1.tsx:49` only lists
vehicles whose vínculo is `status === 'ativo'` **and** has `checklistEntradaId` set. A driver
with no completed entry checklist cannot open an OS at all — so a Storage outage that blocks
checklist photos also blocks OS creation for new assignments.

**Do not query `vinculos.pendenciaChecklist` to find pending checklists.** That field only
started being written on 22/05/2026 (commit `77aa4fc`) and
`scripts/backfill-pendencia-checklist.mjs` has never been confirmed as run — a `where` on it
silently drops every older vínculo, which is exactly the oldest and most urgent pendency.
`pendenciaDoVinculo(v)` in `services/vinculo.service.ts` derives the same rule from
`status` + `checklistEntradaId`/`checklistSaidaId` and is correct with or without the backfill.
`app/checklists/index.tsx` uses it together with `getVinculosParaAuditoria()` (one full
collection read, which also removes the per-checklist `getVinculosByIds()` fan-out).

**The checklist audit screen (`app/checklists/index.tsx`) splits its filters in two, and the
split is load-bearing:**

- *Escopo* — the date range (server-side, via `getRecentChecklists({ inicioIso, fimIso })`)
  plus condutor and veículo. The metric tiles count the scope.
- *Refinamento* — tipo, status and the text box. These narrow the visible list only, so
  picking "Concluído" can never zero the pending tiles.

Two more deliberate choices there: **pendências ignore the date range** (a pendency is open
*now*, and the oldest one is the most urgent — hiding it under "last 30 days" would invert the
audit), and the `PAGE_SIZE` cap stays even with an explicit range, because a wide range on a
large fleet still overflows; when it trips, the screen says so and tells the user to narrow the
dates instead of silently truncating.

**Condutor and veículo filter by id, client-side, on purpose.** A `checklists` document holds
only `tipo, vinculoId, condutorId, veiculoId, veiculoTipo, fotos, observacoes, completadoEm` —
there is **no placa and no condutorNome on it**, so those cannot be queried server-side without
denormalizing, and Firestore has no substring search anyway. The selector options are built from
the vínculos already in memory, so they cost no extra reads.

### Firebase Storage paths

| Path | Purpose |
|---|---|
| `os-fotos/{veiculoId}/{timestamp}_{index}` | OS photos. **The folder is the vehicle id, not the OS id** — photos upload before the OS exists (`app/nova-os/etapa-6.tsx:64`) so a failed upload can't leave an OS without them |
| `checklists/{vinculoId}/{tipo}/{timestamp}_{i}` | Checklist photos |
| `abastecimento-fotos/{docId}/{timestamp}_0` | Fuel receipt |
| `perfil-fotos/{uid}` | Profile photo — overwrites on change (no accumulation) |

**Every upload goes through `services/storage.service.ts`** — it is the single place that branches
on `USAR_BACKEND` (Firebase Storage vs `POST /uploads` on the Java backend). The `*.backend.ts`
files import from `storage.service`, not `storage.backend`, so the decision is never bypassed.
All four paths compress with `prepararFotoParaUpload` (resize to 1280px, JPEG 0.65) before
uploading — note that `ImagePicker`'s `quality` re-encodes but does **not** resize, and
`perfil-fotos/` has a stricter 5 MB rule than the other folders.

**Upload errors:** `mapStorageError(err, online)` in `storage.service.ts` translates a Storage
failure into what the user can do about it, returning `{ mensagem, acao, codigo }` (ST-00…ST-05).
It takes the connectivity state because the error code alone can't tell "weak signal" from "server
refusing" — both surface as `storage/retry-limit-exceeded`. Used in `app/perfil.tsx`; the other
upload screens still swallow errors in empty `catch {}` blocks.

### Global stores (Zustand)

| Store | Purpose |
|---|---|
| `store/auth.store.ts` | `currentUser`, `loading`, `error`, `login`, `loginWithGoogle`, `logout`, `updatePhoto` |
| `store/novaOS.store.ts` | Multi-step nova OS form state (6 steps), `reset()` |
| `store/notification.store.ts` | `fcmToken`, `setFcmToken` |

### Auth & navigation

- `hooks/useAuthListener.ts` — called **once** in `app/_layout.tsx`. Subscribes to `onAuthStateChanged`; on sign-in calls `buildAppUser` (fetches Firestore profile, auto-creates stub if missing) → `setUser`. On sign-out → `setUser(null)`.
- `app/index.tsx` — shows `ActivityIndicator` while `loading === true`, then `<Redirect>` to `/login` or `/(tabs)` based on `currentUser`.
- Login succeeds via Firebase Auth; a Firestore profile is created on first sign-in with default `perfil = 'condutor'`. Role is promoted to `gestor` manually in Firestore Console.
- Gestores can create new condutor accounts via `app/novo-usuario.tsx` → `createUserAccount()`. This function uses a **secondary Firebase App instance** so the gestor is not logged out.

### Routing structure

```
app/
  _layout.tsx              # Root Stack + PaperProvider + AuthGuard (calls useAuthListener)
  index.tsx                # Loading + redirect only
  login.tsx                # Email/password ("Esqueci minha senha" only when USAR_BACKEND)
  esqueci-senha.tsx        # Backend-only flow (6-digit code by e-mail)
  redefinir-senha.tsx      # Backend-only flow
  novo-usuario.tsx         # Gestor: create condutor accounts
  perfil.tsx               # **The live profile screen** (avatar, photo, change password)
  notificacoes.tsx         # In-app notification history
  meus-veiculos.tsx        # Condutor: active vínculos
  novo-abastecimento.tsx   # Condutor: fuel entry with receipt photo
  catalogo-servicos.tsx    # Gestor: service catalog CRUD
  veiculo/[id].tsx         # Vehicle detail
  checklist/[vinculoId]/[tipo].tsx   # Photo checklist (20 angles car / 6 moto)
  checklists/index.tsx     # Gestor: auditoria de checklists (era `relatorios.tsx`)
  checklists/[id].tsx      # Checklist detail
  (tabs)/
    _layout.tsx            # Tabs: index · nova-acao (center + button) · veiculos · fornecedores · configuracoes
    index.tsx              # Renders CondutorHome or GestorDashboard based on perfil
    veiculos.tsx           # Gestor only (href: null for condutor)
    fornecedores.tsx       # Gestor only (href: null for condutor)
    configuracoes.tsx
    profile.tsx            # **Dead** — declared with `href: null`; use app/perfil.tsx
  nova-os/
    etapa-1.tsx … etapa-6.tsx   # 6-step OS creation form
  os/[id]/
    index.tsx              # OS detail (both roles)
    gerenciar.tsx          # Gestor: assume, status, supplier, note, transfer
```

### Service layer patterns

**Real-time subscriptions** use `onSnapshot` and return an `Unsubscribe` function. Screens call them inside `useFocusEffect` (subscribe on focus, cleanup on blur); the home screen uses `useEffect` for a permanent listener.

**Active-only filter** — `os.service.ts` defines `ACTIVE_STATUSES` (`nova | em_andamento | em_diagnostico | orcamento_aprovado`). All OS subscriptions and queries use `where('status', 'in', ACTIVE_STATUSES)`. Concluded OS are excluded from all queries.

**Avoiding composite Firestore indexes** — `where('status', 'in', ...)` and `orderBy` on different fields would require a composite index. Instead all OS queries omit server-side `orderBy` and sort client-side with `byDate()`. If a `where` + `orderBy` combo is ever added, create the composite index in Firebase Console.

**N+1 elimination** — `OSCard` does not fetch its own data. Parent screens subscribe to all fornecedores once, build a `Map<string, Fornecedor>`, and pass the correct `fornecedor` prop to each `OSCard`.

**Stripping undefined fields** — before any `addDoc`/`updateDoc` call, entries with `undefined` values are filtered out with `Object.fromEntries(...filter([, v] => v !== undefined))`. Firestore rejects `undefined` values.

### Design tokens

All colors in `constants/colors.ts`. Status colors at `Colors.status[status].{bg,text}`.

### Push notifications

FCM is implemented via `@react-native-firebase/messaging` — a native module that **does not load in Expo Go**. The service (`services/notification.service.ts`) uses conditional `require()` to guard this. Token registration flow:

1. `hooks/usePushNotifications.ts` is called in `app/_layout.tsx`; calls `registrarTokenFCM(uid)` on mount and when uid changes.
2. Token is saved to `usuarios/{uid}.fcmToken` in Firestore.
3. Cloud Functions (`functions/src/index.ts`) send notifications. **Ten functions are deployed**
   in `southamerica-east1`:

| Function | Trigger | Notifies |
|---|---|---|
| `onOSCreated` | create `ordens-servico` | all gestores with a token |
| `onOSStatusUpdated` | update, status changed | the OS condutor |
| `onVinculoCriado` | create `vinculos` | the condutor (first one only) |
| `onOSEntregueOficina` | update | the owning gestor |
| `onOSRetornoOficina` | update | the owning gestor |
| `onOSGastoOuOficinaUpdated` | update | — (recomputes metrics) |
| `onUsuarioDeleted` | delete `usuarios` | — (deletes the Auth user) |
| `enviarLembretesOS` | daily 07:00 BRT | condutor of OS scheduled today |
| `recalcularMetricasDiario` | daily 00:05 BRT | — (full metrics recompute) |
| `recalcularMetricasManual` | callable | — |

   Stale tokens are automatically deleted from Firestore after FCM returns a permanent error.

**Notification copy lives in exactly one file** — `functions/src/index.ts`. Each trigger builds a
`title`/`body` and uses the same pair twice: once in the FCM payload and once in the `notificacoes`
document. The app never rewrites it (`app/notificacoes.tsx` renders `n.title`/`n.body` verbatim;
`type` only picks the icon). Status messages come from the `STATUS_MESSAGES` map.

Two consequences worth knowing:
- Changing the copy only affects **new** notifications — the history stores the text as sent.
- `nomeVeiculo(os)` is the single source for how a vehicle is named in messages. Cascade:
  `veiculoModelo → placa → \`Frota {frota}\` → veiculoMarca → 'sem identificação'`, treating
  `'—'` (the app's default) and blanks as absent. Use it instead of reading the fields directly.

**Cost note:** `onOSCreated` used to carry `minInstances: 1`, which kept a container warm 24/7 and
cost ~R$66/month — 93% of the August 2026 bill. It was removed in Sept 2026. `setGlobalOptions`
now sets `memory: '512MiB'` (which yields a full vCPU, shortening cold starts) and the file imports
`firebase-admin` through modular entry points rather than the barrel, for the same reason.

**Event functions do not retry** (`RETRY_POLICY_DO_NOT_RETRY`): an uncaught throw drops the event
and the notification is lost. Keep bookkeeping (the `metricas-frota/geral` increment) *after* the
push and in its own try/catch — that document is a single hot doc with a ~1 write/sec limit, and
`recalcularMetricasDiario` repairs any drift overnight.

To deploy functions: `cd functions && npm run deploy`. To serve locally with emulator: `npm run serve`.

### Offline detection

`hooks/useConectividade.ts` wraps `@react-native-community/netinfo` and returns `online: boolean`. Screens that require connectivity (e.g., nova-os flow) render `<SemInternet />` when offline.

### Key components

| Component | Notes |
|---|---|
| `StatusBadge` | Pill with status color; accepts `status: OSStatus` |
| `OSCard` | Pure render card; requires `fornecedor` prop from parent (no internal fetch) |
| `StepperHeader` | 6-step horizontal indicator; `currentStep` prop |
| `Timeline` | 4 fixed steps derived from OS `status` field |
| `MetricCard` | Number + label surface card |
| `AccordionItem` | Reanimated expand/collapse; `subitens=[]` → direct checkbox |
| `CidadeAutocomplete` | City search backed by `data/municipios.ts` static list |
| `SemInternet` | Full-screen offline fallback with animated entry |

### Static data

- `constants/servicosCategorias.ts` — predefined OS service categories with optional subitems; used in nova-os step 3.
- `data/municipios.ts` — static Brazilian city list for `CidadeAutocomplete`.

### Path aliases

`@/*` maps to root (tsconfig). In practice the codebase uses relative paths (`../../`) — prefer relative imports to avoid confusion.
