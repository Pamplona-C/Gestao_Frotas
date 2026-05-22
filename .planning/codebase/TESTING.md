# TESTING.md — Testing & Quality Tooling

Generated: 2026-05-22 | Branch: feat/tela-checklist

---

## Test Infrastructure

**No test runner is configured.** The project has no Jest, Vitest, or any other testing framework installed. There are no test files (`.test.ts`, `.spec.ts`) anywhere in the codebase.

This is a known gap — see CONCERNS.md.

## Quality Commands

```bash
npm run lint         # ESLint via expo lint (eslint-config-expo)
npx tsc --noEmit     # TypeScript type check — primary correctness gate
```

## Linting

- **ESLint** via `expo lint` — uses `eslint-config-expo` preset
- Config file: check for `.eslintrc.js` or `eslint.config.js` in root
- No custom rules beyond expo defaults
- Run before committing to catch common issues

## Type Checking

- **TypeScript strict mode** is the primary static correctness tool
- `npx tsc --noEmit` — runs full type check without emitting files
- Catches: type mismatches, missing properties, null safety violations
- Does NOT catch: runtime Firestore schema mismatches, logic errors, UI rendering issues

## Current Validation Approach

Without automated tests, the team validates changes by:

1. `npx tsc --noEmit` — type safety
2. `npm run lint` — lint rules
3. Manual testing in Expo Go or simulator (`npm start` / `npm run ios`)
4. Firebase Emulator for local Firestore/Functions testing (optional)

## Firestore Rules

- Rules are in `firestore.rules`
- No automated test suite for rules (e.g., `@firebase/rules-unit-testing`)
- Rules are deployed manually via Firebase Console or `firebase deploy --only firestore:rules`

## Scripts

| Script | Purpose |
|---|---|
| `npm start` | Start Expo dev server |
| `npm run ios` | Run on iOS simulator |
| `npm run android` | Run on Android emulator |
| `npm run web` | Run in browser (PWA preview) |
| `npm run lint` | ESLint check |
| `scripts/backfill-*.mjs` | One-time Firestore backfill scripts (run manually) |

## Coverage Gaps

| Area | Gap | Risk |
|---|---|---|
| Unit tests | Zero tests | HIGH — logic errors go undetected |
| Integration tests | No Firestore emulator tests | HIGH — rules and service logic untested |
| Component tests | No render tests | MEDIUM — UI regressions undetected |
| E2E tests | No Detox or Maestro setup | MEDIUM — user flows untested |
| Firestore rules tests | No `@firebase/rules-unit-testing` | HIGH — security rules unverified |
| Cloud Functions tests | No function unit tests | MEDIUM — trigger logic untested |
