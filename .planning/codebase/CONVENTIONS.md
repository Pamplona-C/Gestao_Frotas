# CONVENTIONS.md — Code Conventions & Patterns

Generated: 2026-05-22 | Branch: feat/tela-checklist

---

## TypeScript

- **strict mode** enabled via `expo/tsconfig.base` + `"strict": true`
- Path alias `@/*` mapped to root, but codebase uses **relative imports** in practice (`../../`)
- Types defined centrally in `types/index.ts` — all Firestore document shapes live there
- `Unsubscribe` type imported from `firebase/firestore` for subscription return types
- Minimal `as any` usage — flagged as a concern when it appears
- `DocumentData` used only inside service helpers before mapping to typed shapes

## Component Patterns

- All components are **functional + hooks** — no class components
- `React.memo()` wraps list-item components (`OSCard`, `SkeletonCard`) for render performance
- **react-native-paper MD3** is the design system:
  - `Surface`, `Text` (with `variant=`), `TextInput`, `Button`, `FAB`, `Chip`
  - `useTheme()` used for dynamic color access
  - Custom colors via `constants/colors.ts` and `Colors.status[status].{bg,text}`
- **SafeAreaView** from `react-native-safe-area-context` wraps all screens
- `Ionicons` from `@expo/vector-icons` for icons throughout

## Form Patterns

- **react-hook-form** + **zod** for all forms
- `useForm<T>({ resolver: zodResolver(schema) })` pattern
- `@hookform/resolvers/zod` for the bridge
- Validation schemas colocated near their form screens
- `Controller` component for Paper's `TextInput` integration

## Service Layer Patterns

### Real-time subscriptions
```ts
export function subscribeToX(callback: (items: X[]) => void): Unsubscribe {
  const q = query(collection(db, 'collection-name'), where(...));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => docToX(d.id, d.data()));
    callback(items);
  });
}
```
- Always return `Unsubscribe` from Firebase
- Screens call inside `useFocusEffect` (subscribe on focus, cleanup on blur)
- Home screen uses `useEffect` for permanent listener

### One-shot reads
```ts
const snap = await getDocs(q);
```
Used for non-reactive data (e.g., looking up a single doc before navigation).

### Firestore write pattern — strip undefined
```ts
const clean = Object.fromEntries(
  Object.entries(payload).filter(([, v]) => v !== undefined)
);
await addDoc(collection(db, 'col'), clean);
```
Firestore rejects `undefined` values — always strip before writes.

### Client-side sort (no composite index)
```ts
// where('status', 'in', [...]) + orderBy on another field = composite index required
// Instead: omit orderBy, sort client-side
const sorted = items.sort(byDate);
```

### Document mapping helpers
Each service defines a `docToX(id, data)` helper that converts raw `DocumentData` to typed shape, handling Firestore `Timestamp → ISO string` conversion.

## Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Screen files | kebab-case | `etapa-1.tsx`, `gerenciar.tsx` |
| Component files | PascalCase | `OSCard.tsx`, `StatusBadge.tsx` |
| Service files | camelCase + `.service.ts` | `os.service.ts`, `checklist.service.ts` |
| Store files | camelCase + `.store.ts` | `auth.store.ts`, `novaOS.store.ts` |
| Hook files | camelCase + `use` prefix | `useAuthListener.ts`, `useConectividade.ts` |
| Types | PascalCase | `OrdemServico`, `Fornecedor`, `Vinculo` |
| Firestore collections | kebab-case plural | `ordens-servico`, `veiculos`, `vinculos` |
| Zustand store hooks | `use` + PascalCase + `Store` | `useAuthStore`, `useNovaOSStore` |

## Brazilian Portuguese

- All UI text, labels, error messages, and comments are in **pt-BR**
- Dates formatted with `date-fns` + `ptBR` locale: `format(date, "dd 'de' MMM", { locale: ptBR })`
- Currency: `value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })`
- Status values are Portuguese strings: `'nova'`, `'em_andamento'`, `'em_diagnostico'`, etc.

## Screen Structure Pattern

```tsx
export default function MyScreen() {
  const { currentUser } = useAuthStore();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    const unsub = subscribeToX((items) => {
      setData(items);
      setLoading(false);
    });
    return unsub;
  }, []));

  if (loading) return <ActivityIndicator />;
  return <SafeAreaView>...</SafeAreaView>;
}
```

## Styles

- `StyleSheet.create()` at the bottom of each file
- No styled-components or CSS-in-JS libraries
- Colors always from `constants/colors.ts` — no inline hex values
- Spacing is ad-hoc (no design token system for spacing yet)
