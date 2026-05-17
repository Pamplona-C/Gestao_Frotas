# User Stories — FrotaAtiva

## 1. Visão Geral

Este documento descreve o comportamento esperado do sistema sob a perspectiva das personas **Condutor** e **Gestor**, cobrindo todos os fluxos funcionais mapeados na aplicação. Complementa a `architecture.md` (visão técnica) e o `api-contracts.md` (contratos de dados), servindo de referência para designers, POs e testadores.

---

## 2. Personas

**Condutor**
- **Objetivo principal:** Registrar problemas no veículo da frota de forma rápida e acompanhar o andamento do atendimento sem precisar ligar para o setor de frotas.
- **Dor que o app resolve:** Antes, o condutor precisava relatar o problema por telefone ou e-mail, sem visibilidade do que estava acontecendo com o seu veículo e sem confirmação de que o pedido tinha sido recebido.
- **Ações disponíveis:**
  - Abrir nova Ordem de Serviço (OS) com dados do veículo, serviços, descrição e fotos
  - Agendar data e horário desejados para o atendimento
  - Acompanhar o status da OS em tempo real
  - Visualizar o fornecedor/oficina atribuído à OS
  - Receber notificações de mudança de status e lembretes de OS agendada
  - Ler mensagens enviadas pelo gestor
  - Visualizar e alterar foto de perfil
  - Alterar senha de acesso
- **Ações bloqueadas:**
  - Alterar o status de uma OS
  - Atribuir fornecedor a uma OS
  - Visualizar valores e serviços realizados (apenas os serviços solicitados são exibidos)
  - Cadastrar veículos, fornecedores ou outros usuários
  - Acessar o painel geral de todas as OS da frota
  - Acessar o catálogo de serviços

---

**Gestor**
- **Objetivo principal:** Ter visibilidade completa de todas as OS abertas da frota, gerenciar o atendimento de cada uma e manter o cadastro de veículos, fornecedores e usuários atualizado.
- **Dor que o app resolve:** Antes, o controle era feito em planilhas ou por e-mail, dificultando a priorização, o rastreio de custos e a comunicação com condutores e oficinas.
- **Ações disponíveis:**
  - Visualizar todas as OS ativas com filtro por status e métricas consolidadas
  - Gerenciar qualquer OS: alterar status, atribuir fornecedor, registrar serviços realizados com valores e enviar mensagem ao condutor
  - Cadastrar, editar e excluir veículos da frota
  - Cadastrar, editar e excluir fornecedores (oficinas)
  - Criar contas de acesso para condutores e outros gestores
  - Gerenciar o catálogo de serviços (criar, editar, ativar/desativar)
  - Receber notificação imediata quando uma nova OS é aberta
  - Visualizar e alterar foto de perfil
  - Alterar senha de acesso
- **Ações bloqueadas:**
  - Abrir nova OS pelo painel do gestor (fluxo exclusivo do condutor)

---

## 3. Épicos

| ID | Nome do Épico | Persona principal | Status |
|----|---------------|-------------------|--------|
| EP-01 | Abertura de OS | Condutor | Implementado |
| EP-02 | Acompanhamento de OS | Condutor | Implementado |
| EP-03 | Gerenciamento de OS | Gestor | Implementado |
| EP-04 | Notificações push | Ambos | Implementado |
| EP-05 | Gestão de veículos | Gestor | Implementado |
| EP-06 | Gestão de fornecedores | Gestor | Implementado |
| EP-07 | Gestão de usuários / condutores | Gestor | Implementado |
| EP-08 | Catálogo de serviços | Gestor | Implementado |
| EP-09 | Autenticação e perfil | Ambos | Implementado |
| EP-10 | Relatórios por período | Gestor | Não implementado |

---

## 4. User Stories por Épico

---
#### EP-01 — Abertura de OS

**US-001**
Como condutor,
quero informar a placa, o hodômetro e a cidade do atendimento,
para que o gestor saiba qual veículo precisa de manutenção e onde ele está.

**Critérios de aceitação:**
- ✅ Dado que o condutor está na etapa 1, quando digitar uma placa no formato válido (ABC-1234 ou ABC1D23), então o sistema exibe automaticamente o modelo, ano e número de frota do veículo cadastrado.
- ✅ Dado que a placa informada pertence a um veículo inativo, quando tentar avançar, então o sistema bloqueia o avanço e exibe a mensagem "Veículo inativo — não é possível abrir OS".
- ✅ Dado que o condutor está offline, quando tentar acessar a tela de nova OS, então a tela de "Sem internet" é exibida e o fluxo é bloqueado.

