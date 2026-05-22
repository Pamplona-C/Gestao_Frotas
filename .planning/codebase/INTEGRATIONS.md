# External Integrations

**Analysis Date:** 2026-05-22

## Firebase Services

Firebase is the sole backend. Initialized as a singleton in `lib/firebase.ts` with Fast Refresh safety (guards against re-initialization via `getApps().length`).

**Firebase Auth:**
- SDK: `firebase/auth` (JS SDK v12) via `lib/firebase.ts`
- Persistence: `getReactNativePersistence(AsyncStorage)` — session survives app restarts on native builds
- Email/password sign-in: `services/auth.service.ts`
- Google Sign-In: `expo-auth-session` + `expo-crypto` (PKCE flow); only available in native builds (not Expo Go)
- Google credential sourced from `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` env vars
- Secondary Firebase App instance used in `app/novo-usuario.tsx` via `createUserAccount()` so the gestor is not signed out when creating new condutor accounts
- Listener: `hooks/useAuthListener.ts` — called once in `app/_layout.tsx`; auto-creates Firestore profile stub on first sign-in

**Firestore:**
- SDK: `firebase/firestore` via `lib/firebase.ts`
- Client: `db` (Firestore instance), used in all `services/*.service.ts` files
- Pattern: `onSnapshot` for real-time subscriptions (return `Unsubscribe`), `getDocs`/`getDoc` for one-shot reads
- All write calls strip `undefined` fields before `addDoc`/`updateDoc`

  Collections:
  | Collection | Purpose | Service file |
  |---|---|---|
  | `usuarios/{uid}` | User profiles (nome, email, perfil, departamento, photoURL, fcmToken) | `services/usuarios.service.ts` |
  | `ordens-servico/{id}` | Work orders | `services/os.service.ts` |
  | `fornecedores/{id}` | Suppliers | `services/fornecedor.service.ts` |
  | `veiculos/{id}` | Fleet vehicles | `services/veiculo.service.ts` |
  | `notificacoes/{id}` | In-app notification history (90-day TTL) | `services/notificacoes.service.ts` |
  | `vinculos/{id}` | Driver-vehicle links | `services/vinculo.service.ts` |
  | `checklists/{id}` | Vehicle inspection checklists | `services/checklist.service.ts` |
  | `catalogo-servicos/{id}` | Service catalog entries | `services/catalogo.service.ts` |

**Firebase Storage:**
- SDK: `firebase/storage` via `lib/firebase.ts`
- Client: `storage` instance; used exclusively in `services/storage.service.ts`
- All photos resized/compressed by `expo-image-manipulator` before upload (max 1280px wide, 65% quality, JPEG)
- Upload uses `uploadBytesResumable` with progress callbacks

  Storage paths:
  | Path | Purpose |
  |---|---|
  | `os-fotos/{osId}/{timestamp}_{index}` | OS photos — parallel upload |
  | `perfil-fotos/{uid}` | Profile photos — single file, overwritten on change |
  | `checklists/{id}/{subpath}` | Checklist inspection photos (via `uploadFotosGenerica`) |

**Firebase Cloud Messaging (FCM):**
- Native SDK: `@react-native-firebase/messaging` ^24.0.0
- Guard: `services/notification.service.ts` uses conditional `require()` — module never loads in Expo Go (`Constants.appOwnership === 'expo'`)
- Token registration: `hooks/usePushNotifications.ts` → `registrarTokenFCM(uid)` — saves token to `usuarios/{uid}.fcmToken`
- Android channel: `os-updates` (HIGH importance) set up via `expo-notifications`
- Token refresh handled via `onTokenRefresh` callback; stale tokens deleted from Firestore on FCM permanent error

