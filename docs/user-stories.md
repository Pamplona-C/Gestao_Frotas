# User Stories — FrotaAtiva

Histórias alinhadas com os fluxos implementados no app atual.

## Personas

### Condutor

Usuário que recebe um veículo, registra evidências de uso, abre OS e acompanha manutenção.

Pode:

- Ver veículos vinculados.
- Fazer checklist de entrada e saída.
- Abrir OS para veículos em uso.
- Acompanhar OS ativas.
- Ver detalhes de fornecedor, status e mensagens do gestor.
- Receber notificações.
- Atualizar perfil e senha.

Não pode:

- Gerenciar status de OS.
- Cadastrar veículos, fornecedores, serviços ou usuários.
- Vincular/desvincular condutores.
- Ver painel geral da frota.

### Gestor

Usuário administrativo responsável por frota, fornecedores, vínculos e manutenção.

Pode:

- Ver todas as OS ativas.
- Gerenciar OS e registrar custos.
- Cadastrar veículos e fornecedores.
- Vincular/desvincular condutores.
- Fazer checklist de saída quando necessário.
- Criar usuários.
- Gerenciar catálogo de serviços.
- Receber notificação de nova OS.

## Épicos

| ID | Épico | Persona | Status |
|---|---|---|---|
| EP-01 | Autenticação e perfil | Ambos | Implementado |
| EP-02 | Vínculos e checklists | Ambos | Implementado |
| EP-03 | Abertura de OS | Condutor | Implementado |
| EP-04 | Acompanhamento de OS | Condutor | Implementado |
| EP-05 | Gerenciamento de OS | Gestor | Implementado |
| EP-06 | Gestão de veículos | Gestor | Implementado |
| EP-07 | Gestão de fornecedores | Gestor | Implementado |
| EP-08 | Catálogo de serviços | Gestor | Implementado |
| EP-09 | Notificações | Ambos | Implementado |
| EP-10 | Relatórios | Gestor | Não implementado no app atual |

## EP-01 — Autenticação e Perfil

### US-001 — Login com email e senha

Como usuário, quero entrar com email e senha para acessar as funcionalidades do meu perfil.

Critérios:

- Dado email e senha válidos, o app autentica no Firebase Auth.
- Após autenticar, o app busca `usuarios/{uid}`.
- Se o documento não existir, o acesso é bloqueado.
- Se `ativo === false`, o app encerra a sessão e informa conta desativada.
- Usuário autenticado é redirecionado para `/(tabs)`.

Implementação: `app/login.tsx`, `services/auth.service.ts`, `hooks/useAuthListener.ts`.

### US-002 — Login com Google

Como usuário, quero entrar com Google em build nativa para reutilizar minha conta.

Critérios:

- O botão só deve aparecer quando os client IDs estiverem configurados.
- O fluxo não roda no Expo Go.
- Após autenticar, o app exige documento em `usuarios/{uid}`.

Implementação: `app/login.tsx`, `services/auth.service.ts`.

### US-003 — Perfil

Como usuário, quero ver e atualizar minha foto para que minha identidade apareça no app.

Critérios:

- Perfil mostra nome, email, departamento, perfil e foto/iniciais.
- Usuário pode selecionar imagem local.
- Foto é enviada para `perfil-fotos/{uid}`.
- URL é gravada no Firebase Auth e em `usuarios/{uid}.photoURL`.
- Usuário pode trocar senha mediante reautenticação.

Implementação: `app/perfil.tsx`, `services/auth.service.ts`, `services/storage.service.ts`.

## EP-02 — Vínculos e Checklists

### US-004 — Gestor vincula condutor a veículo

Como gestor, quero vincular um condutor a um veículo para liberar checklists e uso do veículo.

Critérios:

- A tela de veículo lista condutores ativos disponíveis.
- Condutores já vinculados ativamente não devem ser ofertados.
- Um veículo não pode receber novo vínculo se já houver vínculo ativo.
- Ao criar vínculo, o status começa como `ativo`.
- O condutor recebe push de veículo vinculado.

Implementação: `app/veiculo/[id].tsx`, `services/vinculo.service.ts`, `functions/src/index.ts`.

### US-005 — Condutor faz checklist de entrada

Como condutor, quero registrar fotos do veículo antes do uso para criar evidência do estado inicial.

Critérios:

- A tela deve carregar o vínculo por `vinculoId`.
- A quantidade de fotos depende do tipo do veículo: 20 para carro, 6 para moto.
- O botão concluir só habilita com todos os ângulos preenchidos.
- As fotos são comprimidas e enviadas para Storage.
- O documento `checklists/{id}` é criado.
- O vínculo recebe `checklistEntradaId`.

