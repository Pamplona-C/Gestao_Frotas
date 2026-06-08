# Data Model — Firestore

Gerado automaticamente em 2026-06-08 via `scripts/gerar-data-model.mjs`.
Cada tabela mostra os campos encontrados nos primeiros 30 documentos de cada coleção.
"Obrigatório" significa presente em todos os documentos amostrados.

---

## `usuarios`

Documentos amostrados: **16**

| Campo | Tipo(s) | Obrigatório |
|---|---|---|
| `ativo` | boolean | sim |
| `criadoEm` | Timestamp | não (15/16) |
| `departamento` | string | não (15/16) |
| `departamentoBusca` | string | não (12/16) |
| `email` | string | sim |
| `fcmToken` | string | não (12/16) |
| `nome` | string | sim |
| `nomeBusca` | string | não (12/16) |
| `perfil` | string | sim |
| `photoURL` | string \| null | sim |
| `uid` | string | não (1/16) |

## `veiculos`

Documentos amostrados: **30**

| Campo | Tipo(s) | Obrigatório |
|---|---|---|
| `ano` | number | sim |
| `ativo` | boolean | sim |
| `departamento` | string | sim |
| `frota` | string | sim |
| `marca` | string | não (1/30) |
| `modelo` | string | sim |
| `placa` | string | sim |
| `tipo` | string | não (1/30) |

## `fornecedores`

Documentos amostrados: **30**

| Campo | Tipo(s) | Obrigatório |
|---|---|---|
| `atualizadoEm` | Timestamp | não (1/30) |
| `categoriaIds` | array<string> | não (10/30) |
| `categoriaNomes` | array<string> | não (5/30) |
| `cep` | string | não (14/30) |
| `cidade` | string | sim |
| `endereco` | string | sim |
| `estado` | string | não (14/30) |
| `googleMapsUrl` | string | não (15/30) |
| `horario` | string | sim |
| `nome` | string | sim |
| `numero` | string | não (14/30) |
| `responsavel` | string | sim |
| `telefone` | string | sim |

## `ordens-servico`

Documentos amostrados: **27**

| Campo | Tipo(s) | Obrigatório |
|---|---|---|
| `cidade` | string | sim |
| `condutorDepartamento` | string | sim |
| `condutorId` | string | sim |
| `condutorNome` | string | sim |
| `condutorPhotoURL` | string \| null | sim |
| `criadoEm` | Timestamp | sim |
| `dataDesejada` | string | sim |
| `descricao` | string | não (13/27) |
| `entregueOficinaEm` | string | não (9/27) |
| `fornecedorId` | string | não (24/27) |
| `fornecedorNome` | string | não (7/27) |
| `fotos` | array<string> | não (13/27) |
| `frota` | string | sim |
| `gastoCorretiva` | number | não (16/27) |
| `gastoPreventiva` | number | não (16/27) |
| `gestorDepartamento` | string | não (22/27) |
| `gestorId` | string | não (26/27) |
| `gestorNome` | string | não (26/27) |
| `gestorPhotoURL` | string | não (26/27) |
| `hodometro` | number | sim |
| `horario` | string | não (26/27) |
| `lembreteEnviadoEm` | Timestamp | não (8/27) |
| `notaInterna` | string | não (14/27) |
| `numeroOs` | string | não (26/27) |
| `observacoes` | string | não (6/27) |
| `placa` | string | sim |
| `retornouOficinaEm` | string | não (6/27) |
| `servicos` | array<string> | sim |
| `servicosRealizados` | array<map> \| array | não (24/27) |
| `status` | string | sim |
| `statusHistory` | array<map> | sim |
| `valorTotal` | number | não (24/27) |
| `veiculoId` | string | sim |
| `veiculoMarca` | string | não (10/27) |
| `veiculoModelo` | string | sim |
| `veiculoTipo` | string | sim |

## `vinculos`

Documentos amostrados: **11**

| Campo | Tipo(s) | Obrigatório |
|---|---|---|
| `checklistEntradaId` | string | não (8/11) |
| `checklistSaidaId` | string | não (3/11) |
| `condutorId` | string | sim |
| `condutorId2` | string | não (3/11) |
| `condutorIds` | array<string> | sim |
| `condutorNome` | string | sim |
| `condutorNome2` | string | não (3/11) |
| `criadoEm` | string | sim |
| `encerradoEm` | string | não (3/11) |
| `gestorId` | string | sim |
| `pendenciaChecklist` | null \| string | sim |
| `status` | string | sim |
| `veiculoFrota` | string | sim |
| `veiculoId` | string | sim |
| `veiculoMarca` | string | sim |
| `veiculoModelo` | string | sim |
| `veiculoPlaca` | string | sim |
| `veiculoTipo` | string | sim |

## `checklists`

Documentos amostrados: **26**

| Campo | Tipo(s) | Obrigatório |
|---|---|---|
| `completadoEm` | string | sim |
| `condutorId` | string | sim |
| `fotos` | map | sim |
| `observacoes` | string | não (3/26) |
| `tipo` | string | sim |
| `veiculoId` | string | sim |
| `veiculoTipo` | string | sim |
| `vinculoId` | string | sim |

## `categorias-fornecedor`

Documentos amostrados: **0**

_Coleção vazia ou sem documentos._

## `departamentos`

Documentos amostrados: **0**

_Coleção vazia ou sem documentos._

## `despesas-veiculo`

Documentos amostrados: **11**

| Campo | Tipo(s) | Obrigatório |
|---|---|---|
| `competencia` | string | sim |
| `criadoEm` | Timestamp | sim |
| `dataPagamento` | string | não (10/11) |
| `dataVencimento` | string | não (3/11) |
| `descricao` | string | não (1/11) |
| `gestorId` | string | sim |
| `gestorNome` | string | sim |
| `observacoes` | string | não (5/11) |
| `status` | string | sim |
| `tipo` | string | sim |
| `valor` | number | sim |
| `veiculoFrota` | string | sim |
| `veiculoId` | string | sim |
| `veiculoPlaca` | string | sim |

## `notificacoes`

Documentos amostrados: **30**

| Campo | Tipo(s) | Obrigatório |
|---|---|---|
| `body` | string | sim |
| `createdAt` | Timestamp | sim |
| `expiresAt` | Timestamp | sim |
| `osId` | string | sim |
| `read` | boolean | sim |
| `readAt` | Timestamp | não (1/30) |
| `title` | string | sim |
| `type` | string | sim |
| `userId` | string | sim |
