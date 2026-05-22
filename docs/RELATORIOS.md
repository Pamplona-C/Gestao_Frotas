# FrotaAtiva — Relatórios Possíveis com os Dados Atuais

> Atualizado: 2026-05-21

---

## Financeiros

| Relatório | Campos usados | Insight |
|-----------|--------------|---------|
| Gasto total por veículo (preventiva + corretiva) | `gastoPreventiva`, `gastoCorretiva`, `veiculoId` | Identifica quais carros custam mais |
| Ratio preventiva vs corretiva por frota | `gastoPreventiva`, `gastoCorretiva` agregados | Ratio saudável ~70/30; alta corretiva = frota envelhecendo ou mal cuidada |
| Gasto por departamento | `condutorId` → `usuarios.departamento` + valores da OS | Rateio de custo por área |
| Serviços mais realizados e seus custos | `servicosRealizados[].nome`, `valor` | Onde o dinheiro vai |
| Custo médio por OS | `valorTotal` + count de OSs | Benchmark de atendimento |

---

## Operacionais

| Relatório | Campos usados | Insight |
|-----------|--------------|---------|
| Tempo médio de resolução de OS | `statusHistory` (criadoEm até `concluida`) | Gargalos no processo |
| Tempo em cada status | `statusHistory[].changedAt` — delta entre cada status | Onde as OSs ficam paradas |
| Fornecedor mais utilizado / mais rápido | `fornecedorId`, tempo `em_andamento → concluida` | Avaliação de parceiros |
| OSs por cidade | `cidade` | Concentração geográfica de problemas |
| Volume de OSs por período | `criadoEm` agrupado por mês | Sazonalidade / tendência |

---

## Frota e Veículos

| Relatório | Campos usados | Insight |
|-----------|--------------|---------|
| Veículos com mais OSs | `veiculoId` + count | Candidatos à substituição |
| Veículos sem OS nos últimos N meses | `veiculoId` + `criadoEm` | Frota ociosa ou sub-reportada |
| Histórico completo de um veículo | OSs + vínculos + checklists por `veiculoId` | Due diligence antes de vender/alienar |
| Tempo médio de uso por vínculo | `vinculos.criadoEm` até `encerradoEm` | Rotatividade de condutores por veículo |

---

## Condutores

| Relatório | Campos usados | Insight |
|-----------|--------------|---------|
| Condutor que mais abre OS | `condutorId` + count | Problema com o condutor ou com o veículo atribuído |
| Tempo até fazer checklist de entrada | `vinculos.criadoEm` vs `checklists.completadoEm` (tipo entrada) | Conformidade com o processo |
| Checklists de saída pendentes há mais de X dias | vínculos `inativo` sem `checklistSaidaId` + `encerradoEm` | Pendências em aberto |
| Observações mais frequentes nos checklists | `checklists.observacoes` | Avarias recorrentes |

---

## O que falta para desbloquear relatórios mais ricos

| Campo ausente | Relatório que habilita |
|--------------|----------------------|
| `hodometro` consistente por OS (hoje é opcional) | Custo por km rodado |
| `kmAtual` atualizado a cada OS | Curva de desgaste do veículo |
| Data de conclusão real na OS | Diferença entre data desejada vs data real |
| Valor separado por serviço no catálogo (hoje é por OS) | Ticket médio por tipo de serviço |

---

## Prioridade sugerida de implementação

1. **Gasto por veículo** — financeiro direto, fácil de agregar com `gastoPreventiva` + `gastoCorretiva`
2. **Ratio preventiva/corretiva** — indicador de saúde da frota
3. **Tempo médio de resolução de OS** — eficiência operacional via `statusHistory`
