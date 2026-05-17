# Contratos de Dados — FrotaAtiva

## 1. Visão Geral

Este documento descreve os contratos de dados do FrotaAtiva: schemas das coleções Firestore, estrutura das Cloud Functions, payloads FCM e enumerações do sistema. Complementa `docs/architecture.md`, que cobre stack tecnológica, navegação e padrões de arquitetura — informações não repetidas aqui.

---

## 2. Enumerações e Constantes do Sistema

**OSStatus**

| Valor | Descrição |
|-------|-----------|
| `nova` | OS recém-aberta pelo condutor, aguardando análise do gestor |
| `em_andamento` | OS aceita e em atendimento na oficina |
| `em_diagnostico` | Veículo em diagnóstico técnico |
| `orcamento_aprovado` | Orçamento aprovado pelo gestor, serviço autorizado |
| `concluida` | OS encerrada (excluída de todas as queries ativas) |

> `ACTIVE_STATUSES = ['nova', 'em_andamento', 'em_diagnostico', 'orcamento_aprovado']` — definido em `services/os.service.ts` e replicado em `functions/src/index.ts`.

---

**UserPerfil**

| Valor | Descrição |
|-------|-----------|
| `condutor` | Perfil padrão atribuído na criação da conta; abre OS e acompanha o status |
| `gestor` | Perfil com acesso total; gerencia OS, veículos, fornecedores e usuários |

---

**TipoServico**

| Valor | Descrição |
|-------|-----------|
| `preventiva` | Serviço de manutenção preventiva |
| `corretiva` | Serviço de manutenção corretiva (reparo de defeito) |

---

**Tipo de Notificação (`Notificacao.type`)**

| Valor | Descrição |
|-------|-----------|
| `os_criada` | OS criada pelo condutor — enviada aos gestores |
| `status_atualizado` | Status da OS alterado — enviada ao condutor da OS |
| `lembrete_os` | Lembrete diário quando a `dataDesejada` da OS coincide com o dia atual |

---

**Categorias de Serviço (estáticas, `constants/servicosCategorias.ts`)**

| ID | Label | Subitens |
|----|-------|---------|
| `alin` | Alinhamento/balanceamento | — |
| `farol` | Farol/Lanterna | Farol dianteiro, Lanterna traseira, Pisca-alerta |
| `freios` | Freios | Pastilha, Disco, Fluido de freio, ABS |
| `ar` | Ar condicionado | Não resfria, Ruído, Vazamento, Mau cheiro |
| `direcao` | Direção e suspensão | Direção elétrica, Amortecedor, Barra estabilizadora |
| `embreagem` | Embreagem e caixa de marcha | Embreagem, Câmbio manual, Câmbio automático |
| `lataria` | Lataria avariada | Amassado, Arranhão, Oxidação |
| `pneus` | Pneus e rodas | Troca de pneu, Furo, Roda amassada |
| `vidros` | Vidros e espelhos | Para-brisa, Vidro lateral, Retrovisor |
| `interior` | Interior e acessórios | Bancos, Painel, Som/elétrica |

> Estas categorias são estáticas e usadas no formulário multi-etapas de criação de OS (etapa 3). Não correspondem à coleção `catalogo-servicos`, que é dinâmica e gerenciada por gestores.

---

## 3. Schemas das Coleções Firestore

---

**Coleção:** `usuarios`
**Caminho:** `usuarios/{uid}`

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `nome` | `string` | Sim | Nome completo do usuário |
| `email` | `string` | Sim | Endereço de e-mail |
| `perfil` | `UserPerfil` | Sim | `'condutor'` ou `'gestor'` |
| `departamento` | `string` | Sim | Departamento ao qual o usuário pertence |
| `photoURL` | `string \| null` | Não | URL da foto de perfil (Storage ou Google) |
| `fcmToken` | `string \| null` | Não | Token FCM do dispositivo; atualizado automaticamente pelo app; removido pelas Cloud Functions quando inválido |
| `ativo` | `boolean` | Não | Se `false`, o login é bloqueado em `buildAppUser`; ausência implica ativo |
| `criadoEm` | `Timestamp` | Sim (escrito em criação) | Data de criação do perfil; escrito via `serverTimestamp()` |

**Regras de acesso:**
- Leitura: o próprio usuário (`isOwner`) ou qualquer gestor (`isGestor`)
- Criação: o próprio usuário ou qualquer gestor
- Atualização: o próprio usuário ou qualquer gestor
- Exclusão: somente gestores

