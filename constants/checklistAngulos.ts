import { VeiculoTipo } from '../types';

export const CHECKLIST_ANGULOS_CARRO = [
  'frente',
  'traseira',
  'lateral_dianteira_e',
  'lateral_dianteira_d',
  'lateral_traseira_e',
  'lateral_traseira_d',
  'lanterna_e',
  'lanterna_d',
  'farol_e',
  'farol_d',
  'bancos',
  'bancos_painel',
  'hodometro',
  'kit_estepe',
  'motor',
  'pneu_dianteiro_e',
  'pneu_dianteiro_d',
  'pneu_traseiro_e',
  'pneu_traseiro_d',
  'cartao_documentos',
] as const;

export const CHECKLIST_ANGULOS_MOTO = [
  'lateral_direita',
  'lateral_esquerda',
  'farol',
  'motor',
  'cartao_abastecimento',
  'nota_fiscal',
] as const;

export type ChecklistAnguloCarro = typeof CHECKLIST_ANGULOS_CARRO[number];
export type ChecklistAnguloMoto  = typeof CHECKLIST_ANGULOS_MOTO[number];
export type ChecklistAngulo = ChecklistAnguloCarro | ChecklistAnguloMoto;

export const CHECKLIST_ANGULO_LABELS: Record<ChecklistAngulo, string> = {
  // Carro
  frente:              'Frente do veículo',
  traseira:            'Traseira do veículo',
  lateral_dianteira_e: 'Lateral dianteira E',
  lateral_dianteira_d: 'Lateral dianteira D',
  lateral_traseira_e:  'Lateral traseira E',
  lateral_traseira_d:  'Lateral traseira D',
  lanterna_e:          'Lanterna E',
  lanterna_d:          'Lanterna D',
  farol_e:             'Farol E',
  farol_d:             'Farol D',
  bancos:              'Bancos',
  bancos_painel:       'Bancos e painel',
  hodometro:           'Hodômetro',
  kit_estepe:          'Kit estepe',
  motor:               'Motor',
  pneu_dianteiro_e:    'Pneu dianteiro E',
  pneu_dianteiro_d:    'Pneu dianteiro D',
  pneu_traseiro_e:     'Pneu traseiro E',
  pneu_traseiro_d:     'Pneu traseiro D',
  cartao_documentos:   'Cartão e documentos',
  // Moto
  lateral_direita:      'Lateral direita',
  lateral_esquerda:     'Lateral esquerda',
  farol:                'Farol',
  cartao_abastecimento: 'Cartão de abastecimento',
  nota_fiscal:          'Nota fiscal',
};

export function getAngulosByTipo(tipo: VeiculoTipo): readonly string[] {
  return tipo === 'moto' ? CHECKLIST_ANGULOS_MOTO : CHECKLIST_ANGULOS_CARRO;
}
