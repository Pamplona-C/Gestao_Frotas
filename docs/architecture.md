# Arquitetura — FrotaAtiva

Documento alinhado com a estrutura atual do repositório.

## Visão Geral

O FrotaAtiva é um app mobile Expo/React Native para gestão de frota, vínculos entre condutores e veículos, checklists fotográficos e ordens de serviço de manutenção.

O app trabalha com dois perfis:

| Perfil | Responsabilidades |
|---|---|
| `condutor` | Visualizar veículos vinculados, fazer checklist de entrada/saída, abrir OS e acompanhar status |
| `gestor` | Gerenciar OS, veículos, fornecedores, vínculos, catálogo de serviços e criação de usuários |

O backend é Firebase: Auth, Firestore, Storage, Cloud Functions e FCM. O cliente acessa Firestore diretamente por services TypeScript, e as Cloud Functions cuidam das notificações push disparadas por eventos.

## Stack

| Camada | Tecnologia |
|---|---|
| Mobile | Expo SDK 54, React Native 0.81, React 19 |
| Linguagem | TypeScript 5.9 |
| Navegação | `expo-router` com `typedRoutes` |
| UI | `react-native-paper`, `@expo/vector-icons` |
| Estado global | Zustand |
| Formulários | `react-hook-form` + `zod` |
| Backend | Firebase Auth, Firestore, Storage |
| Push | `@react-native-firebase/messaging` + `expo-notifications` |
| Server-side | Firebase Cloud Functions v2 |
| Imagens | `expo-image-picker`, `expo-image-manipulator` |
| Rede | `@react-native-community/netinfo` |
| Build | EAS / Expo |

## Estrutura de Diretórios

```text
app/                    Rotas e telas do expo-router
app/(tabs)/             Abas principais: início/painel, veículos, fornecedores, configurações
app/nova-os/            Fluxo de abertura de OS em 6 etapas
app/os/[id]/            Detalhe e gerenciamento de OS
app/checklist/[...]/    Checklist fotográfico de entrada/saída
app/veiculo/[id].tsx    Detalhe do veículo e gestão de vínculos
components/             Componentes visuais reutilizáveis
constants/              Cores, tema, categorias de serviço e ângulos de checklist
data/                   Dados estáticos, como municípios
docs/                   Documentação do projeto
functions/              Cloud Functions Firebase
hooks/                  Hooks de auth, conectividade e push
lib/                    Inicialização Firebase e cache
mocks/                  Mocks legados/de apoio
services/               Camada de acesso a Firebase
store/                  Stores Zustand
types/                  Tipos TypeScript globais
```

## Navegação

Rotas principais:

```text
/                         Redireciona por autenticação
/login                    Login email/senha e Google Sign-In nativo
/(tabs)                   Home do condutor ou painel do gestor
/(tabs)/veiculos          Gestão de veículos, apenas gestor
/(tabs)/fornecedores      Gestão de fornecedores, apenas gestor
/(tabs)/configuracoes     Configurações e atalhos
/meus-veiculos            Lista de vínculos do condutor
/perfil                   Perfil e foto do usuário
/notificacoes             Histórico de notificações
/novo-usuario             Gestor cria usuário
/catalogo-servicos        Gestor gerencia catálogo dinâmico
/nova-os/etapa-1..6       Fluxo de abertura de OS
/os/[id]                  Detalhe da OS
/os/[id]/gerenciar        Gestão da OS
/veiculo/[id]             Detalhe do veículo e vínculos
/checklist/[vinculoId]/[tipo]  Checklist de entrada ou saída
```

`app/(tabs)/_layout.tsx` controla a visibilidade das abas:

| Aba | Condutor | Gestor |
|---|---:|---:|
| Início/Painel | Sim | Sim |
| Veículos | Não | Sim |
| Fornecedores | Não | Sim |
| Configurações | Sim | Sim |

Há rotas ocultas em tabs (`meus-veiculos`, `profile`) com `href: null`. A rota canônica de perfil exposta no stack é `/perfil`.

## Estado Global

| Store | Arquivo | Responsabilidade |
|---|---|---|
| Auth | `store/auth.store.ts` | Sessão, login/logout, usuário atual, foto de perfil |
| Nova OS | `store/novaOS.store.ts` | Estado temporário do wizard de OS |
| Notificação | `store/notification.store.ts` | Token FCM em memória |

O listener `hooks/useAuthListener.ts` observa `onAuthStateChanged`, monta o `AppUser` a partir de `usuarios/{uid}` e alimenta a store de autenticação.

## Services

| Service | Coleções/recursos | Responsabilidade |
|---|---|---|
| `auth.service.ts` | Auth, `usuarios` | Login, Google credential, criação de usuário sem derrubar sessão do gestor, troca de senha, foto |
| `usuarios.service.ts` | `usuarios` | Assinar condutores ativos |
| `veiculo.service.ts` | `veiculos` | CRUD, paginação, busca por placa, assinatura em tempo real ordenada por `frota` |
| `vinculo.service.ts` | `vinculos` | Criar/encerrar vínculo, consultar por condutor/veículo/ID |
| `checklist.service.ts` | `checklists`, `vinculos`, Storage | Criar checklist, subir fotos e atualizar vínculo |
| `os.service.ts` | `ordens-servico` | Criar, atualizar, assinar e calcular métricas de OS ativas |
| `fornecedor.service.ts` | `fornecedores` | CRUD, paginação, assinatura ordenada por nome |
| `catalogo.service.ts` | `catalogo-servicos` | CRUD e ativação/desativação de serviços |
| `storage.service.ts` | Storage | Upload/compressão de fotos de OS, checklist e perfil |
| `notification.service.ts` | FCM, `usuarios` | Registrar/renovar token FCM do device |
| `notificacoes.service.ts` | `notificacoes` | Histórico e marcação de leitura |