Implementação: `app/checklist/[vinculoId]/[tipo].tsx`, `constants/checklistAngulos.ts`, `services/checklist.service.ts`.

### US-006 — Condutor faz checklist de saída

Como condutor, quero registrar fotos na devolução para encerrar minha responsabilidade sobre o veículo.

Critérios:

- O fluxo usa a mesma tela de checklist, com `tipo = saida`.
- Ao concluir, o vínculo recebe `checklistSaidaId`.
- Se o vínculo ainda estiver ativo, ele é encerrado automaticamente.
- O veículo deixa de aparecer como disponível para abrir OS.

Implementação: `app/checklist/[vinculoId]/[tipo].tsx`, `services/checklist.service.ts`.

### US-007 — Gestor força desvinculação

Como gestor, quero desvincular um condutor para liberar o veículo antes do checklist de saída.

Critérios:

- Gestor confirma antes de desvincular.
- O vínculo muda para `inativo`.
- `encerradoEm` é preenchido.
- O veículo fica disponível para novo vínculo.
- O vínculo antigo aparece como saída pendente até preencher `checklistSaidaId`.

Implementação: `app/veiculo/[id].tsx`, `services/vinculo.service.ts`.

### US-008 — Gestor faz checklist de saída pendente

Como gestor, quero fazer o checklist de saída em nome do condutor quando ele não estiver disponível.

Critérios:

- Vínculos inativos sem saída aparecem no detalhe do veículo.
- Gestor acessa `/checklist/[vinculoId]/saida`.
- Ao concluir, `checklistSaidaId` é preenchido.
- Como o vínculo já está inativo, não é necessário encerrar novamente.

Implementação: `app/veiculo/[id].tsx`, `app/checklist/[vinculoId]/[tipo].tsx`.

## EP-03 — Abertura de OS

### US-009 — Selecionar veículo e cidade

Como condutor, quero selecionar um veículo em uso e informar cidade/hodômetro para iniciar uma OS.

Critérios:

- A etapa 1 lista apenas vínculos `ativo` com `checklistEntradaId`.
- Sem veículo disponível, a tela mostra estado vazio.
- Cidade é obrigatória.
- Hodômetro é obrigatório para carro e opcional para moto no comportamento atual.
- Offline bloqueia a etapa 1.

Implementação: `app/nova-os/etapa-1.tsx`.

### US-010 — Selecionar serviços necessários

Como condutor, quero marcar serviços em categorias para estruturar a solicitação.

Critérios:

- Serviços vêm de `constants/servicosCategorias.ts`.
- Categorias com subitens permitem múltipla seleção.
- Categoria sem subitens funciona como item selecionável.
- Botão continuar só habilita com pelo menos um item.

Implementação: `app/nova-os/etapa-2.tsx`, `components/AccordionItem.tsx`.

### US-011 — Descrever problema e anexar fotos

Como condutor, quero explicar o problema e anexar fotos para dar contexto ao gestor.

Critérios:

- Descrição é opcional.
- Fotos são opcionais, com limite de 5.
- No native, o app pede permissão de galeria.
- No web, o app usa placeholders.
- Usuário pode remover fotos antes de enviar.

Implementação: `app/nova-os/etapa-3.tsx`.

### US-012 — Informar agendamento

Como condutor, quero informar data e horário desejados para facilitar organização da oficina.

Critérios:

- Data desejada é obrigatória.
- Date picker impede datas anteriores no native.
- Horário e observações são opcionais.
- Dados ficam salvos no Zustand até envio ou reset.

Implementação: `app/nova-os/etapa-4.tsx`.

### US-013 — Revisar OS

Como condutor, quero revisar a OS antes de enviar para corrigir erros.

Critérios:

- Resumo mostra veículo, serviços, descrição/fotos e agendamento.
- Cada seção tem ação de editar que volta para a etapa correspondente.
- Se descrição e fotos estiverem vazias, a seção de descrição não aparece.

Implementação: `app/nova-os/etapa-5.tsx`.

### US-014 — Enviar OS

Como condutor, quero confirmar a OS para que o gestor seja notificado.

Critérios:

- A etapa 6 bloqueia navegação de volta durante envio.
- A OS é criada com `status: nova`.
- `statusHistory` recebe a primeira entrada.
- Fotos são enviadas depois da criação da OS.
- Falha de upload de fotos não apaga a OS.
- Ao concluir, a store da nova OS é limpa.

Implementação: `app/nova-os/etapa-6.tsx`, `services/os.service.ts`, `services/storage.service.ts`.

