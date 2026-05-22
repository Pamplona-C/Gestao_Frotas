# STRUCTURE.md — Directory & File Structure

Generated: 2026-05-22 | Branch: feat/tela-checklist

---

## Directory Tree

```
frotaAtiva/
├── app/                          # expo-router screens (file-based nav)
│   ├── _layout.tsx               # Root Stack + PaperProvider + useAuthListener
│   ├── index.tsx                 # Loading spinner → redirect to /login or /(tabs)
│   ├── login.tsx                 # Email/password auth
│   ├── novo-usuario.tsx          # Gestor: create condutor accounts
│   ├── notificacoes.tsx          # Notification list screen
│   ├── relatorios.tsx            # [NEW] Checklist/vínculo reports (gestor)
│   ├── modal.tsx                 # Generic modal placeholder
│   ├── perfil.tsx                # User profile (standalone, vs tab version)
│   ├── meus-veiculos.tsx         # Condutor vehicle list (standalone route)
│   ├── catalogo-servicos.tsx     # Gestor: manage service catalog
│   ├── (tabs)/                   # Bottom tab navigation
│   │   ├── _layout.tsx           # Role-based tab definitions
│   │   ├── index.tsx             # Home (CondutorHome | GestorDashboard)
│   │   ├── veiculos.tsx          # Gestor: vehicle list + detail bottom sheet
│   │   ├── meus-veiculos.tsx     # Condutor: my linked vehicles
│   │   ├── fornecedores.tsx      # Gestor: supplier list
│   │   ├── profile.tsx           # User profile tab
│   │   └── configuracoes.tsx     # Settings tab
│   ├── nova-os/                  # 6-step OS creation flow
│   │   ├── _layout.tsx
│   │   ├── etapa-1.tsx … etapa-6.tsx
│   ├── os/                       # OS detail routes
│   │   ├── _layout.tsx
│   │   └── [id]/
│   │       ├── _layout.tsx
│   │       ├── index.tsx         # OS detail (both roles)
│   │       └── gerenciar.tsx     # Gestor: assign supplier, change status, add note
│   ├── veiculo/
│   │   └── [id].tsx              # Vehicle detail + linked condutor + checklist history
│   ├── checklist/
│   │   └── [vinculoId]/
│   │       └── [tipo].tsx        # Condutor: fill checklist (entrada|saída)
│   └── checklists/
│       └── [id].tsx              # [NEW] Checklist detail view + create OS from checklist
│
├── components/                   # Shared UI components
│   ├── AccordionItem.tsx         # Expand/collapse with Reanimated; subitens=[] → checkbox
│   ├── BottomSheet.tsx           # [NEW] Reusable bottom sheet modal
│   ├── CidadeAutocomplete.tsx    # City search from static data/municipios.ts
│   ├── MetricCard.tsx            # Number + label surface card
│   ├── NotificationBell.tsx      # FCM notification badge button
│   ├── OSCard.tsx                # Pure render OS list card (no internal fetch)
│   ├── SemInternet.tsx           # Full-screen offline fallback
│   ├── SkeletonCard.tsx          # Loading skeleton with shimmer animation
│   ├── StatusBadge.tsx           # OS status pill with color from Colors.status
│   ├── StepperHeader.tsx         # 6-step progress indicator
│   └── Timeline.tsx              # 4-step OS status timeline
│
├── services/                     # Firebase data layer
│   ├── auth.service.ts           # Auth + user profile CRUD
│   ├── catalogo.service.ts       # Service catalog CRUD
│   ├── checklist.service.ts      # Checklist create + subscribe + reports
│   ├── fornecedor.service.ts     # Supplier CRUD
│   ├── notificacoes.service.ts   # In-app notifications subscribe + mark read
│   ├── notification.service.ts   # FCM token registration (native module guard)
│   ├── os.service.ts             # Work order subscriptions + CRUD + metrics
│   ├── storage.service.ts        # Firebase Storage photo upload
│   ├── usuarios.service.ts       # User search + list (gestor)
│   ├── veiculo.service.ts        # Vehicle CRUD + subscribe
│   └── vinculo.service.ts        # Condutor↔Veiculo link management
│
├── store/
│   ├── auth.store.ts             # Zustand: currentUser, loading, auth actions
│   ├── novaOS.store.ts           # Zustand: 6-step OS form state
│   └── notification.store.ts    # Zustand: FCM token
│
├── hooks/
│   ├── useAuthListener.ts        # onAuthStateChanged → setUser
│   ├── useConectividade.ts       # NetInfo → online: boolean
│   └── usePushNotifications.ts  # FCM token registration on mount
│
├── lib/
│   └── firebase.ts               # Singleton init: app, auth, db, storage
│
├── constants/
│   ├── colors.ts                 # Design tokens: Colors.primary, Colors.status[status]
│   └── servicosCategorias.ts    # Predefined OS service categories with subitems
│
├── data/
│   └── municipios.ts             # Static Brazilian city list (~5000 cities)
│
├── types/
│   └── index.ts                  # All TypeScript types (AppUser, OrdemServico, Vinculo, etc.)
│
├── functions/
│   └── src/
│       └── index.ts              # Cloud Functions v2 (4 triggers)
│
├── scripts/
│   ├── backfill-pendencia-checklist.mjs   # [NEW] One-time backfill
│   ├── backfill-usuarios-busca.mjs        # [NEW] One-time backfill
│   ├── seed-firebase.mjs
│   └── listar-placas.mjs
│
├── firestore.rules               # Firestore security rules
├── CLAUDE.md                     # Codebase guidance for Claude Code
└── package.json
```

