# Contratos de Dados — FrotaAtiva

Este documento descreve os contratos usados pelo cliente, regras Firestore/Storage e Cloud Functions atuais.

## Enumerações

### `UserPerfil`

| Valor | Uso |
|---|---|
| `condutor` | Usuário que usa veículos, faz checklists e abre OS |
| `gestor` | Usuário com acesso administrativo |

### `VeiculoTipo`

| Valor | Uso |
|---|---|
| `carro` | Checklist com 20 fotos |
| `moto` | Checklist com 6 fotos |

### `VinculoStatus`

| Valor | Uso |
|---|---|
| `ativo` | Condutor está vinculado ao veículo |
| `inativo` | Vínculo encerrado ou troca forçada pelo gestor |

### `OSStatus`

| Valor | Descrição |
|---|---|
| `nova` | OS criada e aguardando análise |
| `em_andamento` | Atendimento iniciado |
| `em_diagnostico` | Veículo em diagnóstico |
| `orcamento_aprovado` | Orçamento aprovado |
| `concluida` | OS encerrada e removida das listas ativas |

`ACTIVE_STATUSES`: `nova`, `em_andamento`, `em_diagnostico`, `orcamento_aprovado`.

### `TipoServico`

| Valor | Uso |
|---|---|
| `preventiva` | Serviço preventivo |
| `corretiva` | Serviço corretivo |

### `Notificacao.type`

| Valor | Trigger |
|---|---|
| `os_criada` | OS criada, enviada para gestores |
| `status_atualizado` | Status da OS alterado, enviada ao condutor |
| `lembrete_os` | Lembrete diário de OS agendada |

## Coleções Firestore

### `usuarios/{uid}`

| Campo | Tipo | Obrigatório | Observação |
|---|---|---:|---|
| `nome` | `string` | Sim | Nome completo |
| `email` | `string` | Sim | Email de login |
| `perfil` | `UserPerfil` | Sim | Define permissões de UI e regras |
| `departamento` | `string` | Sim | Área do usuário |
| `photoURL` | `string \| null` | Não | Auth/Storage/Google |
| `fcmToken` | `string \| null` | Não | Atualizado pelo app nativo |
| `ativo` | `boolean` | Não | `false` bloqueia login |
| `criadoEm` | `Timestamp` | Sim na criação | `serverTimestamp()` |

Queries:

| Uso | Query |
|---|---|
| Perfil atual | `getDoc(usuarios/{uid})` |
| Condutores ativos | `where('perfil', '==', 'condutor')`, filtro client-side `ativo !== false` |
| Gestores para FCM | `where('perfil', '==', 'gestor').select('fcmToken')` |

### `veiculos/{id}`

| Campo | Tipo | Obrigatório |
|---|---|---:|
| `tipo` | `VeiculoTipo` | Sim |
| `marca` | `string` | Sim |
| `modelo` | `string` | Sim |
| `frota` | `string` | Sim |
| `placa` | `string` | Não |
| `ano` | `number` | Sim |
| `kmAtual` | `number` | Não |
| `departamento` | `string` | Sim |
| `ativo` | `boolean` | Sim |

Queries:

| Uso | Query |
|---|---|
| Assinatura/lista completa | `orderBy('frota')`, `limit(500)` |
| Paginação | `orderBy('frota')`, `startAfter(cursor)`, `limit(26)` |
| Busca por placa | `where('placa', 'in', [comHifen, semHifen])` |

### `vinculos/{id}`

| Campo | Tipo | Obrigatório | Observação |
|---|---|---:|---|
| `condutorId` | `string` | Sim | UID do condutor |
| `condutorNome` | `string` | Sim | Snapshot do nome |
| `veiculoId` | `string` | Sim | ID do veículo |
| `veiculoFrota` | `string` | Sim | Snapshot da frota |
| `veiculoModelo` | `string` | Sim | Snapshot do modelo |
| `veiculoMarca` | `string` | Sim | Snapshot da marca |
| `veiculoPlaca` | `string` | Não | Snapshot da placa |
| `veiculoTipo` | `VeiculoTipo` | Sim | Define checklist |
| `status` | `VinculoStatus` | Sim | `ativo` ou `inativo` |
| `checklistEntradaId` | `string` | Não | Preenchido após checklist de entrada |
| `checklistSaidaId` | `string` | Não | Preenchido após checklist de saída |
| `criadoEm` | `string` | Sim | ISO string |
| `gestorId` | `string` | Sim | UID do gestor que criou |
| `encerradoEm` | `string` | Não | ISO string |