**Cenários de erro / edge cases:**
- Placa em formato inválido: campo fica em estado de erro com mensagem específica.
- Hodômetro com caracteres não numéricos: campo rejeita a entrada.
- Cidade não selecionada: botão "Continuar" aciona validação e exibe erro no campo.

**Notas de implementação:** `app/nova-os/etapa-1.tsx`

---

**US-002**
Como condutor,
quero selecionar os tipos de serviço que o veículo precisa a partir de uma lista categorizada,
para que o gestor receba uma descrição estruturada do problema.

**Critérios de aceitação:**
- ✅ Dado que o condutor está na etapa 2, quando expandir uma categoria, então os subitens específicos são exibidos para seleção individual.
- ✅ Dado que nenhum serviço foi selecionado, quando tentar avançar, então o botão "Continuar" permanece desabilitado.
- ✅ Dado que um ou mais serviços foram selecionados, quando visualizar o botão "Continuar", então o contador de itens selecionados é exibido no botão.

**Cenários de erro / edge cases:**
- Categorias sem subitens (ex: Alinhamento/balanceamento) funcionam como item único togglável diretamente.
- O condutor pode desmarcar um serviço já selecionado antes de avançar.

**Notas de implementação:** `app/nova-os/etapa-2.tsx`, `constants/servicosCategorias.ts`

---

**US-003**
Como condutor,
quero descrever o problema com texto livre e anexar até 5 fotos,
para que o gestor e a oficina tenham contexto visual do que está errado no veículo.

**Critérios de aceitação:**
- ✅ Dado que o condutor está na etapa 3, quando tocar em "Adicionar fotos", então o seletor de imagens da galeria é aberto com permissão solicitada.
- ✅ Dado que 5 fotos já foram adicionadas, quando o limite for atingido, então o botão de adicionar mais fotos desaparece.
- ✅ Dado que uma foto foi adicionada, quando o condutor tocar no ícone de remoção, então a foto é removida da lista.

**Cenários de erro / edge cases:**
- Descrição é opcional; o condutor pode avançar sem preencher texto.
- Se o envio das fotos falhar durante a criação da OS, a OS é criada sem as imagens e uma mensagem de aviso é exibida.
- No ambiente web, fotos placeholder são usadas no lugar do seletor nativo.

**Notas de implementação:** `app/nova-os/etapa-3.tsx`

---

**US-004**
Como condutor,
quero informar a data e o horário desejados para o atendimento e adicionar observações opcionais,
para que o gestor possa organizar o agendamento com a oficina.

**Critérios de aceitação:**
- ✅ Dado que o condutor está na etapa 4 e não selecionou uma data, quando tentar avançar, então o sistema exibe o erro "Selecione uma data prevista para continuar".
- ✅ Dado que o condutor selecionou uma data, quando visualizar o seletor, então apenas datas a partir de hoje são permitidas.
- ✅ Dado que o condutor informou data, horário e observações, quando avançar, então os dados são persistidos no estado do formulário.

**Cenários de erro / edge cases:**
- Horário é opcional; o condutor pode avançar sem selecionar.
- Observações são opcionais.

**Notas de implementação:** `app/nova-os/etapa-4.tsx`

---

**US-005**
Como condutor,
quero revisar todos os dados da OS antes de enviar,
para garantir que as informações estão corretas e poder corrigir qualquer etapa antes da submissão.

**Critérios de aceitação:**
- ✅ Dado que o condutor está na etapa 5, quando visualizar o resumo, então todos os dados das etapas anteriores (veículo, serviços, descrição, fotos, agendamento) são exibidos.
- ✅ Dado que o condutor quiser corrigir uma informação, quando tocar em "Editar" em qualquer seção, então é redirecionado para a etapa correspondente mantendo os dados já preenchidos.

**Cenários de erro / edge cases:**
- Se a descrição e as fotos não foram preenchidas, a seção "Descrição" não aparece no resumo.

**Notas de implementação:** `app/nova-os/etapa-5.tsx`

---

**US-006**
Como condutor,
quero que a OS seja enviada automaticamente ao confirmar no resumo,
para que o gestor seja notificado imediatamente sem que eu precise fazer mais nenhuma ação.