---

## Firestore Collections & Types

| Collection | TypeScript Type | Key Fields |
|---|---|---|
| `usuarios/{uid}` | `UserProfile` | nome, email, perfil, departamento, fcmToken, nomeBusca |
| `ordens-servico/{id}` | `OrdemServico` | condutorId, veiculoId, status, frota, criadoEm, gestorId |
| `fornecedores/{id}` | `Fornecedor` | nome, cidade, telefone, responsavel |
| `veiculos/{id}` | `Veiculo` | marca, modelo, frota, placa, tipo, departamento, ativo |
| `vinculos/{id}` | `Vinculo` | condutorId, veiculoId, status, pendenciaChecklist, checklistEntradaId/SaidaId |
| `checklists/{id}` | `Checklist` | tipo, vinculoId, condutorId, veiculoId, fotos, completadoEm |
| `notificacoes/{id}` | `Notificacao` | userId, type, osId, read, expiresAt |
| `catalogo-servicos/{id}` | `CatalogoServico` | nome, tipo, ativo |

---

## Routing Reference

| Route | Screen | Roles |
|---|---|---|
| `/` | index.tsx | all |
| `/login` | login.tsx | unauthenticated |
| `/(tabs)` | index.tsx (Home) | all |
| `/(tabs)/veiculos` | veiculos.tsx | gestor |
| `/(tabs)/meus-veiculos` | meus-veiculos.tsx | condutor |
| `/(tabs)/fornecedores` | fornecedores.tsx | gestor |
| `/(tabs)/configuracoes` | configuracoes.tsx | all |
| `/(tabs)/profile` | profile.tsx | all |
| `/nova-os/etapa-[1-6]` | etapa-N.tsx | condutor |
| `/os/[id]` | os/[id]/index.tsx | all |
| `/os/[id]/gerenciar` | os/[id]/gerenciar.tsx | gestor |
| `/veiculo/[id]` | veiculo/[id].tsx | gestor |
| `/checklist/[vinculoId]/[tipo]` | checklist/[vinculoId]/[tipo].tsx | condutor |
| `/checklists/[id]` | checklists/[id].tsx | all (NEW) |
| `/relatorios` | relatorios.tsx | gestor (NEW) |
| `/catalogo-servicos` | catalogo-servicos.tsx | gestor |
| `/notificacoes` | notificacoes.tsx | all |
| `/novo-usuario` | novo-usuario.tsx | gestor |

---

## Where to Add New Features

| Need | Location |
|---|---|
| New screen | `app/[route].tsx` or `app/(tabs)/[name].tsx` |
| New Firestore collection operations | `services/[nome].service.ts` |
| New shared UI component | `components/[Nome].tsx` |
| New global state | `store/[nome].store.ts` |
| New type | `types/index.ts` |
| New Cloud Function | `functions/src/index.ts` |
| New design color | `constants/colors.ts` |
