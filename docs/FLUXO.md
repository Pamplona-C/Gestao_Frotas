# FrotaAtiva — Fluxos Funcionais

Este documento descreve o fluxo real implementado nas telas e services atuais.

## Perfis

| Perfil | Acessos principais |
|---|---|
| Condutor | Início, Meus Veículos, Checklist, Nova OS, Detalhe de OS, Perfil, Notificações |
| Gestor | Painel, Veículos, Fornecedores, Detalhe/Gerenciar OS, Vínculos, Catálogo, Novo Usuário, Perfil, Notificações |

O perfil vem de `usuarios/{uid}.perfil`. O Firebase Auth guarda apenas identidade; permissões de produto dependem do documento Firestore.

## Autenticação

1. Usuário entra com email/senha ou Google Sign-In em build nativa.
2. `services/auth.service.ts` autentica no Firebase Auth.
3. `buildAppUser()` busca `usuarios/{uid}`.
4. Se o documento não existir, o login falha com `Conta não encontrada`.
5. Se `ativo === false`, a sessão é encerrada e o login é bloqueado.
6. `hooks/useAuthListener.ts` mantém `store/auth.store.ts` sincronizada.
7. `app/index.tsx` redireciona para `/login` ou `/(tabs)`.

FCM só é registrado fora do Expo Go. O token fica em `usuarios/{uid}.fcmToken`.

## Condutor: Meus Veículos e Checklists

### Ver veículos vinculados

Rota canônica: `/meus-veiculos`.

O app assina `vinculos` por `condutorId` e mostra:

| Estado | Exibição | Ação |
|---|---|---|
| `status: ativo`, sem `checklistEntradaId` | Checklist de entrada pendente | Fazer checklist de entrada |
| `status: ativo`, com entrada e sem saída | Em uso | Fazer checklist de saída |
| `status: inativo`, sem saída | Checklist de saída pendente | Fazer checklist de saída |

Após preencher `checklistSaidaId`, o vínculo deixa de aparecer na rota raiz `/meus-veiculos`.

### Checklist de entrada

Rota: `/checklist/[vinculoId]/entrada`.

1. Tela carrega o vínculo por ID.
2. Define os ângulos por `veiculoTipo`.
3. Condutor tira foto ou escolhe da galeria para cada ângulo.
4. O botão de concluir só habilita quando todas as fotos obrigatórias foram preenchidas.
5. `createChecklist()` comprime e envia fotos para Storage.
6. Cria documento em `checklists`.
7. Atualiza `vinculos/{id}.checklistEntradaId`.

Quantidade de fotos:

| Tipo | Fotos |
|---|---:|
| Carro | 20 |
| Moto | 6 |

### Checklist de saída

Rota: `/checklist/[vinculoId]/saida`.

Fluxo igual ao checklist de entrada. Ao concluir:

1. Fotos são enviadas para `checklists/{vinculoId}/saida/...`.
2. Documento é criado em `checklists`.
3. `checklistSaidaId` é preenchido no vínculo.
4. Se o vínculo ainda estiver `ativo`, `encerrarVinculo()` muda `status` para `inativo` e grava `encerradoEm`.

## Condutor: Nova OS

Rota: `/nova-os/etapa-1` até `/nova-os/etapa-6`.

Pré-condição: o condutor precisa ter um vínculo `ativo` com `checklistEntradaId` preenchido.

| Etapa | Tela | O que faz |
|---|---|---|
| 1 | Identificação | Seleciona veículo vinculado disponível, informa cidade e hodômetro |
| 2 | Serviços | Seleciona categorias estáticas de manutenção |
| 3 | Descrição | Descreve problema e anexa até 5 fotos |
| 4 | Agendamento | Seleciona data desejada, horário e observações |
| 5 | Resumo | Revisa dados e pode voltar para editar |
| 6 | Envio | Cria OS, envia fotos e mostra confirmação |

Estado temporário: `store/novaOS.store.ts`.

Criação:

1. `createOS()` cria documento em `ordens-servico` com `status: nova`.
2. `statusHistory` recebe a primeira entrada com o nome do condutor.
3. Se houver fotos, `uploadFotosOS()` envia para Storage.
4. `updateOS()` grava URLs das fotos.
5. Store é limpa com `reset()`.

Se o upload de fotos falhar depois de a OS ser criada, a tela informa sucesso parcial (`concluido_sem_fotos`).

## Condutor: Home e Detalhe de OS

Home do condutor: `app/(tabs)/index.tsx`.

Mostra OS ativas do próprio condutor:

```text
nova
em_andamento
em_diagnostico
orcamento_aprovado
```

OS `concluida` não aparece na lista ativa.

Detalhe: `/os/[id]`.

Exibe dados do veículo, status, serviços solicitados, descrição, fotos, fornecedor atribuído, nota/mensagem do gestor e timeline. Para condutor, a tela é somente leitura.

## Gestor: Dashboard e OS

Dashboard: `/(tabs)`.

Mostra todas as OS ativas, métricas calculadas client-side e cards de OS. O limite atual é 100 documentos.

Métricas vindas de `computeMetrics()`:

| Métrica | Origem |
|---|---|
| Total | Quantidade de OS ativas carregadas |
| Em andamento | `status === 'em_andamento'` |
| Em diagnóstico | `status === 'em_diagnostico'` |
| Orçamento aprovado | `status === 'orcamento_aprovado'` |
| Novas | `status === 'nova'` |
| Gasto preventiva/corretiva | Soma de `servicosRealizados` |

### Gerenciar OS

Rota: `/os/[id]/gerenciar`.

O gestor pode:

| Ação | Persistência |
|---|---|
| Atribuir fornecedor | `fornecedorId` |
| Alterar status | `status` + nova entrada em `statusHistory` |
| Enviar nota/mensagem | `notaInterna` |
| Registrar serviços realizados | `servicosRealizados`, `valorTotal`, `gastoPreventiva`, `gastoCorretiva` |
| Registrar snapshot do gestor | `gestorId`, `gestorNome`, `gestorPhotoURL`, `gestorDepartamento` |

A lista de fornecedores prioriza a cidade da OS. Se não houver fornecedor na cidade, mostra todos com aviso.

Mudança de status dispara `onOSStatusUpdated`, que notifica o condutor e registra histórico em `notificacoes`.

## Gestor: Veículos e Vínculos

### Lista de veículos

Rota: `/(tabs)/veiculos`.

Funcionalidades:

| Ação | Service |
|---|---|
| Listar em tempo real | `subscribeToAllVeiculos()` |
| Paginar | `getVeiculosPaginados()` |
| Buscar | Carrega todos e filtra localmente |
| Criar | `createVeiculo()` |
| Editar | `updateVeiculo()` |
| Excluir | `deleteVeiculo()` |

Observação: `deleteVeiculo()` remove o documento do Firestore. O campo `ativo` existe e é editável, mas a ação de excluir é remoção real.

### Detalhe do veículo

Rota: `/veiculo/[id]`.

Mostra:

| Seção | Conteúdo |
|---|---|
| Condutor vinculado | Vínculos ativos, status do checklist e ação de desvincular |
| Checklists de saída pendentes | Vínculos inativos sem `checklistSaidaId` |
| Vínculos encerrados | Vínculos inativos com `checklistSaidaId` |

### Vincular condutor

1. Gestor abre `/veiculo/[id]`.
2. Toca em Vincular.
3. Modal lista condutores ativos não vinculados atualmente.
4. `createVinculo()` verifica se já existe vínculo ativo para o veículo.
5. Documento é criado em `vinculos`.
6. `onVinculoCriado` envia push ao condutor.

### Desvincular condutor

1. Gestor confirma a ação.
2. `encerrarVinculo()` muda o vínculo para `inativo`.
3. O veículo fica disponível para outro condutor.
4. O vínculo antigo aparece em checklists de saída pendentes até preencher `checklistSaidaId`.

## Gestor: Fornecedores

Rota: `/(tabs)/fornecedores`.