**Firebase Cloud Functions (v2):**
- Runtime: Node 20, TypeScript
- Source: `functions/src/index.ts`
- Deploy: `cd functions && npm run deploy` (builds TS then `firebase deploy --only functions`)
- Local dev: `npm run serve` (Firebase emulator)
- Admin SDK: `firebase-admin` ^12.0.0

  Triggers:
  | Export | Trigger | Action |
  |---|---|---|
  | `onOSCreated` | `onDocumentCreated('ordens-servico/{id}')` | Notifies all gestores via FCM multicast; persists notification docs |
  | `onOSStatusUpdated` | `onDocumentUpdated('ordens-servico/{id}')` | Notifies the condutor when OS status changes; persists notification doc |
  | `onVinculoCriado` | `onDocumentCreated('vinculos/{id}')` | Notifies condutor when a vehicle is linked to them |
  | `enviarLembretesOS` | `onSchedule('every day 07:00', America/Sao_Paulo)` | Daily reminders for OS with `dataDesejada` matching today |

  Multicast batching: FCM sends are chunked at 500 tokens/batch (FCM limit). Stale tokens are automatically removed from Firestore on `messaging/registration-token-not-registered`, `messaging/invalid-registration-token`, or `messaging/invalid-argument`.

## Authentication & Identity

**Auth Provider:** Firebase Auth
- Email/password — primary method
- Google OAuth — optional, conditional on env vars and native build
- Role system: `perfil` field in `usuarios/{uid}` — values `'condutor'` or `'gestor'`
- Gestores are promoted manually in Firestore Console (default on sign-up is `'condutor'`)

## Data Storage

**Database:** Cloud Firestore (Firebase)
- Connection: configured via `EXPO_PUBLIC_FIREBASE_*` env vars
- Client: Firebase JS SDK `firebase/firestore`, singleton `db` from `lib/firebase.ts`

**File Storage:** Firebase Storage
- Connection: same Firebase project, `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- Client: Firebase JS SDK `firebase/storage`, singleton `storage` from `lib/firebase.ts`

**Local Persistence:** AsyncStorage (`@react-native-async-storage/async-storage` 2.2.0)
- Used for Auth persistence only (session token)

**Caching:** None — no explicit caching layer. Firestore SDK handles offline cache internally.

## Monitoring & Observability

**Error Tracking:** None — no Sentry, Crashlytics, or equivalent configured
**Logs:** `console.warn` used in catch blocks throughout services; Cloud Functions use `firebase functions:log`

## CI/CD & Deployment

**App Hosting:** Expo Application Services (EAS)
- EAS project ID: `2abc95fc-c49e-45f5-a0fa-4a24bb9e06fd`
- Owner: `pamplonacoelho`
- Builds: `eas build` with profiles `development` and `preview`

**Functions Hosting:** Firebase Functions (Google Cloud)
- Region: default (us-central1 unless overridden)
- `minInstances: 1` set on `onOSCreated` and `onOSStatusUpdated` to reduce cold starts

**CI Pipeline:** None configured

## Environment Configuration

**Required env vars (app):**

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase project API key |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Firestore project ID |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Storage bucket |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Firebase app registration ID |

**Optional env vars (app):**

| Variable | Purpose | Effect if missing |
|---|---|---|
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google OAuth web client | Google Sign-In disabled |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google OAuth iOS client | Google Sign-In disabled |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Google OAuth Android client | Google Sign-In disabled |

**Secrets location:**
- `.env` at project root (gitignored)
- Template: `.env.example`
- Google services config: `GoogleService-Info.plist` (iOS), `google-services.json` (Android) — referenced in `app.json` plugins; must be present for native builds

## Webhooks & Callbacks

**Incoming:** None — no HTTP-triggered Cloud Functions
**Outgoing:** FCM sends notifications to device tokens (server-initiated via Cloud Functions triggers)

## Native Module Notes

These packages require a custom dev client (not compatible with Expo Go):

- `@react-native-firebase/app` — native Firebase bridge
- `@react-native-firebase/messaging` — FCM (guarded with conditional require in `services/notification.service.ts`)
- `@react-native-community/datetimepicker` — native date picker
- `@react-native-community/netinfo` — network state

---

*Integration audit: 2026-05-22*