**Critérios de aceitação:**
- ✅ Dado que o condutor confirmou o envio na etapa 5, quando a OS for criada com sucesso, então a tela de confirmação exibe o número da OS.
- ✅ Dado que o envio das fotos falhou mas a OS foi criada, quando a confirmação for exibida, então uma mensagem de aviso específica informa que as fotos não foram enviadas.
- ✅ Dado que a OS foi criada, quando o condutor tocar em "Ir para início", então o fluxo é encerrado e o estado do formulário é limpo.

**Cenários de erro / edge cases:**
- Se a criação da OS falhar completamente (erro de servidor), a tela de erro exibe a mensagem e um botão para voltar ao início.
- O botão voltar e o gesto de swipe são bloqueados na tela de envio para evitar duplicação de OS.

**Notas de implementação:** `app/nova-os/etapa-6.tsx`

---

#### EP-02 — Acompanhamento de OS

**US-007**
Como condutor,
quero visualizar uma lista das minhas OS ativas na tela inicial,
para saber rapidamente o status de cada veículo sem precisar buscar manualmente.

**Critérios de aceitação:**
- ✅ Dado que o condutor abre o app com conexão, quando a tela inicial carregar, então apenas as OS com status ativo (não concluídas) são exibidas em ordem cronológica decrescente.
- ✅ Dado que o condutor está offline, quando a tela for exibida, então um banner de aviso informa a falta de conexão e as OS já carregadas são visíveis, mas o botão de nova OS fica desabilitado.
- ✅ Dado que não há nenhuma OS, quando a lista for renderizada, então uma mensagem de "Nenhuma OS encontrada" é exibida.

**Cenários de erro / edge cases:**
- A lista é atualizada em tempo real: mudanças feitas pelo gestor aparecem automaticamente sem necessidade de recarregar.
- Pull-to-refresh manual está disponível com feedback visual de carregamento.

**Notas de implementação:** `app/(tabs)/index.tsx` — componente `CondutorHome`

---

**US-008**
Como condutor,
quero ver todos os detalhes de uma OS específica ao tocá-la,
para acompanhar as informações do atendimento, o fornecedor atribuído e as mensagens do gestor.

**Critérios de aceitação:**
- ✅ Dado que o condutor abre uma OS, quando a tela de detalhe carregar, então são exibidos: status atual, condutor, hodômetro, cidade, data de abertura, serviços solicitados, descrição, fotos, fornecedor atribuído e linha do tempo de progresso.
- ✅ Dado que o gestor enviou uma mensagem, quando o condutor visualizar o detalhe da OS, então a mensagem aparece em destaque na seção "Mensagem do gestor".
- ✅ Dado que um fornecedor foi atribuído, quando o condutor tocar em "Ver no Google Maps", então o app de mapas é aberto com o endereço da oficina.

**Cenários de erro / edge cases:**
- Valores dos serviços realizados não são exibidos para o condutor (visibilidade restrita ao gestor).
- Fotos podem ser ampliadas em tela cheia ao tocar na miniatura.

**Notas de implementação:** `app/os/[id]/index.tsx`

---

#### EP-03 — Gerenciamento de OS

**US-009**
Como gestor,
quero visualizar todas as OS ativas da frota em um painel com métricas consolidadas,
para priorizar atendimentos e ter visão gerencial em tempo real.

**Critérios de aceitação:**
- ✅ Dado que o gestor abre o painel, quando a tela carregar, então são exibidos contadores de: total de OS, OS em andamento e OS aguardando aprovação.
- ✅ Dado que o gestor seleciona um filtro de status, quando o filtro for aplicado, então apenas as OS naquele status são listadas.
- ✅ Dado que uma nova OS é aberta por um condutor, quando o gestor estiver com o painel aberto, então a OS aparece na lista automaticamente sem recarregar.

**Cenários de erro / edge cases:**
- Pull-to-refresh disponível com timeout de segurança de 2 segundos.
- OS concluídas não aparecem no painel (filtradas no servidor).

**Notas de implementação:** `app/(tabs)/index.tsx` — componente `GestorDashboard`

---

**US-010**
Como gestor,
quero alterar o status de uma OS,
para registrar o progresso do atendimento e manter o condutor informado.

**Critérios de aceitação:**
- ✅ Dado que o gestor está na tela de gerenciar OS, quando selecionar um novo status, então o status selecionado fica destacado visualmente com a cor correspondente.
- ✅ Dado que o gestor salvar as alterações, quando o status mudou, então o histórico de mudanças é atualizado automaticamente com o nome do gestor e o horário da mudança.
- ✅ Dado que o status foi alterado, quando o gestor salvar, então o condutor recebe uma notificação automática informando o novo status.

