# FrotaAtiva — Casos de Uso e Fluxos Completos

> Atualizado: 2026-05-21

---

## Perfis de usuário

| Perfil | Acesso | Como promover |
|--------|--------|---------------|
| `condutor` | Home, Meus Veículos, Nova OS, Perfil | Padrão na criação |
| `gestor` | Tudo + Veículos, Fornecedores, Gerenciar OS | Alterar `perfil` no Firestore Console |

O gestor pode criar novas contas de condutor via **Novo Usuário** (`app/novo-usuario.tsx`). A senha temporária gerada usa uma instância Firebase secundária para não deslogar o gestor.

---

## Autenticação

### Login (ambos os perfis)
1. Usuário informa e-mail + senha → Firebase Auth.
2. `onAuthStateChanged` chama `buildAppUser`: busca perfil em `usuarios/{uid}`; se não existir, cria stub com `perfil = 'condutor'`.
3. `app/index.tsx` redireciona para `/(tabs)` (autenticado) ou `/login`.
4. Google Sign-In disponível apenas em builds nativos (não no Expo Go). Requer as três variáveis `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`.

### Persistência
- Firebase usa `inMemoryPersistence` → usuário precisa relogar após reiniciar o app no Expo Go.
- Builds nativos podem trocar para AsyncStorage.

---

## Condutor

### UC-C1 · Meus Veículos (`app/meus-veiculos.tsx`)

**Pré-condição:** Gestor vinculou o condutor a um veículo.

Exibe vínculos filtrando:
```
status === 'ativo'  
OU  
status === 'inativo' && !checklistSaidaId
```

| Estado do vínculo | Label exibido | Ação disponível |
|---|---|---|
| `ativo`, sem `checklistEntradaId` | Checklist de entrada pendente 🟡 | Botão "Fazer checklist de entrada" |
| `ativo`, com `checklistEntradaId`, sem `checklistSaidaId` | Em uso 🟢 | Botão "Fazer checklist de saída" |
| `inativo`, sem `checklistSaidaId` | Checklist de saída pendente 🔵 | Botão "Fazer checklist de saída" |

Quando `checklistSaidaId` é preenchido, o vínculo some da lista automaticamente.

---

### UC-C2 · Checklist de Entrada (`app/checklist/[vinculoId]/entrada`)

**Pré-condição:** Vínculo ativo sem `checklistEntradaId`.

1. Condutor toca "Fazer checklist de entrada".
2. Tela exibe grade de ângulos fotográficos baseada no **tipo do veículo**:
   - **Carro** (20 fotos): frente, traseira, laterais dianteiras/traseiras E/D, lanternas, faróis, bancos, bancos+painel, hodômetro, kit estepe, motor, pneus, cartão/documentos.
   - **Moto** (6 fotos): lateral direita, lateral esquerda, farol, motor, cartão de abastecimento, nota fiscal.
3. Para cada ângulo: câmera ou galeria. Fotos são comprimidas (max 1280px, JPEG 65%) antes do upload.
4. Campo de observações (opcional).
5. "Concluir checklist" habilitado apenas quando **todos** os ângulos têm foto.
6. Ao confirmar:
   - Fotos são enviadas para `checklists/{vinculoId}/entrada/` no Storage.
   - Documento criado em `checklists/{id}` (Firestore).
   - `vinculos/{vinculoId}.checklistEntradaId` atualizado.
   - O condutor pode agora abrir Ordens de Serviço.

---

### UC-C3 · Nova OS — 6 etapas (`app/nova-os/`)

**Pré-condição:** Vínculo `ativo` **com** `checklistEntradaId` (veículo em uso).

| Etapa | Tela | Campo(s) |
|---|---|---|
| 1 | `etapa-1.tsx` | Selecionar veículo vinculado, hodômetro (opcional), cidade |
| 2 | `etapa-2.tsx` | Data desejada de atendimento, horário |
| 3 | `etapa-3.tsx` | Serviços (categorias predefinidas em `constants/servicosCategorias.ts`) |
| 4 | `etapa-4.tsx` | Descrição do problema (texto livre) |
| 5 | `etapa-5.tsx` | Fotos do problema (opcional) |
| 6 | `etapa-6.tsx` | Revisão + envio |

Estado persistido no Zustand (`novaOS.store`). Se o app sair e voltar, store é mantido até `reset()`.

Na etapa 6, a OS é criada em `ordens-servico/{id}` com status `nova`. Ao concluir, o store é resetado e o condutor retorna para a home.

**Guarda de conectividade:** todas as etapas exibem `<SemInternet />` quando offline.

---

### UC-C4 · Checklist de Saída — Condutor (`app/checklist/[vinculoId]/saida`)

**Pré-condição:** Vínculo `ativo` com `checklistEntradaId`, sem `checklistSaidaId`.

