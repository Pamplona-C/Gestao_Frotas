import { Veiculo } from '../types';

export const veiculos: Veiculo[] = [
  { id: 'v1', tipo: 'carro', marca: 'Volkswagen', modelo: 'Amarok',  frota: '07', placa: 'ABC-1234', ano: 2022, departamento: 'Comercial', ativo: true },
  { id: 'v2', tipo: 'carro', marca: 'Fiat',       modelo: 'Strada',  frota: '12', placa: 'DEF-5678', ano: 2021, departamento: 'Logística', ativo: true },
  { id: 'v3', tipo: 'carro', marca: 'Chevrolet',  modelo: 'S10',     frota: '03', placa: 'GHI-9012', ano: 2023, departamento: 'Comercial', ativo: true },
  { id: 'v4', tipo: 'carro', marca: 'Toyota',     modelo: 'Hilux',   frota: '15', placa: 'JKL-3456', ano: 2020, departamento: 'Logística', ativo: false },
];
