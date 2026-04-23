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

Fleet vehicle maintenance management app for a Brazilian company. **Backend: Firebase (Auth + Firestore).** Data is fully live; `mocks/` directory is a legacy artifact and is not imported anywhere — ignore it.

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

- Persistence: `inMemoryPersistence` (Firebase v12 removed `getReactNativePersistence`). Users must re-authenticate after app restart in Expo Go; native builds can swap to AsyncStorage.
- Google Sign-In credentials sourced from `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` env vars. The `GoogleSignInButton` component only renders when all three client IDs are set **and** the app is not running in Expo Go (`Constants.appOwnership !== 'expo'`).

### Environment variables (`.env`)

```
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID

EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID        # optional — disables Google Sign-In if missing
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
```

### Firestore collections

| Collection | Purpose |
|---|---|
| `usuarios/{uid}` | User profiles (nome, email, perfil, departamento, photoURL) |
| `ordens-servico/{id}` | Work orders (OrdemServico shape) |
| `fornecedores/{id}` | Suppliers |
| `veiculos/{id}` | Fleet vehicles |

### Global stores (Zustand)

| Store | Purpose |
|---|---|
| `store/auth.store.ts` | `currentUser`, `loading`, `error`, `login`, `loginWithGoogle`, `logout`, `updatePhoto` |
| `store/novaOS.store.ts` | Multi-step nova OS form state (6 steps), `reset()` |

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
  login.tsx                # Email/password + conditional Google Sign-In
  novo-usuario.tsx         # Gestor: create condutor accounts
  (tabs)/
    _layout.tsx            # Role-based Tabs: condutor (home + profile) vs gestor (home + veículos + fornecedores + profile)
    index.tsx              # Renders CondutorHome or GestorDashboard based on perfil
    veiculos.tsx           # Gestor only (href: null for condutor)
    fornecedores.tsx       # Gestor only (href: null for condutor)
    profile.tsx
  nova-os/
    _layout.tsx            # Stack wrapper
    etapa-1.tsx … etapa-6.tsx   # 6-step OS creation form
  os/
    _layout.tsx
    [id]/
      _layout.tsx
      index.tsx            # OS detail (both roles)
      gerenciar.tsx        # Gestor: assign supplier, change status, add note
```

### Service layer patterns

**Real-time subscriptions** use `onSnapshot` and return an `Unsubscribe` function. Screens call them inside `useFocusEffect` (subscribe on focus, cleanup on blur); the home screen uses `useEffect` for a permanent listener.

**Active-only filter** — `os.service.ts` defines `ACTIVE_STATUSES` (`nova | em_andamento | em_diagnostico | orcamento_aprovado`). All OS subscriptions and queries use `where('status', 'in', ACTIVE_STATUSES)`. Concluded OS are excluded from all queries.

**Avoiding composite Firestore indexes** — `where('status', 'in', ...)` and `orderBy` on different fields would require a composite index. Instead all OS queries omit server-side `orderBy` and sort client-side with `byDate()`. If a `where` + `orderBy` combo is ever added, create the composite index in Firebase Console.

**N+1 elimination** — `OSCard` does not fetch its own data. Parent screens subscribe to all fornecedores once, build a `Map<string, Fornecedor>`, and pass the correct `fornecedor` prop to each `OSCard`.

**Stripping undefined fields** — before any `addDoc`/`updateDoc` call, entries with `undefined` values are filtered out with `Object.fromEntries(...filter([, v] => v !== undefined))`. Firestore rejects `undefined` values.

### Design tokens

All colors in `constants/colors.ts`. Status colors at `Colors.status[status].{bg,text}`.

### Key components

| Component | Notes |
|---|---|
| `StatusBadge` | Pill with status color; accepts `status: OSStatus` |
| `OSCard` | Pure render card; requires `fornecedor` prop from parent (no internal fetch) |
| `StepperHeader` | 6-step horizontal indicator; `currentStep` prop |
| `Timeline` | 4 fixed steps derived from OS `status` field |
| `MetricCard` | Number + label surface card |
| `AccordionItem` | Reanimated expand/collapse; `subitens=[]` → direct checkbox |

### Path aliases

`@/*` maps to root (tsconfig). In practice the codebase uses relative paths (`../../`) — prefer relative imports to avoid confusion.
