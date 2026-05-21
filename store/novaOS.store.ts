import { create } from 'zustand';
import { VeiculoTipo } from '../types';

interface NovaOSState {
  // Etapa 1
  veiculoId:   string;
  veiculoTipo: VeiculoTipo | '';
  placa:       string;
  frota:       string;
  hodometro:   string;
  cidade:      string;
  // Etapa 2
  servicosSelecionados: string[];
  // Etapa 3
  descricao: string;
  fotos:     string[];
  // Etapa 4
  dataDesejada: string;
  horario:      string;
  observacoes:  string;

  setVeiculoId:   (v: string) => void;
  setVeiculoTipo: (v: VeiculoTipo | '') => void;
  setPlaca:       (v: string) => void;
  setFrota:       (v: string) => void;
  setHodometro:   (v: string) => void;
  setCidade:      (v: string) => void;
  setServicosSelecionados: (v: string[]) => void;
  setDescricao:   (v: string) => void;
  setFotos:       (v: string[]) => void;
  setDataDesejada:(v: string) => void;
  setHorario:     (v: string) => void;
  setObservacoes: (v: string) => void;
  reset: () => void;
}

const initialState = {
  veiculoId:   '',
  veiculoTipo: '' as VeiculoTipo | '',
  placa:       '',
  frota:       '',
  hodometro:   '',
  cidade:      '',
  servicosSelecionados: [] as string[],
  descricao:   '',
  fotos:       [] as string[],
  dataDesejada:'',
  horario:     '',
  observacoes: '',
};

export const useNovaOSStore = create<NovaOSState>((set) => ({
  ...initialState,
  setVeiculoId:   (veiculoId)   => set({ veiculoId }),
  setVeiculoTipo: (veiculoTipo) => set({ veiculoTipo }),
  setPlaca:       (placa)       => set({ placa }),
  setFrota:       (frota)       => set({ frota }),
  setHodometro:   (hodometro)   => set({ hodometro }),
  setCidade:      (cidade)      => set({ cidade }),
  setServicosSelecionados: (servicosSelecionados) => set({ servicosSelecionados }),
  setDescricao:   (descricao)   => set({ descricao }),
  setFotos:       (fotos)       => set({ fotos }),
  setDataDesejada:(dataDesejada)=> set({ dataDesejada }),
  setHorario:     (horario)     => set({ horario }),
  setObservacoes: (observacoes) => set({ observacoes }),
  reset: () => set(initialState),
}));
