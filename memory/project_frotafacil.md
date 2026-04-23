---
name: FrotaAtiva project context
description: Tech stack, mock-only architecture, and scope for the FrotaAtiva fleet maintenance app
type: project
---

FrotaAtiva is a fleet vehicle maintenance management app built as a UI-only prototype with mocked data — no backend, no API calls.

**Why:** Brazilian company needs a mobile app for conductors to open service orders (OS) and gestors to manage them.

**How to apply:** All data comes from `mocks/` via `services/`. Never introduce real API calls; add `// TODO: replace with api.get(...)` comments at every fetch point instead.

Stack: Expo SDK 54 · expo-router v6 · TypeScript · react-native-paper (MD3) · Zustand (auth + nova OS form) · react-hook-form + zod · date-fns/ptBR · react-native-reanimated (accordion).
