import { Veiculo } from '../types';

export const veiculos: Veiculo[] = [
  { id: 'v1', placa: 'ABC-1234', frota: '07', modelo: 'Volkswagen Amarok', ano: 2022, departamento: 'Comercial', ativo: true },
  { id: 'v2', placa: 'DEF-5678', frota: '12', modelo: 'Fiat Strada', ano: 2021, departamento: 'Logística', ativo: true },
  { id: 'v3', placa: 'GHI-9012', frota: '03', modelo: 'Chevrolet S10', ano: 2023, departamento: 'Comercial', ativo: true },
  { id: 'v4', placa: 'JKL-3456', frota: '15', modelo: 'Toyota Hilux', ano: 2020, departamento: 'Logística', ativo: false },
];
