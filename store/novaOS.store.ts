import { create } from 'zustand';
import { OSTipo } from '../types';

interface NovaOSState {
  // Etapa 1
  placa: string;
  hodometro: string;
  cidade: string;
  // Etapa 2
  tipo: OSTipo | '';
  servicosSelecionados: string[];
  // Etapa 3
  descricao: string;
  fotos: string[];
  // Etapa 4
  dataDesejada: string;
  horario: string;
  observacoes: string;

  setPlaca: (v: string) => void;
  setHodometro: (v: string) => void;
  setCidade: (v: string) => void;
  setTipo: (v: OSTipo | '') => void;
  setServicosSelecionados: (v: string[]) => void;
  setDescricao: (v: string) => void;
  setFotos: (v: string[]) => void;
  setDataDesejada: (v: string) => void;
  setHorario: (v: string) => void;
  setObservacoes: (v: string) => void;
  reset: () => void;
}

const initialState = {
  placa: '',
  hodometro: '',
  cidade: '',
  tipo: '' as OSTipo | '',
  servicosSelecionados: [] as string[],
  descricao: '',
  fotos: [] as string[],
  dataDesejada: '',
  horario: '',
  observacoes: '',
};

export const useNovaOSStore = create<NovaOSState>((set) => ({
  ...initialState,
  setPlaca: (placa) => set({ placa }),
  setHodometro: (hodometro) => set({ hodometro }),
  setCidade: (cidade) => set({ cidade }),
  setTipo: (tipo) => set({ tipo }),
  setServicosSelecionados: (servicosSelecionados) => set({ servicosSelecionados }),
  setDescricao: (descricao) => set({ descricao }),
  setFotos: (fotos) => set({ fotos }),
  setDataDesejada: (dataDesejada) => set({ dataDesejada }),
  setHorario: (horario) => set({ horario }),
  setObservacoes: (observacoes) => set({ observacoes }),
  reset: () => set(initialState),
}));
