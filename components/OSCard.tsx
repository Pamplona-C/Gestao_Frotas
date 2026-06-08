import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Surface, Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { OrdemServico, Fornecedor } from '../types';
import { StatusBadge } from './StatusBadge';
import { Colors } from '../constants/colors';

interface Props {
  os: OrdemServico;
  onPress: () => void;
  fornecedor?: Fornecedor | null;
  showValor?: boolean;
  highlight?: boolean;
}

export const OSCard = React.memo(function OSCard({ os, onPress, fornecedor, showValor = false, highlight = false }: Props) {
  const dataFormatada = format(parseISO(os.criadoEm), "dd 'de' MMM", { locale: ptBR });
  const veiculoNome = [os.veiculoMarca, os.veiculoModelo].filter(Boolean).join(' ').trim();
  const veiculoTitulo = veiculoNome || `Frota ${os.frota}`;
  const veiculoSubtitulo = [`Frota ${os.frota}`, os.placa].filter(Boolean).join(' · ');
  const statusColor = Colors.status[os.status]?.text ?? Colors.primary;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <Surface
        style={[
          styles.card,
          highlight && { borderLeftWidth: 4, borderLeftColor: statusColor },
        ]}
        elevation={1}
      >

        {/* Cabeçalho: ícone + veículo + badge */}
        <View style={styles.header}>
          <View style={[styles.iconBadge, { backgroundColor: Colors.primaryLight }]}>
            <Ionicons name="construct-outline" size={17} color={Colors.primary} />
          </View>
          <View style={styles.vehicleBlock}>
            <Text style={styles.vehicleTitle} numberOfLines={1}>{veiculoTitulo}</Text>
            <Text style={styles.vehicleMeta} numberOfLines={1}>{veiculoSubtitulo}</Text>
          </View>
          <StatusBadge status={os.status} />
        </View>

        {/* Divisor */}
        <View style={styles.divider} />

        {/* Condutor */}
        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={13} color={Colors.textSecondary} />
          <Text style={styles.infoText} numberOfLines={1}>{os.condutorNome}</Text>
        </View>

        {/* Fornecedor */}
        {fornecedor && (
          <View style={styles.infoRow}>
            <Ionicons name="business-outline" size={13} color={Colors.textSecondary} />
            <Text style={styles.infoText} numberOfLines={1}>{fornecedor.nome}</Text>
          </View>
        )}

        {/* Rodapé */}
        <View style={styles.footer}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={12} color={Colors.textHint} />
            <Text style={styles.dateText}>{dataFormatada}</Text>
          </View>
          {showValor && os.valorTotal != null && os.valorTotal > 0 && (
            <View style={styles.valorBadge}>
              <Text style={styles.valorText}>
                {os.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </Text>
            </View>
          )}
        </View>
      </Surface>
    </TouchableOpacity>
  );
}, (prev, next) =>
  prev.os.id === next.os.id &&
  prev.os.status === next.os.status &&
  prev.os.valorTotal === next.os.valorTotal &&
  prev.os.fornecedorId === next.os.fornecedorId &&
  prev.os.veiculoMarca === next.os.veiculoMarca &&
  prev.os.veiculoModelo === next.os.veiculoModelo &&
  prev.os.placa === next.os.placa &&
  prev.os.frota === next.os.frota &&
  prev.fornecedor?.id === next.fornecedor?.id &&
  prev.showValor === next.showValor &&
  prev.highlight === next.highlight
);

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 14,
    paddingLeft: 18,
    backgroundColor: Colors.card,
    marginBottom: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  vehicleBlock: { flex: 1, gap: 2 },
  vehicleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  vehicleMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    opacity: 0.6,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  dateText: { fontSize: 12, color: Colors.textHint },
  valorBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  valorText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
});