**Queries utilizadas pelo app:**
- Leitura por UID: `getDoc(doc(db, 'usuarios', uid))` — em `auth.service.ts`
- Atualização de `photoURL`: `updateDoc` em `auth.service.ts`
- Atualização de `fcmToken`: `updateDoc` em `notification.service.ts`
- Busca de gestores com token (Cloud Function): `where('perfil', '==', 'gestor').select('fcmToken')`

---

**Coleção:** `ordens-servico`
**Caminho:** `ordens-servico/{id}`

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `placa` | `string` | Sim | Placa do veículo |
| `frota` | `string` | Sim | Número de frota do veículo |
| `condutorId` | `string` | Sim | UID do condutor que abriu a OS (`usuarios/{uid}`) |
| `condutorNome` | `string` | Sim | Nome do condutor no momento da criação |
| `hodometro` | `number` | Sim | Hodômetro registrado na abertura |
| `status` | `OSStatus` | Sim | Status atual da OS |
| `criadoEm` | `Timestamp` | Sim | Data de criação; escrito via `serverTimestamp()` |
| `statusHistory` | `StatusEntry[]` | Sim (mínimo 1) | Histórico de mudanças de status (ver sub-schema abaixo) |
| `servicos` | `string[]` | Não | IDs das categorias estáticas selecionadas no formulário |
| `descricao` | `string` | Não | Descrição livre do problema relatado pelo condutor |
| `fotos` | `string[]` | Não | URLs das fotos no Firebase Storage (`os-fotos/{osId}/...`) |
| `cidade` | `string` | Não | Cidade do veículo no momento da abertura |
| `dataDesejada` | `string` | Não | Data desejada para atendimento (ISO string) |
| `horario` | `string` | Não | Horário desejado para atendimento |
| `fornecedorId` | `string` | Não | ID do fornecedor atribuído pelo gestor (`fornecedores/{id}`) |
| `notaInterna` | `string` | Não | Nota interna do gestor (visível ao condutor) |
| `observacoes` | `string` | Não | Observações adicionais |
| `condutorPhotoURL` | `string \| null` | Não | URL da foto de perfil do condutor no momento da criação |
| `condutorDepartamento` | `string` | Não | Departamento do condutor |
| `gestorId` | `string` | Não | UID do gestor que gerenciou a OS |
| `gestorNome` | `string` | Não | Nome do gestor |
| `gestorPhotoURL` | `string \| null` | Não | URL da foto de perfil do gestor |
| `gestorDepartamento` | `string` | Não | Departamento do gestor |
| `servicosRealizados` | `ServicoRealizado[]` | Não | Serviços confirmados pelo gestor (ver sub-schema abaixo) |
| `valorTotal` | `number` | Não | Soma dos valores de `servicosRealizados` |
| `gastoPreventiva` | `number` | Não | Soma dos valores de serviços de tipo `preventiva` |
| `gastoCorretiva` | `number` | Não | Soma dos valores de serviços de tipo `corretiva` |
| `lembreteEnviadoEm` | `Timestamp` | Não | Marcador escrito pela Cloud Function `enviarLembretesOS` após enviar lembrete; impede reenvio |

**Sub-schema `StatusEntry`:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `status` | `OSStatus` | Status registrado nesta entrada |
| `changedAt` | `string` | ISO string do momento da mudança |
| `changedBy` | `string` | Nome do usuário que realizou a mudança |

**Sub-schema `ServicoRealizado`:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `catalogoId` | `string` | ID do item em `catalogo-servicos` |
| `nome` | `string` | Nome do serviço no momento do registro |
| `tipo` | `TipoServico` | `'preventiva'` ou `'corretiva'` |
| `valor` | `number` | Valor cobrado pelo serviço (em reais) |

**Regras de acesso:**
- Leitura: qualquer usuário autenticado
- Criação: usuário autenticado; `condutorId` deve ser igual ao `uid` do solicitante
- Atualização: qualquer usuário autenticado
- Exclusão: não permitida pelas regras

**Queries utilizadas pelo app:**
- Todas as OS ativas (gestor): `where('status', 'in', ACTIVE_STATUSES)` + `limit(100)`
- OS ativas de um condutor: `where('condutorId', '==', uid)` + `where('status', 'in', ACTIVE_STATUSES)`
- OS específica em tempo real: `onSnapshot` por ID de documento
- Todas as OS ativas (um-shot): `where('status', 'in', ACTIVE_STATUSES)` + `limit(100)`

