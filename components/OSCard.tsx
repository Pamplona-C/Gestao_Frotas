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
  /** Fornecedor pré-carregado pelo componente pai — elimina N+1 reads. */
  fornecedor?: Fornecedor | null;
  showValor?: boolean;
  highlight?: boolean;
}

export const OSCard = React.memo(function OSCard({ os, onPress, fornecedor, showValor = false, highlight = false }: Props) {
  const dataFormatada = format(parseISO(os.criadoEm), "dd 'de' MMM 'de' yyyy", { locale: ptBR });
  const veiculoNome = [os.veiculoMarca, os.veiculoModelo].filter(Boolean).join(' ').trim();
  const veiculoTitulo = veiculoNome || `Frota ${os.frota}`;
  const veiculoSubtitulo = [`Frota ${os.frota}`, os.placa].filter(Boolean).join(' · ');

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <Surface style={styles.card} elevation={1}>
        {highlight && <View style={styles.highlightStrip} />}
        <View style={styles.header}>
          <View style={styles.vehicleBlock}>
            <Text variant="bodyMedium" style={styles.vehicleTitle} numberOfLines={1}>
              {veiculoTitulo}
            </Text>
            <Text variant="bodySmall" style={styles.vehicleMeta} numberOfLines={1}>
              {veiculoSubtitulo}
            </Text>
          </View>
          <StatusBadge status={os.status} />
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={14} color={Colors.textSecondary} />
          <Text variant="bodySmall" style={styles.infoText}>{os.condutorNome}</Text>
        </View>

        {fornecedor && (
          <View style={styles.infoRow}>
            <Ionicons name="business-outline" size={14} color={Colors.textSecondary} />
            <Text variant="bodySmall" style={styles.infoText}>{fornecedor.nome}</Text>
          </View>
        )}

        <View style={styles.footer}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={13} color={Colors.textHint} />
            <Text variant="labelSmall" style={styles.dateText}>{dataFormatada}</Text>
          </View>
          {showValor && os.valorTotal != null && os.valorTotal > 0 && (
            <View style={styles.tipoBadge}>
              <Text style={styles.tipoText}>
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
    borderRadius: 12,
    padding: 14,
    backgroundColor: Colors.card,
    marginBottom: 10,
    gap: 6,
  },
  highlightStrip: {
    position: 'absolute',
    left: 0,
    top: 1,
    bottom: 1,
    width: 3,
    backgroundColor: Colors.primary,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  vehicleBlock: { flex: 1, paddingRight: 8, gap: 5 },
  vehicleTitle: { color: Colors.textPrimary, fontWeight: '700' },
  vehicleMeta: { color: Colors.textSecondary },
  plateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  plateBadge: {
    backgroundColor: Colors.textPrimary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  plateText: { color: '#fff', fontWeight: '700', fontSize: 13, letterSpacing: 1 },
  frotaBadge: {
    backgroundColor: Colors.background,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  frotaText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '500' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoText: { color: Colors.textSecondary },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  dateText: { color: Colors.textHint },
  tipoBadge: {
    backgroundColor: Colors.background,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tipoText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },
});