## EP-04 — Acompanhamento de OS

### US-015 — Condutor vê OS ativas

Como condutor, quero ver minhas OS ativas na home para acompanhar solicitações abertas.

Critérios:

- A lista filtra por `condutorId`.
- Só aparecem status ativos.
- Lista atualiza em tempo real.
- OS concluídas não aparecem.

Implementação: `app/(tabs)/index.tsx`, `services/os.service.ts`.

### US-016 — Condutor abre detalhe de OS

Como condutor, quero ver todos os detalhes de uma OS para acompanhar o atendimento.

Critérios:

- Detalhe assina uma OS por ID.
- Exibe status, veículo, serviços solicitados, descrição, fotos e fornecedor.
- Exibe nota/mensagem do gestor quando existir.
- Condutor não edita a OS por essa tela.

Implementação: `app/os/[id]/index.tsx`.

## EP-05 — Gerenciamento de OS

### US-017 — Gestor vê painel de OS

Como gestor, quero ver todas as OS ativas para priorizar atendimentos.

Critérios:

- Painel assina OS com status ativo.
- Métricas são calculadas em memória.
- Limite atual de leitura é 100 OS.
- Cards atualizam em tempo real.

Implementação: `app/(tabs)/index.tsx`, `services/os.service.ts`.

### US-018 — Gestor altera status

Como gestor, quero alterar o status da OS para manter o condutor informado.

Critérios:

- Gestor pode selecionar qualquer status disponível.
- Se o status mudou, `statusHistory` recebe nova entrada.
- A Cloud Function envia push ao condutor.
- Notificação persistida recebe tipo `status_atualizado`.

Implementação: `app/os/[id]/gerenciar.tsx`, `functions/src/index.ts`.

### US-019 — Gestor atribui fornecedor

Como gestor, quero atribuir uma oficina para orientar o condutor.

Critérios:

- Fornecedores da cidade da OS aparecem primeiro.
- Se não houver fornecedor na cidade, todos são exibidos com aviso.
- O gestor pode remover seleção tocando no fornecedor selecionado.
- A OS salva `fornecedorId`.

Implementação: `app/os/[id]/gerenciar.tsx`, `services/fornecedor.service.ts`.

### US-020 — Gestor registra serviços e custos

Como gestor, quero registrar serviços realizados e valores para controlar gastos.

Critérios:

- Serviços vêm de `catalogo-servicos` ativos.
- Serviço já adicionado fica desabilitado.
- Cada item possui valor editável.
- Ao salvar, o app grava `servicosRealizados`, `valorTotal`, `gastoPreventiva` e `gastoCorretiva`.

Implementação: `app/os/[id]/gerenciar.tsx`, `services/catalogo.service.ts`.

### US-021 — Gestor envia nota ao condutor

Como gestor, quero adicionar uma mensagem à OS para orientar o condutor.

Critérios:

- Campo é opcional.
- Nota existente carrega ao abrir a tela.
- Ao salvar, `notaInterna` é persistido.
- Condutor vê a nota no detalhe.

Implementação: `app/os/[id]/gerenciar.tsx`, `app/os/[id]/index.tsx`.

## EP-06 — Gestão de Veículos

### US-022 — Cadastrar veículo

Como gestor, quero cadastrar veículos para disponibilizá-los para vínculo.

Critérios:

- Campos principais: tipo, marca, modelo, frota, placa, ano, km atual, departamento e ativo.
- Ao salvar, o veículo aparece na lista.
- Lista é assinada em tempo real e ordenada por frota.

Implementação: `app/(tabs)/veiculos.tsx`, `services/veiculo.service.ts`.

### US-023 — Editar veículo

Como gestor, quero editar dados do veículo para manter a frota atualizada.

Critérios:

- Formulário abre preenchido.
- Campo `ativo` pode ser alternado.
- Ao salvar, lista reflete a alteração.

Implementação: `app/(tabs)/veiculos.tsx`.

### US-024 — Excluir veículo

Como gestor, quero excluir um veículo quando ele não fizer mais parte da frota.

Critérios:

- Ação exige confirmação.
- Ao confirmar, `deleteDoc` remove o documento.
- A lista atualiza pelo snapshot.

Implementação: `app/(tabs)/veiculos.tsx`, `services/veiculo.service.ts`.

### US-025 — Buscar veículos

Como gestor, quero buscar por placa, modelo, marca ou frota para encontrar veículos rapidamente.

Critérios:

- Campo de busca filtra localmente.
- Quando busca está vazia, fluxo paginado/listagem normal é usado.

