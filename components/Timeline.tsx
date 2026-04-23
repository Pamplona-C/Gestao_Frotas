import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { OSStatus, OrdemServico } from '../types';
import { Colors } from '../constants/colors';

type Step = {
  label: string;
  sublabel?: string;
  done: boolean;
};

function getSteps(os: OrdemServico): Step[] {
  const status = os.status;
  const isDiag = ['em_diagnostico', 'orcamento_aprovado', 'concluida'].includes(status);
  const isOrc = ['orcamento_aprovado', 'concluida'].includes(status);
  const isConcluida = status === 'concluida';

  const criadoEm = format(parseISO(os.criadoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  return [
    { label: 'Abertura da OS', sublabel: criadoEm, done: true },
    { label: 'Em diagnóstico', done: isDiag },
    { label: 'Orçamento aprovado', sublabel: os.notaInterna, done: isOrc },
    { label: 'Serviço concluído', done: isConcluida },
  ];
}

interface Props {
  os: OrdemServico;
}

export function Timeline({ os }: Props) {
  const steps = getSteps(os);

  return (
    <View style={styles.container}>
      {steps.map((step, i) => (
        <View key={i} style={styles.row}>
          <View style={styles.left}>
            <View style={[styles.dot, step.done ? styles.dotDone : styles.dotPending]}>
              {step.done ? (
                <Ionicons name="checkmark" size={12} color="#fff" />
              ) : (
                <View style={styles.dotInner} />
              )}
            </View>
            {i < steps.length - 1 && (
              <View style={[styles.line, step.done ? styles.lineDone : styles.linePending]} />
            )}
          </View>
          <View style={styles.content}>
            <Text
              variant="bodyMedium"
              style={[styles.stepLabel, step.done && styles.stepLabelDone]}
            >
              {step.label}
            </Text>
            {step.sublabel && (
              <Text variant="labelSmall" style={styles.sublabel}>
                {step.sublabel}
              </Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 4 },
  row: { flexDirection: 'row', gap: 12 },
  left: { alignItems: 'center', width: 24 },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: Colors.primary },
  dotPending: { backgroundColor: Colors.border },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textHint,
  },
  line: { width: 2, flex: 1, minHeight: 20, marginVertical: 2, borderRadius: 1 },
  lineDone: { backgroundColor: Colors.primary },
  linePending: { backgroundColor: Colors.border },
  content: { flex: 1, paddingBottom: 20 },
  stepLabel: { color: Colors.textSecondary, fontWeight: '500' },
  stepLabelDone: { color: Colors.textPrimary },
  sublabel: { color: Colors.textHint, marginTop: 2 },
});