**Cenários de erro / edge cases:**
- O gestor pode navegar para qualquer status, inclusive "Concluída", sem restrição de ordem.
- Se nenhuma mudança de status ocorrer, o histórico não é atualizado.

**Notas de implementação:** `app/os/[id]/gerenciar.tsx`

---

**US-011**
Como gestor,
quero atribuir um fornecedor (oficina) a uma OS,
para que o condutor saiba onde deve levar o veículo.

**Critérios de aceitação:**
- ✅ Dado que o gestor está na tela de gerenciar OS, quando a OS tiver uma cidade informada, então a lista exibe primeiramente os fornecedores cadastrados naquela cidade.
- ✅ Dado que nenhum fornecedor foi encontrado na cidade da OS, quando a lista for exibida, então todos os fornecedores são listados com um aviso de que não há correspondência de cidade.
- ✅ Dado que o gestor selecionar um fornecedor e salvar, quando o condutor abrir a OS, então os dados da oficina (endereço, horário, responsável, telefone e link do Maps) são exibidos.

**Cenários de erro / edge cases:**
- O gestor pode desatribuir um fornecedor tocando novamente no fornecedor já selecionado.

**Notas de implementação:** `app/os/[id]/gerenciar.tsx`

---

**US-012**
Como gestor,
quero registrar os serviços realizados e seus valores a partir do catálogo,
para controlar os gastos de manutenção por tipo (preventiva/corretiva).

**Critérios de aceitação:**
- ✅ Dado que o gestor está na tela de gerenciar OS, quando tocar em "Adicionar" na seção de serviços realizados, então o modal do catálogo é aberto com campo de busca.
- ✅ Dado que o gestor selecionar um serviço do catálogo, quando o serviço for adicionado, então um campo de valor editável aparece ao lado do nome do serviço.
- ✅ Dado que serviços realizados foram registrados, quando o gestor salvar, então o valor total, o gasto preventivo e o gasto corretivo são calculados e persistidos automaticamente.

**Cenários de erro / edge cases:**
- Serviços já adicionados aparecem desabilitados no catálogo para evitar duplicação.
- O gestor pode remover um serviço adicionado tocando no ícone de lixeira.
- O condutor não vê os valores; apenas os nomes dos serviços e o tipo (preventiva/corretiva) são exibidos para ele.

**Notas de implementação:** `app/os/[id]/gerenciar.tsx`, `services/catalogo.service.ts`

---

**US-013**
Como gestor,
quero enviar uma mensagem ao condutor ao gerenciar a OS,
para comunicar instruções, explicações ou observações sobre o atendimento.

**Critérios de aceitação:**
- ✅ Dado que o gestor escreveu uma mensagem e salvou, quando o condutor abrir o detalhe da OS, então a mensagem é exibida em destaque na seção "Mensagem do gestor".
- ✅ Dado que a mensagem já havia sido enviada anteriormente, quando o gestor abrir a tela de gerenciar, então o campo de mensagem já vem preenchido com o texto anterior.

**Cenários de erro / edge cases:**
- O campo de mensagem é opcional; o gestor pode salvar sem mensagem.

**Notas de implementação:** `app/os/[id]/gerenciar.tsx`

---

#### EP-04 — Notificações push

**US-014**
Como gestor,
quero receber uma notificação imediata quando um condutor abrir uma nova OS,
para reagir rapidamente e iniciar o processo de atendimento.

**Critérios de aceitação:**
- ✅ Dado que um condutor criou uma nova OS, quando a notificação for disparada, então todos os gestores com token registrado recebem uma notificação com o nome do condutor e a placa do veículo.
- ✅ Dado que o gestor tocar na notificação, quando o app for aberto, então o histórico de notificações exibe o evento para consulta posterior.

**Cenários de erro / edge cases:**
- Tokens de dispositivo inválidos ou expirados são automaticamente removidos do cadastro para evitar falhas futuras.
- Se nenhum gestor tiver token registrado, a notificação não é enviada sem gerar erro.

**Notas de implementação:** `functions/src/index.ts` — função `onOSCreated`, `app/notificacoes.tsx`

---

**US-015**
Como condutor,
quero receber uma notificação a cada mudança de status da minha OS,
para saber em tempo real o que está acontecendo com o meu veículo.