> Todas as queries omitem `orderBy` server-side para evitar índice composto. A ordenação por `criadoEm` é feita client-side com `byDate()`.

---

**Coleção:** `fornecedores`
**Caminho:** `fornecedores/{id}`

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `nome` | `string` | Sim | Razão social ou nome fantasia |
| `cidade` | `string` | Sim | Cidade do fornecedor |
| `endereco` | `string` | Sim | Endereço completo |
| `horario` | `string` | Sim | Horário de funcionamento |
| `responsavel` | `string` | Sim | Nome do responsável pelo atendimento |
| `telefone` | `string` | Sim | Número de telefone de contato |
| `googleMapsUrl` | `string` | Não | URL do Google Maps para localização |

**Regras de acesso:**
- Leitura: qualquer usuário autenticado
- Criação/Atualização/Exclusão: somente gestores

**Queries utilizadas pelo app:**
- Assinatura em tempo real: `orderBy('nome')` + `limit(500)`
- Paginação: `orderBy('nome')` + `startAfter(cursor)` + `limit(26)` (25 + 1 para detectar `hasMore`)
- Busca completa (one-shot): `orderBy('nome')` + `limit(500)`
- Por ID: `getDoc` por ID de documento

---

**Coleção:** `veiculos`
**Caminho:** `veiculos/{id}`

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `placa` | `string` | Sim | Placa do veículo (pode estar com ou sem hífen) |
| `frota` | `string` | Sim | Número interno de frota |
| `modelo` | `string` | Sim | Modelo do veículo |
| `ano` | `number` | Sim | Ano de fabricação |
| `departamento` | `string` | Sim | Departamento responsável pelo veículo |
| `ativo` | `boolean` | Sim | Se o veículo está ativo na frota |

**Regras de acesso:**
- Leitura: qualquer usuário autenticado
- Criação/Atualização/Exclusão: somente gestores

**Queries utilizadas pelo app:**
- Assinatura em tempo real: `orderBy('placa')` + `limit(500)`
- Paginação: `orderBy('placa')` + `startAfter(cursor)` + `limit(26)`
- Busca completa (one-shot): `orderBy('placa')` + `limit(500)`
- Por placa: `where('placa', 'in', [comHífen, semHífen])` — tolerância a formatação

---

**Coleção:** `catalogo-servicos`
**Caminho:** `catalogo-servicos/{id}`

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `nome` | `string` | Sim | Nome do serviço |
| `tipo` | `TipoServico` | Sim | `'preventiva'` ou `'corretiva'` |
| `ativo` | `boolean` | Sim | Se o serviço está disponível para seleção; padrão `true` |

**Regras de acesso:**
- Leitura: qualquer usuário autenticado
- Criação/Atualização/Exclusão: somente gestores

**Queries utilizadas pelo app:**
- Assinatura em tempo real: `orderBy('nome')` (sem filtro — filtragem de `ativo` feita client-side em `getServicosAtivos`)
- Busca de ativos (one-shot): `orderBy('nome')` + filtro client-side por `ativo === true`

---

**Coleção:** `notificacoes`
**Caminho:** `notificacoes/{id}`

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `userId` | `string` | Sim | UID do usuário destinatário da notificação (`usuarios/{uid}`) |
| `type` | `'os_criada' \| 'status_atualizado' \| 'lembrete_os'` | Sim | Tipo da notificação |
| `title` | `string` | Sim | Título exibido na notificação push e no histórico |
| `body` | `string` | Sim | Corpo do texto da notificação |
| `osId` | `string` | Sim | ID da OS relacionada (`ordens-servico/{id}`) |
| `createdAt` | `Timestamp` | Sim | Data de criação; escrito via `serverTimestamp()` pelas Cloud Functions |
| `expiresAt` | `Timestamp` | Sim | Data de expiração: `createdAt + 90 dias` |
| `read` | `boolean` | Sim | Se o usuário já leu a notificação; `false` na criação |

**Regras de acesso:**
- Leitura: somente o usuário cujo `uid` corresponde a `resource.data.userId`
- Atualização: somente o usuário dono da notificação; apenas o campo `read` pode ser alterado
- Criação/Exclusão: não permitidas pelo cliente (apenas Cloud Functions via Admin SDK)

**Queries utilizadas pelo app:**
- Notificações do usuário: `where('userId', '==', uid)` — ordenação por `createdAt` feita client-side
- Marcar como lida: `updateDoc` com `{ read: true }`

---

## 4. Cloud Functions

---

**`onOSCreated`**