Fluxo idêntico ao de entrada (mesma tela, `tipo = 'saida'`). Ao concluir:
- Fotos enviadas para `checklists/{vinculoId}/saida/`.
- Documento criado em `checklists/{id}`.
- `vinculos/{vinculoId}.checklistSaidaId` atualizado.
- Se o vínculo ainda estiver `ativo`, `encerrarVinculo` é chamado (status → `inativo`, `encerradoEm` preenchido).
- O carro desaparece da lista "Meus Veículos" do condutor.

---

### UC-C5 · Home do Condutor (`app/(tabs)/index.tsx`)

- Lista de OSs ativas do condutor (status `nova | em_andamento | em_diagnostico | orcamento_aprovado`).
- Cada card mostra status, frota, data de criação, fornecedor atribuído (se houver).
- Toque no card abre detalhe da OS.
- Botão flutuante "Nova OS" (desabilitado se não houver veículo com entrada feita).

---

### UC-C6 · Detalhe da OS — Condutor (`app/os/[id]/index.tsx`)

- Exibe dados completos: veículo, serviços, descrição, fotos, status atual.
- Timeline de 4 passos derivada do campo `status`.
- Somente leitura para o condutor (sem edição).

---

## Gestor

### UC-G1 · Dashboard (`app/(tabs)/index.tsx` — GestorDashboard)

- Cards de métricas: OSs abertas, em andamento, aguardando diagnóstico.
- Lista de todas as OSs ativas (mesmo filtro de status do condutor).
- Toque em uma OS abre o detalhe + botão "Gerenciar".

---

### UC-G2 · Gerenciar OS (`app/os/[id]/gerenciar.tsx`)

- Atribuir fornecedor (seleciona da coleção `fornecedores`).
- Mudar status: `nova → em_andamento → em_diagnostico → orcamento_aprovado → concluida`.
- Adicionar nota interna.
- Registrar serviços realizados (catálogo de serviços + valor).
- Ao salvar: Firestore atualizado. Cloud Function `onOSStatusUpdated` notifica o condutor via FCM.

---

### UC-G3 · Veículos (`app/(tabs)/veiculos.tsx`)

Lista todos os veículos da frota. Toque em um card abre um **bottom sheet** com ações:

| Ação | Comportamento |
|------|---------------|
| **Editar** | Abre formulário bottom sheet (marca, modelo, frota, placa, ano, km) |
| **Vínculos** | Navega para `app/veiculo/[id].tsx` |
| **Excluir** | Confirmação → desativa o veículo (`ativo = false`) |

Busca por texto filtra marca, modelo, frota e placa. Skeleton loader durante carregamento.

---

### UC-G4 · Detalhe do Veículo (`app/veiculo/[id].tsx`)

#### Seção: Condutor vinculado

- Se nenhum vínculo ativo: botão "Vincular" habilitado.
- Se há vínculo ativo: botão "Vincular" desabilitado; card mostra nome + status (Pendente entrada / Em uso).
  - Ícone de desvincular disponível no card → confirma e chama `encerrarVinculo`.

#### Seção: Checklists de saída pendentes

Vínculos `inativo` sem `checklistSaidaId` aparecem aqui com borda laranja e botão **"Fazer saída"**.  
→ O gestor pode fazer o checklist de saída em nome do condutor (caso de condutor demitido/inacessível).

#### Seção: Vínculos encerrados

Vínculos `inativo` **com** `checklistSaidaId` listados em opacidade reduzida (histórico).

---

### UC-G5 · Vincular Condutor

1. Gestor abre detalhe do veículo, toca "Vincular".
2. Modal lista condutores **não vinculados ativamente** (todos os condutores da coleção menos os que já têm vínculo ativo com algum veículo).
3. Gestor seleciona condutor → `createVinculo` é chamado.
   - **Guarda dupla:** UI (botão desabilitado se já há vínculo ativo) + serviço (query Firestore verifica antes de gravar).
4. Firestore cria documento em `vinculos/{id}` com `status: 'ativo'`.
5. Cloud Function `onVinculoCriado` dispara notificação FCM ao condutor:  
   *"Veículo vinculado — {Marca Modelo} (Frota X) foi vinculado a você. Faça o checklist de entrada para começar."*

---

### UC-G6 · Desvincular Condutor (troca forçada)

1. Gestor toca ícone de desvincular no card do condutor ativo.
2. Confirmação → `encerrarVinculo(v.id)`: status → `inativo`, `encerradoEm` preenchido.
3. O veículo fica **livre para receber novo condutor imediatamente**.
4. O vínculo antigo, sem `checklistSaidaId`, aparece na seção "Checklists de saída pendentes" do detalhe do veículo.
5. O condutor antigo ainda vê o carro em "Meus Veículos" com o status "Checklist de saída pendente".

**Cenário — condutor demitido:** o gestor faz o checklist de saída pelo detalhe do veículo. Ao concluir, `checklistSaidaId` é preenchido e o carro some da lista do condutor antigo.

---

### UC-G7 · Checklist de Saída — Gestor (`app/checklist/[vinculoId]/saida`)