Regras de negócio:

| Regra | Local |
|---|---|
| Um veículo só pode ter um vínculo ativo | `createVinculo()` consulta vínculo ativo antes de gravar |
| Checklist de saída encerra vínculo ativo | `checklist.service.ts` chama `encerrarVinculo()` se status ainda é `ativo` |
| Gestor pode encerrar vínculo manualmente | `app/veiculo/[id].tsx` |

### `checklists/{id}`

| Campo | Tipo | Obrigatório |
|---|---|---:|
| `tipo` | `'entrada' \| 'saida'` | Sim |
| `vinculoId` | `string` | Sim |
| `condutorId` | `string` | Sim |
| `veiculoId` | `string` | Sim |
| `veiculoTipo` | `VeiculoTipo` | Sim |
| `fotos` | `Record<string, string>` | Sim |
| `observacoes` | `string` | Não |
| `completadoEm` | `string` | Sim |

`fotos` mapeia o ID do ângulo para a URL do Storage.

Ângulos:

| Tipo | Quantidade | Fonte |
|---|---:|---|
| Carro | 20 | `CHECKLIST_ANGULOS_CARRO` |
| Moto | 6 | `CHECKLIST_ANGULOS_MOTO` |

### `ordens-servico/{id}`

| Campo | Tipo | Obrigatório | Observação |
|---|---|---:|---|
| `veiculoId` | `string` | Não | ID do veículo vinculado |
| `placa` | `string` | Não | Snapshot da placa |
| `frota` | `string` | Sim | Snapshot da frota |
| `condutorId` | `string` | Sim | UID do criador |
| `condutorNome` | `string` | Sim | Nome no momento da criação |
| `condutorPhotoURL` | `string \| null` | Não | Snapshot |
| `condutorDepartamento` | `string` | Não | Snapshot |
| `hodometro` | `number` | Não | Opcional para moto no fluxo atual |
| `servicos` | `string[]` | Não | Categorias estáticas selecionadas |
| `descricao` | `string` | Não | Texto livre |
| `fotos` | `string[]` | Não | URLs em `os-fotos` |
| `cidade` | `string` | Não | Cidade do atendimento |
| `dataDesejada` | `string` | Não | ISO string |
| `horario` | `string` | Não | Texto `HH:mm` |
| `observacoes` | `string` | Não | Observações de agendamento |
| `fornecedorId` | `string` | Não | Fornecedor escolhido |
| `notaInterna` | `string` | Não | Mensagem/nota do gestor |
| `status` | `OSStatus` | Sim | Começa como `nova` |
| `criadoEm` | `Timestamp` | Sim | `serverTimestamp()` |
| `statusHistory` | `StatusEntry[]` | Sim | Criado com primeira entrada |
| `gestorId` | `string` | Não | UID do gestor que salvou |
| `gestorNome` | `string` | Não | Snapshot |
| `gestorPhotoURL` | `string \| null` | Não | Snapshot |
| `gestorDepartamento` | `string` | Não | Snapshot |
| `servicosRealizados` | `ServicoRealizado[]` | Não | Serviços e valores |
| `valorTotal` | `number` | Não | Soma dos serviços |
| `gastoPreventiva` | `number` | Não | Soma preventiva |
| `gastoCorretiva` | `number` | Não | Soma corretiva |
| `lembreteEnviadoEm` | `Timestamp` | Não | Marcador do scheduler |

`StatusEntry`:

| Campo | Tipo |
|---|---|
| `status` | `OSStatus` |
| `changedAt` | `string` |
| `changedBy` | `string` |

`ServicoRealizado`:

| Campo | Tipo |
|---|---|
| `catalogoId` | `string` |
| `nome` | `string` |
| `tipo` | `TipoServico` |
| `valor` | `number` |

Queries:

| Uso | Query |
|---|---|
| Dashboard gestor | `where('status', 'in', ACTIVE_STATUSES)`, `limit(100)`, ordenação client-side |
| Home condutor | `where('condutorId', '==', uid)`, `where('status', 'in', ACTIVE_STATUSES)`, ordenação client-side |
| Detalhe | `onSnapshot(doc(...))` |

### `fornecedores/{id}`