| Propriedade | Valor |
|-------------|-------|
| Trigger | `onDocumentCreated` (Firestore) |
| Documento | `ordens-servico/{id}` |
| Região | [NÃO IDENTIFICADO NOS ARQUIVOS — padrão `us-central1`] |

**Condição de disparo:** Qualquer documento novo criado na coleção `ordens-servico`.

**Lógica executada:**
1. Lê `condutorNome` e `placa` do documento criado.
2. Busca todos os documentos em `usuarios` com `perfil == 'gestor'` que possuam `fcmToken` não nulo.
3. Se não houver gestores com token, encerra sem ação.
4. Envia multicast FCM para todos os gestores em lotes de 500 tokens.
5. Remove automaticamente do Firestore os tokens que retornaram erro permanente.
6. Persiste um documento em `notificacoes` para cada gestor destinatário via `db.batch()`.

**Payload FCM enviado:**
```json
{
  "notification": {
    "title": "Nova OS aguardando análise",
    "body": "Aberta por {condutorNome} · {placa}"
  },
  "data": { "osId": "{id}" },
  "android": {
    "priority": "high",
    "notification": { "channelId": "os-updates", "sound": "default" }
  },
  "apns": {
    "payload": { "aps": { "sound": "default", "badge": 1 } }
  }
}
```

**Writes realizados no Firestore:**
- Coleção `notificacoes`: `userId`, `type: 'os_criada'`, `title`, `body`, `osId`, `createdAt` (serverTimestamp), `expiresAt` (createdAt + 90 dias), `read: false` — um documento por gestor destinatário.
- Coleção `usuarios`: remoção do campo `fcmToken` para UIDs com token stale (via `batch.update`).

**Tratamento de stale tokens:** Após cada lote multicast, os índices com `r.success === false` e código de erro `messaging/registration-token-not-registered`, `messaging/invalid-registration-token` ou `messaging/invalid-argument` têm o campo `fcmToken` deletado via `db.batch()`.

---

**`onOSStatusUpdated`**

| Propriedade | Valor |
|-------------|-------|
| Trigger | `onDocumentUpdated` (Firestore) |
| Documento | `ordens-servico/{id}` |
| Região | [NÃO IDENTIFICADO NOS ARQUIVOS — padrão `us-central1`] |

**Condição de disparo:** Qualquer atualização em `ordens-servico/{id}` onde `before.status !== after.status`.

**Lógica executada:**
1. Compara `before.status` com `after.status`; encerra se forem iguais.
2. Lê `condutorId` do documento atualizado.
3. Busca o `fcmToken` do condutor em `usuarios/{condutorId}`.
4. Se não houver token, encerra sem ação.
5. Envia notificação push individual ao condutor.
6. Persiste um documento em `notificacoes` para o condutor.
7. Em caso de token stale, remove o `fcmToken` do Firestore e não relança o erro.

**Payload FCM enviado (varia por status):**
```json
{
  "notification": {
    "title": "{titulo_do_status}",
    "body": "{mensagem_do_status} {osId.toUpperCase()}"
  },
  "data": { "osId": "{id}" },
  "android": {
    "priority": "high",
    "notification": { "channelId": "os-updates", "sound": "default" }
  },
  "apns": {
    "payload": { "aps": { "sound": "default", "badge": 1 } }
  }
}
```

**Mensagens por status:**

| Status | Título | Corpo |
|--------|--------|-------|
| `nova` | Nova OS | `OS {ID} foi aberta` |
| `em_andamento` | OS em andamento | `Sua OS {ID} está sendo atendida` |
| `em_diagnostico` | OS em diagnóstico | `Sua OS {ID} está em diagnóstico` |
| `orcamento_aprovado` | Orçamento aprovado | `O orçamento da OS {ID} foi aprovado` |
| `concluida` | OS concluída | `Sua OS {ID} foi concluída com sucesso` |

**Writes realizados no Firestore:**
- Coleção `notificacoes`: `userId` (condutorId), `type: 'status_atualizado'`, `title`, `body`, `osId`, `createdAt` (serverTimestamp), `expiresAt` (createdAt + 90 dias), `read: false`.
- Coleção `usuarios`: remoção do campo `fcmToken` do condutor em caso de token stale.

**Tratamento de stale tokens:** Erro capturado no bloco `catch`; se `err.errorInfo.code` indicar token inválido, chama `removeStaleToken(condutorId)` que executa `update({ fcmToken: FieldValue.delete() })`.

---

**`enviarLembretesOS`**