Mesma tela do condutor. A tela carrega o vínculo diretamente por ID (`getVinculoById`), então funciona para qualquer usuário autenticado que tenha o `vinculoId`.

Ao concluir:
- Fotos enviadas, documento criado em `checklists`.
- `vinculoId.checklistSaidaId` preenchido.
- `encerrarVinculo` **não** é chamado (vínculo já está `inativo`).

---

### UC-G8 · Fornecedores (`app/(tabs)/fornecedores.tsx`)

CRUD de fornecedores: nome, cidade, endereço, horário, responsável, telefone, link Google Maps (opcional). Skeleton loader durante carregamento.

---

## Ciclo de Vida do Vínculo

```
                     createVinculo
                          │
                    [status: ativo]
                    [checklistEntradaId: null]
                    [checklistSaidaId: null]
                          │
              ┌───────────┴───────────┐
              │                       │
     condutor faz                 gestor
     checklist entrada        desvincular agora
              │                       │
   [checklistEntradaId: id]     [status: inativo]
   (condutor pode abrir OS)    [encerradoEm: now]
              │                       │
     condutor ou gestor               │
     faz checklist saída        condutor/gestor
              │                 faz checklist saída
              │                       │
   [checklistSaidaId: id]      [checklistSaidaId: id]
   encerrarVinculo (se ativo)  (vínculo já inativo)
   [status: inativo]                  │
   [encerradoEm: now]          vínculo some das listas
              │
       vínculo encerrado
```

---

## Ciclo de Vida da OS

```
condutor cria OS → nova
                      ↓ gestor atribui fornecedor + avança
               em_andamento
                      ↓
              em_diagnostico
                      ↓
           orcamento_aprovado
                      ↓
                  concluida (sai de todas as listas ativas)
```

Notificações FCM ao condutor em cada mudança de status (`onOSStatusUpdated`).  
Notificação FCM a todos os gestores ao criar uma OS (`onOSCreated`).

---

## Notificações Push (FCM)

| Gatilho | Destinatário | Mensagem |
|---------|-------------|---------|
| `vinculos/{id}` criado | Condutor vinculado | "Veículo {Marca Modelo} (Frota X) foi vinculado a você." |
| `ordens-servico/{id}` criado | Todos os gestores | OS aberta, veículo e condutor |
| `ordens-servico/{id}` status mudou | Condutor da OS | Novo status |

FCM via `@react-native-firebase/messaging` (módulo nativo — não carrega no Expo Go). Token salvo em `usuarios/{uid}.fcmToken`. Tokens expirados são removidos automaticamente do Firestore quando FCM retorna erro permanente.

---

## Guards e Restrições

| Regra | Onde enforçado |
|-------|---------------|
| Um veículo só pode ter **um vínculo ativo** | UI (botão desabilitado) + `createVinculo` (query Firestore) |
| Só pode abrir OS com veículo **em uso** (entrada feita) | Etapa 1: filtra vínculos com `checklistEntradaId` |
| Botão "Concluir checklist" só ativa com **todas** as fotos | `feitos === total && total > 0` |
| `encerrarVinculo` na saída só se vínculo ainda `ativo` | `checklist.service.ts` verifica status antes de chamar |
| Checklist de saída acessível por **qualquer usuário autenticado** com `vinculoId` | `getVinculoById` por ID (não filtra por `condutorId`) |
| OSs concluídas saem de todas as listas | `ACTIVE_STATUSES` filter no serviço de OS |
| Offline → não pode abrir Nova OS | `<SemInternet />` nas 6 etapas |

---

## Coleções Firestore

| Coleção | Documentos principais |
|---------|-----------------------|
| `usuarios/{uid}` | nome, email, perfil, departamento, photoURL, fcmToken, ativo |
| `veiculos/{id}` | tipo, marca, modelo, frota, placa, ano, kmAtual, departamento, ativo |
| `vinculos/{id}` | condutorId, veiculoId, status, checklistEntradaId, checklistSaidaId, gestorId, criadoEm, encerradoEm |
| `checklists/{id}` | tipo, vinculoId, condutorId, veiculoId, veiculoTipo, fotos (map angulo→URL), observacoes, completadoEm |
| `ordens-servico/{id}` | veiculoId, condutorId, status, statusHistory, servicosRealizados, valorTotal, gastoPreventiva, gastoCorretiva, … |
| `fornecedores/{id}` | nome, cidade, endereco, horario, responsavel, telefone, googleMapsUrl |

---

## Storage Firebase

| Caminho | Conteúdo |
|---------|----------|
| `checklists/{vinculoId}/{tipo}/{timestamp}_{index}` | Fotos do checklist (comprimidas JPEG 65%, max 1280px) |
| `os-fotos/{osId}/{timestamp}_{index}` | Fotos da OS |
| `perfil-fotos/{uid}` | Foto de perfil (sobrescreve na troca) |
