import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { OSStatus } from '../types';
import { Colors } from '../constants/colors';

const labels: Record<OSStatus, string> = {
  nova: 'Nova',
  em_andamento: 'Em andamento',
  em_diagnostico: 'Em diagnóstico',
  orcamento_aprovado: 'Orç. aprovado',
  concluida: 'Concluída',
};

interface Props {
  status: OSStatus;
}

export function StatusBadge({ status }: Props) {
  const { bg, text } = Colors.status[status];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: text }]}>{labels[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 99,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
