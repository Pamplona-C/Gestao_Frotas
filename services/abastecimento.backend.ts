/**
 * Abastecimentos via moovia-backend (REST).
 *
 *   app              backend
 *   ---              -------
 *   valor         ↔  valorTotal
 *   litros        ↔  quantidadeLitros
 *   fotoUrl       ↔  fotoCupomUrl
 *   criadoEm      ↔  dataLancamento
 *   'gasolina'    ↔  'GASOLINA'   (o app usa minúsculo, o enum do backend maiúsculo)
 *
 * **Quem some no caminho:** `condutorId` vai no token, não no corpo — quem lança
 * é sempre quem está logado. `competencia` e `status` o app derivava na mão;
 * aqui `competencia` sai da data e `status` é sempre 'pago' (abastecimento não
 * passa por aprovação — despesa é outro fluxo).
 *
 * **O que a listagem não traz:** o backend devolve o `veiculoId`, mas não a
 * placa nem o número de frota. Nenhuma tela consome a listagem hoje; se voltar a
 * consumir, ou o backend passa a devolver, ou a tela cruza com o cadastro do
 * veículo.
 */
import { api } from '../lib/api';
import { Abastecimento, TipoCombustivel } from '../types';
import { uploadFotosGenerica } from './storage.service';
import type { NovoAbastecimentoInput } from './abastecimento.service';

type TipoCombustivelBackend =
  | 'GASOLINA'
  | 'ETANOL'
  | 'DIESEL'
  | 'DIESEL_S10'
  | 'GNV'
  | 'FLEX'
  | 'ELETRICO';

interface AbastecimentoResponse {
  id: string;
  veiculoId: string;
  condutorId: string;
  condutorNome: string;
  tipoCombustivel: TipoCombustivelBackend;
  valorTotal: number;
  quantidadeLitros: number | null;
  hodometro: number | null;
  fotoCupomUrl: string | null;
  dataLancamento: string;
}

/**
 * O backend conhece dois combustíveis que o app não oferece no seletor
 * (DIESEL_S10 e FLEX) — só aparecem em lançamentos feitos fora do app. Eles
 * caem no rótulo mais próximo, já que o valor só decide o texto exibido.
 */
function tipoParaApp(tipo: TipoCombustivelBackend): TipoCombustivel {
  if (tipo === 'DIESEL_S10') return 'diesel';
  if (tipo === 'FLEX') return 'gasolina';
  return tipo.toLowerCase() as TipoCombustivel;
}

function paraAbastecimento(a: AbastecimentoResponse): Abastecimento {
  return {
    id: a.id,
    tipo: 'abastecimento',
    condutorId: a.condutorId,
    condutorNome: a.condutorNome ?? '',
    veiculoId: a.veiculoId,
    veiculoPlaca: '',
    veiculoFrota: '',
    hodometro: a.hodometro ?? undefined,
    tipoCombustivel: tipoParaApp(a.tipoCombustivel),
    litros: a.quantidadeLitros ?? undefined,
    valor: a.valorTotal,
    fotoUrl: a.fotoCupomUrl ?? undefined,
    criadoEm: a.dataLancamento,
    competencia: a.dataLancamento.slice(0, 7),
    status: 'pago',
  };
}

export async function criarAbastecimento(
  input: NovoAbastecimentoInput,
  fotoUri?: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  // A foto sobe ANTES do lançamento — invertido em relação ao Firebase, onde o
  // documento era criado primeiro e a URL entrava depois num update. Aqui o
  // lançamento é uma requisição só, então a URL precisa estar pronta.
  //
  // Efeito colateral: se o lançamento falhar, a foto fica órfã no storage. É o
  // lado melhor da troca — antes o risco era o oposto, um abastecimento gravado
  // sem o cupom que o comprova.
  let fotoCupomUrl: string | undefined;
  if (fotoUri) {
    const urls = await uploadFotosGenerica(
      [fotoUri],
      `abastecimento-fotos/${input.veiculoId}`,
      onProgress,
    );
    fotoCupomUrl = urls[0];
  }

  const criado = await api.post<AbastecimentoResponse>(
    `/veiculos/${input.veiculoId}/abastecimentos`,
    {
      tipoCombustivel: input.tipoCombustivel.toUpperCase(),
      valorTotal: input.valor,
      quantidadeLitros: input.litros ?? null,
      hodometro: input.hodometro ?? null,
      fotoCupomUrl: fotoCupomUrl ?? null,
    },
  );

  return criado.id;
}

/** Uma busca só — sem tempo real. A tela recarrega ao ganhar foco. */
export async function listarPorCondutor(condutorId: string): Promise<Abastecimento[]> {
  const lista = await api.get<AbastecimentoResponse[]>(
    `/condutores/${condutorId}/abastecimentos`,
  );
  return lista.map(paraAbastecimento);
}