| Propriedade | Valor |
|-------------|-------|
| Trigger | `onSchedule` (Cloud Scheduler) |
| Agendamento | Todo dia às 07:00 |
| Fuso horário | `America/Sao_Paulo` |
| Região | [NÃO IDENTIFICADO NOS ARQUIVOS — padrão `us-central1`] |

**Condição de disparo:** Executa diariamente às 07h00 (horário de Brasília).

**Lógica executada:**
1. Calcula a data atual no fuso UTC-3.
2. Busca todas as OS com `status in ACTIVE_STATUSES`.
3. Filtra as OS cujo `dataDesejada` corresponde à data de hoje **e** que ainda não têm o campo `lembreteEnviadoEm` preenchido.
4. Para cada OS candidata: busca o `fcmToken` do condutor.
5. Se houver token, envia notificação push individual.
6. Persiste um documento em `notificacoes` para o condutor (independentemente do sucesso do push).
7. Atualiza o documento da OS com `lembreteEnviadoEm: serverTimestamp()` para evitar reenvio.

**Payload FCM enviado:**
```json
{
  "notification": {
    "title": "Lembrete de OS agendada",
    "body": "Sua OS do veículo {placa} está marcada para hoje. Não se esqueça de levar à oficina!"
  },
  "data": { "osId": "{id}" },
  "android": {
    "priority": "high",
    "notification": { "channelId": "os-updates", "sound": "default" }
  },
  "apns": {
    "payload": { "aps": { "sound": "default", "badge": 1 } }
  }
}
```

**Writes realizados no Firestore:**
- Coleção `notificacoes`: `userId` (condutorId), `type: 'lembrete_os'`, `title`, `body`, `osId`, `createdAt` (serverTimestamp), `expiresAt` (createdAt + 90 dias), `read: false`.
- Coleção `ordens-servico`: campo `lembreteEnviadoEm` com `serverTimestamp()` na OS processada.
- Coleção `usuarios`: remoção do campo `fcmToken` em caso de token stale.

**Tratamento de stale tokens:** Mesmo padrão de `onOSStatusUpdated` — erro capturado no `catch`, verifica código e chama `removeStaleToken`.

---

## 5. Estrutura de Notificações Push (FCM)

**Tabela consolidada:**

| Tipo | Trigger | Destinatário | Título | Corpo |
|------|---------|--------------|--------|-------|
| `os_criada` | Nova OS criada | Todos os gestores com token | Nova OS aguardando análise | `Aberta por {condutorNome} · {placa}` |
| `status_atualizado` | Status da OS alterado | Condutor da OS | Variável por status (ver tabela acima) | Variável por status |
| `lembrete_os` | Diário às 07h00 | Condutor da OS | Lembrete de OS agendada | `Sua OS do veículo {placa} está marcada para hoje...` |

**Canal Android:**
- ID: `os-updates`
- Nome exibido: `Atualizações de OS`
- Importância: `HIGH`
- Padrão de vibração: `[0, 250, 250, 250]`
- Cor da luz LED: `#1A5C2A`
- Som: `default`

**Prioridade:** `high` (Android) em todas as notificações.

**Campos no objeto `data` do payload FCM:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `osId` | `string` | ID do documento da OS que originou a notificação |

> O objeto `data` contém apenas `osId`. Não há campo `tipo` no payload FCM (ao contrário do que o tipo `Notificacao` poderia sugerir — o campo `type` existe apenas no documento Firestore de histórico).

**Configuração APNS (iOS):**
- `sound: 'default'`
- `badge: 1`

---

## 6. Regras de Segurança

**Tabela por coleção:**

| Coleção | Leitura | Criação | Atualização | Exclusão |
|---------|---------|---------|-------------|----------|
| `usuarios` | Próprio usuário ou gestor | Próprio usuário ou gestor | Próprio usuário ou gestor | Somente gestor |
| `ordens-servico` | Qualquer autenticado | Autenticado + `condutorId == uid` | Qualquer autenticado | Não permitida |
| `fornecedores` | Qualquer autenticado | Somente gestor | Somente gestor | Somente gestor |
| `veiculos` | Qualquer autenticado | Somente gestor | Somente gestor | Somente gestor |
| `catalogo-servicos` | Qualquer autenticado | Somente gestor | Somente gestor | Somente gestor |
| `notificacoes` | Dono da notificação (`userId == uid`) | Não permitida (somente Admin SDK) | Dono da notificação; somente campo `read` | Não permitida |

**Funções auxiliares das regras:**

