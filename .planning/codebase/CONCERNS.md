# CONCERNS.md — Technical Concerns & Risks

Generated: 2026-05-22 | Branch: feat/tela-checklist

---

## Tech Debt

### HIGH — Deprecated `AppUser.id` field
- **File:** `types/index.ts:22`
- `AppUser.id` is an alias for `uid`, kept for mock compatibility. Marked `@deprecated` with a TODO to remove after Firestore migration.
- Risk: Confusion about which field to use for Firestore queries. Some services may use `id` where `uid` is correct.

### MEDIUM — `auth.service.ts` TODO comments (API migration stubs)
- **File:** `services/auth.service.ts:70,89,123,138,157`
- Several functions have `// TODO: replace with api.get/post/put` comments suggesting a planned REST API layer that never materialized.
- These are dead comments — the app is Firestore-direct. Clean up or remove.

### MEDIUM — Duplicate `meus-veiculos` route
- **Files:** `app/meus-veiculos.tsx` AND `app/(tabs)/meus-veiculos.tsx`
- Two files with the same purpose. The standalone `app/meus-veiculos.tsx` may be a leftover from before it was added to tabs.
- Risk: Maintenance divergence between the two versions.

### LOW — `mocks/` directory legacy artifact
- CLAUDE.md notes this is not imported anywhere. Safe to delete but low risk.

---

## Security Concerns

### MEDIUM — Checklist read rule is overly broad
- **File:** `firestore.rules:64`
- `allow read: if isAuthenticated()` — any authenticated user can read any checklist document.
- Should be restricted to: the checklist's `condutorId` or a gestor.

### MEDIUM — OS read rule is overly broad
- **File:** `firestore.rules:27`
- `allow read: if isAuthenticated()` — any user can read any OS.
- Conductores should only read their own OS; gestores read all.

### LOW — Vinculo update allows any condutor to update (not just the owner)
- **File:** `firestore.rules:52`
- `allow update: if isGestor() || resource.data.condutorId == request.auth.uid`
- This is correct by intent (condutor updates their own checklist fields), but the update is not field-restricted like the OS photo update is. A rogue condutor could update any field on their own vínculo.

### LOW — `isGestor()` reads Firestore on every rule evaluation
- The `isGestor()` helper does a `get()` call on each rule check. High-traffic apps pay a read per request.
- Low risk at current scale.

---

## Firebase-Specific Risks

### HIGH — `minInstances: 1` on 3 Cloud Functions
- **File:** `functions/src/index.ts` (check for minInstances)
- Keeping warm instances costs money continuously. Review if this is intentional given current usage.

### MEDIUM — N+1 reads in `relatorios.tsx`
- **File:** `app/relatorios.tsx`
- The reports screen calls `getVinculosByIds()` — potentially many individual reads per report page load.
- As the fleet grows, this will become slow and expensive. Consider denormalizing report data.

### MEDIUM — Non-atomic checklist + vínculo write
- **File:** `services/checklist.service.ts`
- Creating a checklist writes to both `checklists/{id}` and updates `vinculos/{id}` in two separate operations (no Firestore batch/transaction).
- If the second write fails, the vínculo won't reflect the checklist, creating data inconsistency.
- Fix: use `writeBatch()` or `runTransaction()`.

### LOW — No notification TTL enforcement
- `Notificacao.expiresAt` is set but nothing automatically deletes expired notifications from Firestore.
- Accumulation over time. Consider a scheduled Cloud Function to prune expired notifications.

---

## Performance Risks

### MEDIUM — `relatorios.tsx` fetches data on every render pass
- No memoization/caching of report data. Heavy for gestores with large fleets.

### LOW — `data/municipios.ts` static list loaded synchronously
- ~5000 city entries loaded into memory. Fine for now; could be lazy-loaded if bundle size becomes a concern.

### LOW — Subscription cleanup gap
- Some screens use `useEffect` instead of `useFocusEffect`. If a screen is kept in the nav stack (not unmounted), the subscription runs even when off-screen.

---

## Uncommitted Changes (feat/tela-checklist)

### MEDIUM — New routes not registered in typed router
- `router.push('/relatorios' as any)`, `router.push('/checklists/${id}' as any)`, `router.push('/meus-veiculos' as any)`, `router.push('/notificacoes' as any)`, `router.push('/checklist/...' as any)`
- All use `as any` to bypass expo-router typed routes. This means no compile-time route validation.
- Fix: enable typed routes and add these routes to the generated types (or ensure `expo-router` picks them up automatically).

### MEDIUM — Two unrun backfill scripts
- `scripts/backfill-pendencia-checklist.mjs` and `scripts/backfill-usuarios-busca.mjs` are new and have not been run against production Firestore.
- Risk: data inconsistency if screens depend on fields these scripts populate.

### LOW — `app/checklists/[id].tsx` completeness
- New screen for checklist detail + OS creation from checklist. Needs manual testing of the full flow.

---

## Dependency Risks

### MEDIUM — Native FCM module (`@react-native-firebase/messaging`)
- Does not work in Expo Go. Push notifications are fully disabled during development.
- The conditional `require()` guard in `notification.service.ts` prevents crashes but means FCM is never tested in Expo Go.

### LOW — Google Sign-In dead code
- `app/login.tsx` has 5 commented-out lines marked `// TODO: Google Sign-In — implementação futura`
- The `GoogleSignInButton` component (referenced in CLAUDE.md) may be unused. Dead code contributes to confusion.

---

## Test Coverage Gaps

### HIGH — Zero automated tests
- No Jest, Vitest, Detox, or any other test framework. No test files exist.
- Type checking (`tsc`) is the only automated correctness gate.

### HIGH — No Firestore rules tests
- Security rules (`firestore.rules`) have no automated test suite.
- Rules changes are deployed without verification, risk of access control regressions.

---

## TODO / FIXME Summary

| File | Line | Note |
|---|---|---|
| `types/index.ts` | 18 | Remove deprecated `AppUser.id` after Firestore migration |
| `services/auth.service.ts` | 70,89,123,138,157 | Stale REST API TODO stubs |
| `app/login.tsx` | 4,5,22,31,182 | Google Sign-In dead code |
| `services/os.service.ts` | 164 | `as any` cast on updates object |