| Campo | Tipo | Obrigatório |
|---|---|---:|
| `nome` | `string` | Sim |
| `cidade` | `string` | Sim |
| `endereco` | `string` | Sim |
| `horario` | `string` | Sim |
| `responsavel` | `string` | Sim |
| `telefone` | `string` | Sim |
| `googleMapsUrl` | `string` | Não |

Queries: `orderBy('nome')`, assinatura/lista com `limit(500)`, paginação de 25 itens.

### `catalogo-servicos/{id}`

| Campo | Tipo | Obrigatório |
|---|---|---:|
| `nome` | `string` | Sim |
| `tipo` | `TipoServico` | Sim |
| `ativo` | `boolean` | Sim |

O catálogo dinâmico é usado pelo gestor em `Gerenciar OS` para registrar serviços realizados. A abertura de OS pelo condutor usa categorias estáticas em `constants/servicosCategorias.ts`.

### `notificacoes/{id}`

| Campo | Tipo | Obrigatório |
|---|---|---:|
| `userId` | `string` | Sim |
| `type` | `Notificacao.type` | Sim |
| `title` | `string` | Sim |
| `body` | `string` | Sim |
| `osId` | `string` | Sim para notificações de OS |
| `createdAt` | `Timestamp` | Sim |
| `expiresAt` | `Timestamp` | Sim |
| `read` | `boolean` | Sim |

Observação: `onVinculoCriado` envia push, mas não persiste documento em `notificacoes` no código atual.

## Cloud Functions

> Seção revisada em 17/09/2026. Dez functions deployadas em `southamerica-east1`, Node 20,
> 512 MiB (1 vCPU). Nenhuma configura `retry`, então vale `RETRY_POLICY_DO_NOT_RETRY`: uma
> exceção não tratada **descarta o evento** e a notificação se perde.

### Nome do veículo nas mensagens

`nomeVeiculo(os)` é a fonte única de como um veículo é nomeado em notificação. Cascata:

```
veiculoModelo → placa → `Frota {frota}` → veiculoMarca → 'sem identificação'
```

Trata string vazia, só-espaços e o `'—'` que o app grava por padrão como ausência. Existe
porque o painel web omite `frota` quando o veículo não tem, e o texto saía como
`"Frota undefined"` no celular. Use o helper em vez de ler os campos direto.

### Inventário

| Function | Trigger | Destinatário | Grava em `notificacoes` |
|---|---|---|---|
| `onOSCreated` | create `ordens-servico/{id}` | todos os gestores com `fcmToken` | sim, `os_criada` |
| `onOSStatusUpdated` | update, `before.status !== after.status` | condutor da OS | sim, `status_atualizado` |
| `onVinculoCriado` | create `vinculos/{id}` | condutor (só o primeiro) | não |
| `onOSEntregueOficina` | update, passou a ter `entregueOficinaEm` | gestor responsável | sim |
| `onOSRetornoOficina` | update, passou a ter `retornouOficinaEm` | gestor responsável | sim |
| `onOSGastoOuOficinaUpdated` | update de gasto/oficina | — | não (recalcula métricas) |
| `onUsuarioDeleted` | delete `usuarios/{uid}` | — | não (apaga o usuário no Auth) |
| `enviarLembretesOS` | agendada, 07:00 BRT | condutor da OS agendada para hoje | sim, `lembrete_os` |
| `recalcularMetricasDiario` | agendada, 00:05 BRT | — | não (recalcula tudo do zero) |
| `recalcularMetricasManual` | callable (exige gestor) | — | não |

### Textos

O `title`/`body` de cada mensagem é montado na function e usado **duas vezes**: no payload FCM e
no documento de `notificacoes`. O app não reescreve nada — renderiza os campos como vieram. Mudar
o texto afeta só notificações novas; o histórico guarda o que foi enviado.

| Notificação | Título | Corpo |
|---|---|---|
| OS aberta | `Nova OS aguardando análise` | `Aberta por {condutorNome} · {placa}` |
| Status → nova | `Nova OS` | `OS do veículo {veiculo} foi aberta` |
| Status → em_andamento | `OS em andamento` | `Sua OS do veículo {veiculo} está sendo atendida` |
| Status → em_diagnostico | `OS em diagnóstico` | `Sua OS do veículo {veiculo} está em diagnóstico` |
| Status → orcamento_aprovado | `Orçamento aprovado` | `O orçamento da OS do veículo {veiculo} foi aprovado` |
| Status → concluida | `OS concluída` | `Sua OS do veículo {veiculo} foi concluída com sucesso` |
| Vínculo criado | `Veículo vinculado` | `{marca} {modelo} (Frota {frota}) foi vinculado a você. Faça o checklist de entrada para começar.` |
| Entregue na oficina | `Veículo entregue na oficina` | `{condutorNome} entregou o veículo {veiculo} na oficina` |
| Retorno da oficina | `Veículo retornou da oficina` | `{condutorNome} retirou o veículo {veiculo} da oficina` |
| Lembrete | `Lembrete de OS agendada` | `Sua OS do veículo {placa} está marcada para hoje. Não se esqueça de levar à oficina!` |