**Critérios de aceitação:**
- ✅ Dado que o gestor alterou o status de uma OS, quando a mudança for salva, então o condutor dono da OS recebe uma notificação com o novo status.
- ✅ Dado que o condutor tocou na notificação, quando o app abrir, então a tela de detalhe da OS correspondente é exibida diretamente.

**Cenários de erro / edge cases:**
- Se o status não mudou (apenas outros campos foram editados), nenhuma notificação é disparada.
- Se o token do condutor estiver inválido, o token é removido e nenhuma exceção interrompe o fluxo.

**Notas de implementação:** `functions/src/index.ts` — função `onOSStatusUpdated`

---

**US-016**
Como condutor,
quero receber um lembrete automático no dia agendado da OS,
para não esquecer de levar o veículo à oficina.

**Critérios de aceitação:**
- ✅ Dado que uma OS ativa tem data desejada marcada para hoje, quando o job diário de lembretes executar às 7h (horário de Brasília), então o condutor recebe uma notificação com o nome do veículo e a placa.
- ✅ Dado que o lembrete já foi enviado para uma OS, quando o job executar novamente, então a OS não recebe segundo lembrete.

**Cenários de erro / edge cases:**
- OS concluídas não recebem lembrete.
- O lembrete não é enviado se o condutor não tiver token registrado.

**Notas de implementação:** `functions/src/index.ts` — função `enviarLembretesOS`

---

**US-017**
Como qualquer usuário,
quero visualizar o histórico de notificações recebidas,
para consultar alertas anteriores que não vi no momento do recebimento.

**Critérios de aceitação:**
- ✅ Dado que o usuário abre a tela de notificações, quando houver itens não lidos, então eles são destacados visualmente com fundo diferenciado e um indicador azul.
- ✅ Dado que o usuário tocar em uma notificação não lida, quando a ação for executada, então a notificação é marcada como lida e o usuário é redirecionado para a OS correspondente.
- ✅ Dado que há múltiplas notificações não lidas, quando o usuário tocar em "Marcar todas", então todas são marcadas como lidas de uma vez.

**Cenários de erro / edge cases:**
- Se não há notificações, uma tela de estado vazio é exibida.
- Notificações são agrupadas por "Hoje", "Ontem" e "Mais antigas".

**Notas de implementação:** `app/notificacoes.tsx`

---

#### EP-05 — Gestão de veículos

**US-018**
Como gestor,
quero cadastrar um novo veículo na frota,
para que os condutores possam identificá-lo ao abrir uma OS.

**Critérios de aceitação:**
- ✅ Dado que o gestor está na tela de veículos e toca no botão "+", quando o modal de cadastro abrir, então os campos placa, número de frota, modelo, ano e departamento são obrigatórios.
- ✅ Dado que o gestor preenche os dados corretamente e salva, quando o cadastro for concluído, então o veículo aparece na lista imediatamente.
- ✅ Dado que a placa informada já existe, quando o gestor tentar salvar, então ⚠️ comportamento a confirmar com o produto.

**Cenários de erro / edge cases:**
- Ano deve ter exatamente 4 dígitos numéricos.
- O campo "Ativo" é um toggle que define se o veículo pode receber novas OS.

**Notas de implementação:** `app/(tabs)/veiculos.tsx`

---

**US-019**
Como gestor,
quero editar os dados de um veículo existente ou desativá-lo,
para manter o cadastro atualizado e impedir abertura de OS em veículos fora de uso.

**Critérios de aceitação:**
- ✅ Dado que o gestor toca no ícone de edição em um veículo, quando o modal abrir, então os campos vêm preenchidos com os dados atuais.
- ✅ Dado que o gestor desativar o toggle "Ativo" e salvar, quando um condutor tentar usar a placa deste veículo em uma nova OS, então o sistema bloqueia o avanço com a mensagem "Veículo inativo".

**Cenários de erro / edge cases:**
- A lista é recarregada automaticamente após salvar para refletir as mudanças.

**Notas de implementação:** `app/(tabs)/veiculos.tsx`, `app/nova-os/etapa-1.tsx`

---

**US-020**
Como gestor,
quero excluir um veículo da frota,
para remover registros de veículos vendidos ou descomissionados.

**Critérios de aceitação:**
- ✅ Dado que o gestor toca no ícone de lixeira de um veículo, quando a ação for iniciada, então um diálogo de confirmação é exibido antes de excluir.
- ✅ Dado que o gestor confirmar a exclusão, quando a operação for concluída, então o veículo desaparece da lista imediatamente.