| Função | O que verifica | Custo em leituras Firestore |
|--------|---------------|----------------------------|
| `isAuthenticated()` | `request.auth != null` | 0 leituras |
| `isOwner(uid)` | `isAuthenticated()` + `request.auth.uid == uid` | 0 leituras |
| `isGestor()` | `isAuthenticated()` + leitura do campo `perfil` em `usuarios/{request.auth.uid}` | **1 leitura por chamada** |

> `isGestor()` realiza uma leitura em `usuarios` a cada avaliação. Em operações que envolvem regras com `isGestor()`, o custo é de 1 leitura adicional por request de escrita/leitura em coleções que exijam verificação de perfil.

---

## 7. Índices Firestore

O arquivo `firestore.indexes.json` não foi encontrado no repositório. Os índices abaixo são inferidos a partir das queries identificadas nos services.

| Coleção | Campos | Status |
|---------|--------|--------|
| `ordens-servico` | `status ASC` (campo único, usado com `where('status', 'in', ...)`) | [CONFIGURADO — índice automático de campo único] |
| `fornecedores` | `nome ASC` (campo único, usado com `orderBy('nome')`) | [CONFIGURADO — índice automático de campo único] |
| `veiculos` | `placa ASC` (campo único, usado com `orderBy('placa')`) | [CONFIGURADO — índice automático de campo único] |
| `catalogo-servicos` | `nome ASC` (campo único, usado com `orderBy('nome')`) | [CONFIGURADO — índice automático de campo único] |
| `notificacoes` | `userId ASC` (campo único, usado com `where('userId', '==', ...)`) | [CONFIGURADO — índice automático de campo único] |
| `ordens-servico` | `condutorId ASC` + `status ASC` (composição para `subscribeToOSByCondutorId`) | [NECESSÁRIO — não configurado; atualmente sem `orderBy`, mas se adicionado exige índice composto] |
| `ordens-servico` | `condutorId ASC` + `criadoEm DESC` | [NECESSÁRIO — não configurado; comentado no código como necessário para frotas grandes] |
| `ordens-servico` | `status ASC` + `criadoEm DESC` | [NECESSÁRIO — não configurado; `where + orderBy` em campos diferentes exigiria este índice; evitado com ordenação client-side] |

---

## 8. Limites e Comportamentos Conhecidos

| Contexto | Limite | Localização no código | Impacto |
|----------|--------|-----------------------|---------|
| Lote FCM multicast | 500 tokens por envio | `functions/src/index.ts` — constante `BATCH = 500` | Gestores acima de 500 com token recebem a notificação em múltiplos lotes sequenciais |
| Query de OS (gestor) | 100 documentos por query | `services/os.service.ts` — `pageSize = 100` (default) | OS além das 100 mais recentes não aparecem na listagem do gestor; para frotas maiores, usar `startAfter` |
| Query de OS (one-shot) | 100 documentos | `services/os.service.ts` — `getAllOS` com `limit(100)` | Mesmo limite da assinatura em tempo real |
| Query de fornecedores (realtime) | 500 documentos | `services/fornecedor.service.ts` — `FORNECEDORES_LIMIT = 500` | Fornecedores além de 500 não aparecem na lista em tempo real |
| Query de fornecedores (one-shot) | 500 documentos | `services/fornecedor.service.ts` — `getAllFornecedores` com `FORNECEDORES_LIMIT` | Mesmo limite |
| Paginação de fornecedores | 25 itens por página | `services/fornecedor.service.ts` — `FORNECEDORES_PAGE_SIZE = 25` | Tela de listagem de fornecedores carrega 25 por vez |
| Query de veículos (realtime) | 500 documentos | `services/veiculo.service.ts` — `VEICULOS_LIMIT = 500` | Veículos além de 500 não aparecem na lista em tempo real |
| Paginação de veículos | 25 itens por página | `services/veiculo.service.ts` — `VEICULOS_PAGE_SIZE = 25` | Tela de listagem de veículos carrega 25 por vez |
| TTL de notificações | 90 dias | `services/notificacoes.service.ts` e `functions/src/index.ts` — `NINETY_DAYS_MS` | Notificações com `expiresAt` no passado não são removidas automaticamente pelo Firestore; limpeza deve ser feita manualmente ou via Cloud Function agendada |
| Lembrete de OS | 1 lembrete por OS | `functions/src/index.ts` — filtro `!data.lembreteEnviadoEm` | Após o lembrete ser enviado, `lembreteEnviadoEm` é gravado na OS impedindo reenvio em execuções futuras |
