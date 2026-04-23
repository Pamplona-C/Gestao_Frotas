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
}

export function OSCard({ os, onPress, fornecedor }: Props) {
  const dataFormatada = format(parseISO(os.criadoEm), "dd 'de' MMM 'de' yyyy", { locale: ptBR });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <Surface style={styles.card} elevation={1}>
        <View style={styles.header}>
          <View style={styles.plateRow}>
            <View style={styles.plateBadge}>
              <Text style={styles.plateText}>{os.placa}</Text>
            </View>
            <View style={styles.frotaBadge}>
              <Text style={styles.frotaText}>Frota {os.frota}</Text>
            </View>
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
          <View style={styles.tipoBadge}>
            <Text style={styles.tipoText}>
              {os.tipo === 'preventiva' ? 'Preventiva' : 'Corretiva'}
            </Text>
          </View>
        </View>
      </Surface>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 14,
    backgroundColor: Colors.card,
    marginBottom: 10,
    gap: 6,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  plateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