**Cenários de erro / edge cases:**
- A exclusão é permanente e não pode ser desfeita (mensagem de aviso no diálogo).

**Notas de implementação:** `app/(tabs)/veiculos.tsx`

---

**US-021**
Como gestor,
quero buscar veículos na lista por placa, modelo ou número de frota,
para localizar rapidamente um veículo específico em frotas grandes.

**Critérios de aceitação:**
- ✅ Dado que o gestor digita no campo de busca, quando o texto tiver 1 ou mais caracteres, então a lista é filtrada em tempo real (com debounce de 350ms).
- ✅ Dado que o gestor limpar o campo de busca, quando o campo ficar vazio, então a lista retorna ao modo paginado normal.

**Cenários de erro / edge cases:**
- A busca carrega todos os veículos do servidor antes de filtrar localmente.

**Notas de implementação:** `app/(tabs)/veiculos.tsx`

---

#### EP-06 — Gestão de fornecedores

**US-022**
Como gestor,
quero cadastrar um novo fornecedor (oficina) com localização e contato,
para que possa ser atribuído a OS e os condutores saibam onde ir.

**Critérios de aceitação:**
- ✅ Dado que o gestor está na tela de fornecedores e toca no botão "+", quando o modal de cadastro abrir, então os campos nome, cidade, endereço, horário, responsável e telefone são obrigatórios.
- ✅ Dado que o gestor informar um link do Google Maps, quando o condutor abrir a OS com este fornecedor, então o botão "Ver no Google Maps" abre o aplicativo de mapas no endereço da oficina.
- ✅ Dado que o fornecedor foi cadastrado com sucesso, quando a lista for atualizada, então ele aparece agrupado pela cidade correspondente.

**Cenários de erro / edge cases:**
- O link do Google Maps é opcional.
- A URL do Maps deve ter formato válido se informada (validação de URL).

**Notas de implementação:** `app/(tabs)/fornecedores.tsx`

---

**US-023**
Como gestor,
quero editar e excluir fornecedores cadastrados,
para manter a base de oficinas atualizada conforme parcerias mudam.

**Critérios de aceitação:**
- ✅ Dado que o gestor toca no ícone de edição de um fornecedor, quando o modal abrir, então todos os campos vêm preenchidos.
- ✅ Dado que o gestor confirmar a exclusão, quando a operação for concluída, então o fornecedor é removido da lista imediatamente.

**Cenários de erro / edge cases:**
- Um diálogo de confirmação é exibido antes de excluir.

**Notas de implementação:** `app/(tabs)/fornecedores.tsx`

---

**US-024**
Como gestor,
quero buscar fornecedores por nome ou cidade,
para localizar rapidamente uma oficina em uma determinada localidade.

**Critérios de aceitação:**
- ✅ Dado que o gestor digita no campo de busca, quando o texto for inserido, então a lista é filtrada por nome ou cidade com debounce de 350ms.
- ✅ Dado que o gestor limpar o campo, quando o campo ficar vazio, então a lista retorna ao modo paginado agrupado por cidade.

**Notas de implementação:** `app/(tabs)/fornecedores.tsx`

---

#### EP-07 — Gestão de usuários / condutores

**US-025**
Como gestor,
quero criar uma conta de acesso para um novo condutor (ou gestor),
para que ele possa entrar no app sem precisar se registrar sozinho.

**Critérios de aceitação:**
- ✅ Dado que o gestor está na tela de novo usuário, quando preencher nome, e-mail, departamento, senha e perfil, então uma confirmação com o resumo dos dados é exibida antes de criar a conta.
- ✅ Dado que o gestor confirmar a criação, quando a conta for criada com sucesso, então uma mensagem de confirmação é exibida e o gestor é redirecionado após 1,8 segundos.
- ✅ Dado que o e-mail informado já está cadastrado, quando o gestor tentar criar, então a mensagem "E-mail já cadastrado" é exibida.

**Cenários de erro / edge cases:**
- A criação da conta não desconecta o gestor da sua própria sessão.
- Senha deve ter no mínimo 6 caracteres.
- Os dois campos de senha devem coincidir.
- O perfil pode ser "Condutor" ou "Gestor".

**Notas de implementação:** `app/novo-usuario.tsx`

---

#### EP-08 — Catálogo de serviços

**US-026**
Como gestor,
quero criar serviços no catálogo com nome e tipo (preventiva ou corretiva),
para que possam ser usados ao registrar serviços realizados em uma OS.