O payload leva sempre `data: { osId }`, que é o que o toque na notificação usa para abrir a OS —
o id saiu do texto, não do payload.

### Ordem dentro de `onOSCreated`

1. busca gestores com token
2. **se houver**: push + histórico
3. **sempre**: incrementa `metricas-frota/geral`, em `try/catch` próprio

O incremento fica por último e isolado de propósito: é um documento único e quente (limite de
~1 escrita por segundo), e o `recalcularMetricasDiario` reescreve tudo às 00:05 de qualquer forma.
Deixá-lo na frente colocava a notificação atrás de uma escrita disputada, e uma falha dele
derrubava o push. A etapa 2 é um bloco condicional, não um early return, para a etapa 3 rodar
mesmo quando nenhum gestor tem token.

### Concorrência

Function de evento processa **um evento por instância**. Cinco OS simultâneas sobem até cinco
contêineres **em paralelo**, não em fila — a latência total fica próxima à de uma única OS.
`maxInstanceCount` é 20.

### Pendências conhecidas

- `enviarLembretesOS` lê `os.condutorId` sem guarda; OS administrativa (aberta por gestor, sem
  condutor) faz o `Promise.all` rejeitar e pode deixar outras OS do dia sem lembrete.
- `onVinculoCriado` lê só `condutorId`; um 2º condutor adicionado depois não recebe push, porque
  não existe trigger de update em `vinculos`.
- `onOSCreated` usa `placa` cru no corpo — OS sem placa gera `"Aberta por Fulano · "`. Deveria
  usar `nomeVeiculo`.

## Storage

| Path | Origem | Regra |
|---|---|---|
| `os-fotos/{osId}/{timestamp}_{index}` | Etapa 6 da OS | Auth, imagem, < 10 MB |
| `checklists/{vinculoId}/{tipo}/{timestamp}_{index}` | Checklist | Auth, imagem, < 10 MB |
| `perfil-fotos/{uid}` | Perfil | Dono, imagem, < 5 MB |

## Regras Firestore

| Coleção | Read | Create | Update | Delete |
|---|---|---|---|---|
| `usuarios` | Dono ou gestor | Dono ou gestor | Dono ou gestor | Gestor |
| `ordens-servico` | Autenticado | Autenticado e `condutorId == uid` | Autenticado | Bloqueado |
| `fornecedores` | Autenticado | Gestor | Gestor | Gestor |
| `veiculos` | Autenticado | Gestor | Gestor | Gestor |
| `catalogo-servicos` | Autenticado | Gestor | Gestor | Gestor |
| `vinculos` | Gestor ou condutor dono | Gestor | Gestor ou condutor dono | Bloqueado |
| `checklists` | Autenticado | Autenticado e `condutorId == uid` | Bloqueado | Bloqueado |
| `notificacoes` | Dono | Bloqueado | Dono, só `read` | Bloqueado |

## Índices e Limites

Não há `firestore.indexes.json` no repositório.

| Área | Query atual | Observação |
|---|---|---|
| OS por condutor | `condutorId == uid` + `status in [...]` | Pode exigir índice composto no Firestore |
| Vínculo ativo por veículo | `veiculoId == id` + `status == ativo` | Pode exigir índice composto |
| Veículos | `orderBy('frota')` | Índice simples automático |
| Fornecedores | `orderBy('nome')` | Índice simples automático |
| Catálogo | `orderBy('nome')` | Índice simples automático |

Limites no cliente:

| Recurso | Limite |
|---|---:|
| OS ativas | 100 |
| Veículos em assinatura/lista completa | 500 |
| Fornecedores em assinatura/lista completa | 500 |
| Página de veículos/fornecedores | 25 |
| Fotos da OS | 5 |
| FCM multicast | 500 tokens por lote |