## Modelo de Domínio

O fluxo principal parte de um vínculo:

```text
gestor cria vinculo
  -> condutor faz checklist de entrada
  -> condutor pode abrir OS
  -> gestor gerencia OS
  -> condutor ou gestor faz checklist de saída
  -> vinculo fica inativo/encerrado
```

Coleções centrais:

| Coleção | Papel |
|---|---|
| `usuarios` | Perfil de usuário e token FCM |
| `veiculos` | Cadastro da frota |
| `vinculos` | Relação condutor-veículo e status dos checklists |
| `checklists` | Evidências fotográficas de entrada/saída |
| `ordens-servico` | Solicitações e gestão de manutenção |
| `fornecedores` | Oficinas/parceiros |
| `catalogo-servicos` | Serviços usados pelo gestor ao registrar custos |
| `notificacoes` | Histórico persistido de alertas |

## Fluxo de Nova OS

O wizard usa `store/novaOS.store.ts`:

| Etapa | Tela | Dados |
|---|---|---|
| 1 | `etapa-1.tsx` | Veículo vinculado com checklist de entrada, hodômetro, cidade |
| 2 | `etapa-2.tsx` | Serviços estáticos de `constants/servicosCategorias.ts` |
| 3 | `etapa-3.tsx` | Descrição e até 5 fotos |
| 4 | `etapa-4.tsx` | Data desejada, horário e observações |
| 5 | `etapa-5.tsx` | Revisão |
| 6 | `etapa-6.tsx` | Criação da OS e upload das fotos |

Na etapa 6, a OS é criada primeiro em `ordens-servico`. Se houver fotos, elas são enviadas para `os-fotos/{osId}/...` e depois a OS é atualizada com as URLs. Se o upload falhar, a OS permanece criada e a tela mostra estado `concluido_sem_fotos`.

## Backend Firebase

### Cloud Functions

| Function | Trigger | Efeito |
|---|---|---|
| `onOSCreated` | `ordens-servico/{id}` criado | Notifica todos os gestores com `fcmToken` e cria notificações `os_criada` |
| `onOSStatusUpdated` | `ordens-servico/{id}` atualizado | Se `status` mudou, notifica o condutor e cria notificação `status_atualizado` |
| `onVinculoCriado` | `vinculos/{id}` criado | Notifica o condutor que recebeu o veículo |
| `enviarLembretesOS` | Scheduler diário 07:00, `America/Sao_Paulo` | Notifica condutores de OS ativas com `dataDesejada` hoje |

As functions removem tokens FCM inválidos de `usuarios/{uid}.fcmToken`.

### Storage

| Path | Conteúdo | Limite regra |
|---|---|---|
| `os-fotos/{osId}/{filename}` | Fotos da OS | 10 MB, `image/*` |
| `checklists/{vinculoId}/{tipo}/{filename}` | Fotos de checklist | 10 MB, `image/*` |
| `perfil-fotos/{uid}` | Foto de perfil | 5 MB, `image/*`, somente dono |

Fotos de OS e checklist são comprimidas para JPEG com largura máxima de 1280px antes do upload.

## Regras de Segurança

Resumo de `firestore.rules`:

| Coleção | Leitura | Escrita |
|---|---|---|
| `usuarios` | Próprio usuário ou gestor | Próprio usuário ou gestor; delete só gestor |
| `ordens-servico` | Qualquer autenticado | Create: dono; update: qualquer autenticado |
| `fornecedores` | Qualquer autenticado | Somente gestor |
| `veiculos` | Qualquer autenticado | Somente gestor |
| `catalogo-servicos` | Qualquer autenticado | Somente gestor |
| `vinculos` | Gestor ou condutor do vínculo | Create: gestor; update: gestor ou condutor; delete bloqueado |
| `checklists` | Qualquer autenticado | Create: `condutorId == uid`; update/delete bloqueados |
| `notificacoes` | Dono da notificação | Update apenas do campo `read`; create/delete bloqueados no cliente |

Ponto de atenção: `ordens-servico` permite `update` para qualquer usuário autenticado. O app separa ações por UI, mas a regra ainda é permissiva.

## Limites Atuais

| Área | Limite |
|---|---|
| OS ativas | `limit(100)` em listagens/assinaturas |
| Veículos | `limit(500)` em assinatura/listagem completa; página de 25 |
| Fornecedores | `limit(500)` em assinatura/listagem completa; página de 25 |
| Fotos de OS | Até 5 no wizard |
| FCM multicast | Lotes de 500 tokens |
| Notificações | `expiresAt` em 90 dias; limpeza depende de TTL/configuração externa |

## Débitos Técnicos Observados

| Item | Impacto |
|---|---|
| Regras de update de OS permissivas | Qualquer autenticado pode alterar qualquer OS via cliente customizado |
| Sem suite de testes configurada | Validação depende de lint/manual |
| `mocks/` ainda existe | Pode confundir com fonte de verdade atual |
| Duplicidade de `meus-veiculos` | Existe rota raiz e rota oculta em tabs com comportamento não idêntico |
| Auth com persistência em memória | No Expo Go o usuário precisa logar novamente após restart |
| Índices compostos não versionados | Não há `firestore.indexes.json`; queries com múltiplos filtros podem exigir configuração manual |