**Critérios de aceitação:**
- ✅ Dado que o gestor está no catálogo e toca no ícone "+", quando o modal abrir, então os campos nome e tipo são obrigatórios.
- ✅ Dado que o gestor salvar um novo serviço, quando o modal fechar, então o serviço aparece na lista em tempo real.
- ✅ Dado que um serviço foi criado, quando for listado, então ele exibe uma tag de cor diferente para "Preventiva" (verde) e "Corretiva" (azul).

**Cenários de erro / edge cases:**
- Não é possível salvar com o campo de nome vazio.

**Notas de implementação:** `app/catalogo-servicos.tsx`

---

**US-027**
Como gestor,
quero ativar ou desativar um serviço do catálogo,
para controlar quais serviços ficam disponíveis para seleção ao gerenciar uma OS.

**Critérios de aceitação:**
- ✅ Dado que um serviço está ativo, quando o gestor alternar o toggle para inativo, então o serviço não aparece mais nas opções ao adicionar serviços realizados em uma OS.
- ✅ Dado que o serviço está inativo, quando listado no catálogo, então o nome é exibido em tom acinzentado indicando o estado inativo.

**Notas de implementação:** `app/catalogo-servicos.tsx`, `services/catalogo.service.ts`

---

**US-028**
Como gestor,
quero editar o nome e o tipo de um serviço existente no catálogo,
para corrigir erros ou atualizar a nomenclatura conforme necessário.

**Critérios de aceitação:**
- ✅ Dado que o gestor tocar em um serviço na lista, quando o modal de edição abrir, então os campos vêm preenchidos com os dados atuais.
- ✅ Dado que o gestor salvar a edição, quando o modal fechar, então a lista é atualizada imediatamente com o novo nome.

**Notas de implementação:** `app/catalogo-servicos.tsx`

---

#### EP-09 — Autenticação e perfil

**US-029**
Como usuário,
quero entrar no app com meu e-mail e senha,
para acessar as funcionalidades do sistema conforme meu perfil.

**Critérios de aceitação:**
- ✅ Dado que o usuário está na tela de login e preenche e-mail e senha corretos, quando tocar em "Entrar", então é redirecionado para a tela inicial correspondente ao seu perfil (condutor ou gestor).
- ✅ Dado que o e-mail ou senha estão incorretos, quando o login falhar, então um banner de erro com a mensagem "E-mail ou senha incorretos" é exibido.
- ✅ Dado que o usuário fez muitas tentativas falhas, quando o sistema bloquear temporariamente, então a mensagem "Muitas tentativas. Aguarde e tente novamente." é exibida.

**Cenários de erro / edge cases:**
- E-mail inválido (sem @) exibe erro de validação no próprio campo antes de enviar.
- Erro de rede exibe a mensagem "Sem conexão. Verifique sua internet."
- Contas desativadas pelo administrador exibem a mensagem "Sua conta foi desativada. Entre em contato com o gestor."

**Notas de implementação:** `app/login.tsx`, `services/auth.service.ts`

---

**US-030**
Como usuário,
quero visualizar meu perfil com nome, foto, e-mail e departamento,
para confirmar minhas informações de cadastro.

**Critérios de aceitação:**
- ✅ Dado que o usuário acessa a tela de perfil, quando a tela carregar, então são exibidos nome completo, foto (ou iniciais), e-mail, departamento e tipo de perfil (Condutor ou Gestor de Frotas).
- ✅ Dado que o usuário ainda não tem foto de perfil, quando a tela for exibida, então as iniciais do nome são mostradas em um círculo colorido no lugar da foto.

**Notas de implementação:** `app/(tabs)/profile.tsx`, `app/perfil.tsx`

---

**US-031**
Como usuário,
quero adicionar ou alterar minha foto de perfil,
para que minha identidade seja reconhecida nas OS e no painel.

**Critérios de aceitação:**
- ✅ Dado que o usuário toca na foto de perfil, quando a galeria for acessada, então o sistema solicita permissão de acesso à galeria antes de abrir o seletor.
- ✅ Dado que o usuário selecionar uma imagem, quando o upload for iniciado, então um indicador de progresso percentual é exibido sobre a foto.
- ✅ Dado que o upload for concluído com sucesso, quando a tela atualizar, então a nova foto é exibida imediatamente.

**Cenários de erro / edge cases:**
- Se a permissão de galeria for negada, um alerta é exibido pedindo que o usuário permita o acesso nas configurações.
- O usuário pode remover a foto tocando em "Remover foto" (opção visível somente quando há foto).

