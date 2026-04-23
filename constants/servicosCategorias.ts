export interface ServicoCategoria {
  id: string;
  label: string;
  subitens: string[];
}

export const servicosCategorias: ServicoCategoria[] = [
  { id: 'alin', label: 'Alinhamento/balanceamento', subitens: [] },
  { id: 'farol', label: 'Farol/Lanterna', subitens: ['Farol dianteiro', 'Lanterna traseira', 'Pisca-alerta'] },
  { id: 'freios', label: 'Freios', subitens: ['Pastilha', 'Disco', 'Fluido de freio', 'ABS'] },
  { id: 'ar', label: 'Ar condicionado', subitens: ['Não resfria', 'Ruído', 'Vazamento', 'Mau cheiro'] },
  { id: 'direcao', label: 'Direção e suspensão', subitens: ['Direção elétrica', 'Amortecedor', 'Barra estabilizadora'] },
  { id: 'embreagem', label: 'Embreagem e caixa de marcha', subitens: ['Embreagem', 'Câmbio manual', 'Câmbio automático'] },
  { id: 'lataria', label: 'Lataria avariada', subitens: ['Amassado', 'Arranhão', 'Oxidação'] },
  { id: 'pneus', label: 'Pneus e rodas', subitens: ['Troca de pneu', 'Furo', 'Roda amassada'] },
  { id: 'vidros', label: 'Vidros e espelhos', subitens: ['Para-brisa', 'Vidro lateral', 'Retrovisor'] },
  { id: 'interior', label: 'Interior e acessórios', subitens: ['Bancos', 'Painel', 'Som/elétrica'] },
];