Implementação: `app/(tabs)/veiculos.tsx`.

## EP-07 — Gestão de Fornecedores

### US-026 — Cadastrar fornecedor

Como gestor, quero cadastrar oficina com localização e contato para atribuir a OS.

Critérios:

- Campos obrigatórios: nome, cidade, endereço, horário, responsável e telefone.
- Link do Google Maps é opcional e validado como URL.
- Lista agrupa fornecedores por cidade.

Implementação: `app/(tabs)/fornecedores.tsx`.

### US-027 — Editar ou excluir fornecedor

Como gestor, quero manter fornecedores atualizados.

Critérios:

- Editar abre formulário preenchido.
- Excluir exige confirmação.
- Alterações aparecem em tempo real.

Implementação: `app/(tabs)/fornecedores.tsx`, `services/fornecedor.service.ts`.

### US-028 — Buscar fornecedor

Como gestor, quero buscar por nome ou cidade para encontrar oficinas.

Critérios:

- Busca filtra localmente por nome/cidade.
- Campo vazio retorna à lista agrupada.

Implementação: `app/(tabs)/fornecedores.tsx`.

## EP-08 — Catálogo de Serviços

### US-029 — Criar serviço no catálogo

Como gestor, quero criar serviços preventivos ou corretivos para registrar custos de OS.

Critérios:

- Nome e tipo são obrigatórios.
- Serviço nasce ativo quando informado pelo formulário.
- Lista atualiza em tempo real.

Implementação: `app/catalogo-servicos.tsx`, `services/catalogo.service.ts`.

### US-030 — Editar serviço

Como gestor, quero editar nome/tipo para corrigir o catálogo.

Critérios:

- Modal de edição carrega dados atuais.
- Salvar atualiza o documento.

Implementação: `app/catalogo-servicos.tsx`.

### US-031 — Ativar/desativar serviço

Como gestor, quero desativar serviços sem apagá-los.

Critérios:

- Toggle altera `ativo`.
- Serviços inativos não aparecem em `getServicosAtivos()`.

Implementação: `app/catalogo-servicos.tsx`, `services/catalogo.service.ts`.

## EP-09 — Notificações

### US-032 — Gestor recebe nova OS

Como gestor, quero receber push quando uma OS for aberta.

Critérios:

- `onOSCreated` dispara ao criar OS.
- Todos os gestores com `fcmToken` recebem push.
- Um documento em `notificacoes` é criado para cada gestor.
- Tokens inválidos são removidos.

Implementação: `functions/src/index.ts`.

### US-033 — Condutor recebe mudança de status

Como condutor, quero receber push quando o status da OS mudar.

Critérios:

- `onOSStatusUpdated` compara status anterior e novo.
- Se não houve mudança de status, não envia.
- Se houve mudança, envia push ao condutor.
- Cria notificação no histórico.

Implementação: `functions/src/index.ts`.

### US-034 — Condutor recebe lembrete de OS agendada

Como condutor, quero receber lembrete no dia da OS para não esquecer o atendimento.

Critérios:

- Scheduler roda às 07:00 no fuso `America/Sao_Paulo`.
- Só considera OS ativas.
- Só envia uma vez por OS, usando `lembreteEnviadoEm`.
- Cria notificação no histórico.

Implementação: `functions/src/index.ts`.

### US-035 — Usuário consulta histórico de notificações

Como usuário, quero ver notificações antigas e marcar leitura.

Critérios:

- A tela assina notificações do usuário.
- Itens são ordenados por `createdAt` desc.
- Tocar em notificação pode navegar para a OS.
- Usuário pode marcar uma ou todas como lidas.

Implementação: `app/notificacoes.tsx`, `services/notificacoes.service.ts`.

## EP-10 — Relatórios

### US-036 — Relatórios por período

Como gestor, quero ver relatórios por período para analisar gastos e volume de manutenção.

Status: não implementado no app atual.

Critérios futuros:

- Filtrar OS por intervalo de datas.
- Agrupar custos por tipo de serviço.
- Separar gastos preventivos e corretivos.
- Exportar ou visualizar resumo gerencial.

Referência: `docs/RELATORIOS.md`.

## Riscos e Lacunas de Produto

| Item | Observação |
|---|---|
| Regra Firestore de OS | Update ainda permitido para qualquer autenticado |
| Duplicidade de Meus Veículos | `/meus-veiculos` e `/(tabs)/meus-veiculos` divergem |
| Vínculo criado | Push não aparece no histórico `notificacoes` |
| Relatórios | Documentado, mas sem tela/rota implementada |
| Testes | Não há suite automatizada configurada |