**Notas de implementação:** `app/(tabs)/profile.tsx`

---

**US-032**
Como usuário,
quero alterar minha senha de acesso,
para manter a segurança da minha conta.

**Critérios de aceitação:**
- ✅ Dado que o usuário expande a seção de alteração de senha, quando preencher a senha atual e a nova senha (com confirmação), então pode salvar a alteração.
- ✅ Dado que a nova senha e a confirmação não coincidem, quando tentar salvar, então um erro "As senhas não coincidem" é exibido no campo de confirmação.
- ✅ Dado que a senha atual estiver incorreta, quando o usuário tentar salvar, então a mensagem "E-mail ou senha incorretos" é exibida.

**Cenários de erro / edge cases:**
- A nova senha deve ter no mínimo 6 caracteres.
- Após alteração com sucesso, o formulário é recolhido e limpo.

**Notas de implementação:** `app/(tabs)/profile.tsx`, `services/auth.service.ts`

---

**US-033**
Como usuário,
quero sair do aplicativo de forma segura,
para proteger minha conta em dispositivos compartilhados.

**Critérios de aceitação:**
- ✅ Dado que o usuário toca em "Sair do aplicativo", quando a ação for iniciada em dispositivo móvel, então um diálogo de confirmação é exibido.
- ✅ Dado que o usuário confirmar a saída, quando o logout for concluído, então o usuário é redirecionado para a tela de login.

**Notas de implementação:** `app/(tabs)/profile.tsx`, `app/(tabs)/configuracoes.tsx`

---

#### EP-10 — Relatórios por período

**US-034** ❌ não implementado
Como gestor,
quero gerar relatórios de OS e custos por período de tempo,
para analisar tendências de manutenção, custos por veículo e eficiência da frota.

**Critérios de aceitação:**
- ✅ Dado que o gestor selecionar um período (início e fim), quando o relatório for gerado, então os dados de OS, custos preventivos e corretivos do período são exibidos.
- ✅ Dado que o relatório for exibido, quando o gestor quiser exportar, então o relatório pode ser compartilhado ou exportado.

**Cenários de erro / edge cases:**
- Se não houver dados no período selecionado, uma mensagem de estado vazio é exibida.

**Notas de implementação:** ❌ não implementado — tela e serviço não encontrados no código

---

## 5. Definition of Done

Uma User Story está concluída quando:

- [ ] A tela ou fluxo está implementado e navegável sem erros de runtime
- [ ] Todos os campos obrigatórios têm validação ativa (campo em estado de erro com mensagem descritiva)
- [ ] O estado de carregamento (loading) é sinalizado visualmente (indicador de progresso ou botão desabilitado)
- [ ] Erros de servidor ou de rede são capturados e exibidos ao usuário em linguagem compreensível
- [ ] O comportamento offline está definido: ou o fluxo é bloqueado com mensagem explicativa, ou os dados já carregados são exibidos em modo somente leitura
- [ ] A notificação push correspondente é disparada quando aplicável (criação de OS notifica gestores; mudança de status notifica condutor)
- [ ] O acesso à funcionalidade está restrito ao perfil correto: condutores não veem telas de gestor, e vice-versa
- [ ] O estado do formulário é limpo após conclusão com sucesso, evitando reenvio acidental
- [ ] A tela funciona corretamente tanto para condutor quanto para gestor quando a visualização é compartilhada (ex: detalhe da OS exibe ou oculta campos de valor conforme o perfil)

---

## 6. Mapa de Cobertura

| Épico | Condutor | Gestor |
|-------|----------|--------|
| EP-01: Abertura de OS | ✅ Completo | ➖ N/A |
| EP-02: Acompanhamento de OS | ✅ Completo | ➖ N/A |
| EP-03: Gerenciamento de OS | ➖ N/A | ✅ Completo |
| EP-04: Notificações push | ✅ Completo | ✅ Completo |
| EP-05: Gestão de veículos | ➖ N/A | ✅ Completo |
| EP-06: Gestão de fornecedores | ➖ N/A | ✅ Completo |
| EP-07: Gestão de usuários / condutores | ➖ N/A | ✅ Completo |
| EP-08: Catálogo de serviços | ➖ N/A | ✅ Completo |
| EP-09: Autenticação e perfil | ✅ Completo | ✅ Completo |
| EP-10: Relatórios por período | ❌ Não implementado | ❌ Não implementado |
