# Technology Stack

**Analysis Date:** 2026-05-22

## Languages

**Primary:**
- TypeScript ~5.9.2 — all application code (app/, components/, services/, hooks/, store/, lib/)
- TypeScript ^5.0.0 — Cloud Functions (`functions/src/`)

**Secondary:**
- JavaScript — config files (eslint.config.js, scripts/)

## Runtime

**Environment:**
- React Native 0.81.5 (iOS + Android)
- Web via `react-native-web ~0.21.0` (PWA/static export)

**Node.js:**
- Cloud Functions runtime: Node 20 (specified in `functions/package.json` engines)
- Local dev: Expo CLI manages bundling — no explicit Node version pinned in root

**Package Manager:**
- npm (root project)
- npm (functions subproject at `functions/`)
- Lockfile: `package-lock.json` present at root

## Frameworks

**Core:**
- Expo SDK ~54.0.33 — managed workflow with custom dev client (native modules required)
- expo-router ~6.0.23 — file-based navigation (Stack + Tabs)
- React 19.1.0 — UI rendering
- React Native 0.81.5 — native mobile runtime

**UI / Design System:**
- react-native-paper ^5.15.1 — Material Design 3 component library
- react-native-reanimated ~4.1.1 — animation engine
- react-native-gesture-handler ~2.28.0 — gesture handling
- react-native-safe-area-context ~5.6.0 — safe area insets
- react-native-screens ~4.16.0 — native screen containers
- @expo/vector-icons ^15.0.3 — icon set

**State Management:**
- Zustand ^5.0.12 — global stores (`store/auth.store.ts`, `store/novaOS.store.ts`, `store/notification.store.ts`)

**Forms / Validation:**
- react-hook-form ^7.72.1 — form management
- @hookform/resolvers ^5.2.2 — schema adapter
- zod ^4.3.6 — schema validation

**Navigation:**
- @react-navigation/native ^7.1.8 — underlying navigation
- @react-navigation/bottom-tabs ^7.4.0 — tab navigator
- @react-navigation/elements ^2.6.3 — shared navigation elements

**Date Handling:**
- date-fns ^4.1.0 — date utilities; `ptBR` locale used throughout

**Testing:**
- No test runner configured. `npm run lint` runs ESLint only.

**Build / Dev:**
- Expo CLI — dev server, builds
- EAS Build (cli >= 16.0.0) — cloud builds (see `eas.json`)
  - `development` profile: internal APK distribution, dev client enabled
  - `preview` profile: internal APK, production environment
- Firebase CLI — Cloud Functions deploy (`cd functions && npm run deploy`)
- TypeScript compiler — `npx tsc --noEmit` for type checking

## Key Dependencies

**Critical:**
- `firebase` ^12.12.0 — Firebase JS SDK (Firestore, Auth, Storage)
- `@react-native-firebase/app` ^24.0.0 — native Firebase bridge (required for FCM)
- `@react-native-firebase/messaging` ^24.0.0 — FCM push notifications (native only, not Expo Go)
- `expo-notifications` ~0.32.16 — Android notification channel setup
- `@react-native-async-storage/async-storage` 2.2.0 — Auth persistence for native builds

**Media / Image:**
- `expo-image-picker` ~17.0.10 — camera / gallery access
- `expo-image-manipulator` ~14.0.8 — resize + compress before upload
- `expo-image` ~3.0.11 — optimized image rendering

**Network / Connectivity:**
- `@react-native-community/netinfo` 11.4.1 — online/offline detection (`hooks/useConectividade.ts`)

**Date/Time Input:**
- `@react-native-community/datetimepicker` 8.4.4 — native date picker

**Auth:**
- `expo-auth-session` ~7.0.10 — OAuth session management
- `expo-crypto` ~15.0.8 — PKCE for OAuth
- `expo-web-browser` ~15.0.10 — in-app browser for OAuth redirects

**Utilities:**
- `expo-constants` ~18.0.13 — access to `Constants.appOwnership` (Expo Go detection)
- `expo-device` ~8.0.10 — device info
- `expo-linking` ~8.0.11 — deep linking
- `expo-haptics` ~15.0.8 — haptic feedback
- `expo-symbols` ~1.0.8 — SF Symbols (iOS)
- `expo-font` ~14.0.11 — custom font loading
- `expo-splash-screen` ~31.0.13 — splash screen control
- `expo-status-bar` ~3.0.9 — status bar styling
- `expo-system-ui` ~6.0.9 — system UI color
- `react-native-worklets` 0.5.1 — Reanimated worklets

**Cloud Functions (functions/):**
- `firebase-admin` ^12.0.0 — server-side Firebase SDK
- `firebase-functions` ^6.0.0 — Cloud Functions v2 triggers

## Configuration

**Environment:**
- All runtime config via `EXPO_PUBLIC_*` env vars loaded from `.env`
- Expo automatically exposes `EXPO_PUBLIC_*` to the client bundle
- Template: `.env.example` at project root

**Build:**
- `app.json` — Expo app config (bundle IDs, plugins, experiments)
- `eas.json` — EAS Build profiles
- `tsconfig.json` — TypeScript config (extends `expo/tsconfig.base`, strict mode, `@/*` path alias)
- `functions/tsconfig.json` — separate TS config for Cloud Functions

**Experiments enabled** (in `app.json`):
- `typedRoutes: true` — type-safe expo-router routes
- `reactCompiler: true` — React Compiler (auto-memoization)
- `newArchEnabled: true` — React Native New Architecture

## Platform Requirements

**Development:**
- Expo Go: limited — FCM and Google Sign-In are disabled (native modules not available)
- Full functionality requires a development build via `expo run:ios` or `expo run:android`
- Google services files required for native builds:
  - iOS: `GoogleService-Info.plist`
  - Android: `google-services.json`

**Production:**
- iOS: bundle ID `com.gustavopamplona.frotaativa`
- Android: package `com.gustavopamplona.frotaativa`, edge-to-edge enabled
- Web: static output (`web.output: "static"`)
- EAS project ID: `2abc95fc-c49e-45f5-a0fa-4a24bb9e06fd`, owner: `pamplonacoelho`
- Cloud Functions: deployed to Firebase project via `cd functions && npm run deploy`

---

*Stack analysis: 2026-05-22*