Campos: nome, cidade, endereço, horário, responsável, telefone e link do Google Maps opcional.

Funcionalidades:

| Ação | Service |
|---|---|
| Listar em tempo real | `subscribeToAllFornecedores()` |
| Paginar | `getFornecedoresPaginados()` |
| Buscar por nome/cidade | Filtro local |
| Criar | `createFornecedor()` |
| Editar | `updateFornecedor()` |
| Excluir | `deleteFornecedor()` |

## Gestor: Catálogo de Serviços

Rota: `/catalogo-servicos`.

O catálogo dinâmico é usado para serviços realizados no gerenciamento da OS, não para as categorias selecionadas pelo condutor na abertura.

Campos:

| Campo | Tipo |
|---|---|
| `nome` | `string` |
| `tipo` | `preventiva` ou `corretiva` |
| `ativo` | `boolean` |

Serviços inativos continuam cadastrados, mas `getServicosAtivos()` filtra apenas os ativos para uso em OS.

## Gestor: Novo Usuário

Rota: `/novo-usuario`.

O gestor cria contas usando `createUserAccount()`.

Ponto importante: o serviço inicializa uma instância Firebase secundária para criar o novo usuário sem deslogar o gestor atual.

Campos: nome, email, senha, confirmação de senha, departamento e perfil (`condutor` ou `gestor`).

## Notificações

### Push

| Gatilho | Destinatário | Persistido em `notificacoes` |
|---|---|---|
| Nova OS | Gestores com token | Sim |
| Mudança de status de OS | Condutor da OS | Sim |
| Vínculo criado | Condutor vinculado | Não |
| Lembrete de OS agendada | Condutor da OS | Sim |

### Histórico

Rota: `/notificacoes`.

Funcionalidades:

| Ação | Service |
|---|---|
| Assinar histórico do usuário | `subscribeToNotificacoes()` |
| Marcar uma como lida | `markAsRead()` |
| Marcar todas como lidas | `markAllAsRead()` |
| Abrir OS relacionada | Navega para `/os/[id]` |

## Ciclo de Vida do Vínculo

```text
createVinculo
  -> status ativo
  -> checklistEntradaId vazio
  -> checklistSaidaId vazio

checklist entrada
  -> preenche checklistEntradaId
  -> condutor pode abrir OS

checklist saída
  -> preenche checklistSaidaId
  -> se status ativo, encerra vínculo

desvinculação manual pelo gestor
  -> status inativo
  -> encerradoEm preenchido
  -> checklist de saída fica pendente
```

## Ciclo de Vida da OS

```text
nova
  -> em_andamento
  -> em_diagnostico
  -> orcamento_aprovado
  -> concluida
```

O app permite o gestor selecionar qualquer status disponível; a ordem acima é o fluxo esperado de negócio, não uma restrição rígida no código.

## Guards e Restrições

| Regra | Onde fica |
|---|---|
| Apenas autenticado entra em tabs | `app/(tabs)/_layout.tsx` |
| Condutor só abre OS com checklist de entrada feito | `app/nova-os/etapa-1.tsx` |
| Checklist só conclui com todas as fotos | `app/checklist/[vinculoId]/[tipo].tsx` |
| Veículo só tem um vínculo ativo | UI + `createVinculo()` |
| OS concluída sai das listas ativas | `ACTIVE_STATUSES` em `os.service.ts` |
| Offline bloqueia etapa 1 da OS | `SemInternet` em `etapa-1.tsx` |
| Token FCM não roda no Expo Go | Guards em `notification.service.ts` e `_layout.tsx` |

## Pontos de Atenção

| Item | Observação |
|---|---|
| `app/(tabs)/meus-veiculos.tsx` | Rota oculta e diferente da rota raiz `/meus-veiculos`; a raiz é a usada pela Home |
| Regras de OS | `allow update: if isAuthenticated()` ainda é permissivo |
| `onVinculoCriado` | Envia push mas não grava histórico em `notificacoes` |
| Fotos em sucesso parcial | OS pode existir sem fotos se o upload falhar |
