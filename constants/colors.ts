export const Colors = {
  primary:        '#0A1F3D',  // Dark Blue
  accent:         '#1E4E8C',  // Medium Blue
  background:     '#EBEAE4',  // Off-White
  card:           '#FFFFFF',  // Pure White
  border:         '#D0CECC',  // Warm gray
  textPrimary:    '#0A1F3D',  // Dark Blue
  textSecondary:  '#4A566A',  // Cool mid gray
  textHint:       '#8A96A8',  // Light gray

  // Tints derivados do primary para fundos e bordas
  primaryLight:   '#EDF2FB',  // Very light blue (selected/active backgrounds)
  primaryBorder:  '#BCCFED',  // Light blue border

  status: {
    nova:               { bg: '#FEF2F2', text: '#DC2626' },
    em_andamento:       { bg: '#EFF6FF', text: '#2563EB' },
    em_diagnostico:     { bg: '#FFFBEB', text: '#D97706' },
    orcamento_aprovado: { bg: '#F0FDF4', text: '#16A34A' },
    concluida:          { bg: '#DCFCE7', text: '#15803D' },
  },
} as const;
