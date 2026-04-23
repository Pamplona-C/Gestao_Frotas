import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Text, Button, Surface, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { StepperHeader } from '../../components/StepperHeader';
import { useNovaOSStore } from '../../store/novaOS.store';
import { getVeiculoByPlaca } from '../../services/veiculo.service';
import { Veiculo } from '../../types';
import { Colors } from '../../constants/colors';

function SummaryRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Ionicons name={icon as any} size={16} color={Colors.textSecondary} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text variant="labelSmall" style={styles.rowLabel}>{label}</Text>
        <Text variant="bodyMedium" style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

function SummarySection({
  title,
  step,
  onEdit,
  children,
}: {
  title: string;
  step: number;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <Surface style={styles.section} elevation={1}>
      <View style={styles.sectionHeader}>
        <Text variant="titleSmall" style={styles.sectionTitle}>{title}</Text>
        <TouchableOpacity onPress={onEdit} style={styles.editBtn}>
          <Ionicons name="create-outline" size={15} color={Colors.primary} />
          <Text style={styles.editLabel}>Editar</Text>
        </TouchableOpacity>
      </View>
      <Divider style={{ marginBottom: 10 }} />
      {children}
    </Surface>
  );
}

export default function Etapa5() {
  const router = useRouter();
  const store = useNovaOSStore();
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);

  useEffect(() => {
    if (!store.placa) return;
    getVeiculoByPlaca(store.placa).then((v) => setVeiculo(v));
  }, [store.placa]);

  const dataLabel = store.dataDesejada
    ? format(parseISO(store.dataDesejada), "dd/MM/yyyy", { locale: ptBR })
    : '—';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text variant="titleMedium" style={styles.topTitle}>Nova OS</Text>
        <View style={{ width: 24 }} />
      </View>
      <StepperHeader currentStep={5} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text variant="headlineSmall" style={styles.heading}>Resumo da OS</Text>
        <Text variant="bodyMedium" style={styles.sub}>Confira os dados antes de enviar</Text>

        {/* Veículo */}
        <SummarySection title="Veículo" step={1} onEdit={() => router.push('/nova-os/etapa-1')}>
          <SummaryRow icon="car-outline" label="Placa" value={store.placa || '—'} />
          <SummaryRow
            icon="speedometer-outline"
            label="Hodômetro"
            value={store.hodometro ? `${store.hodometro} km` : '—'}
          />
          <SummaryRow icon="location-outline" label="Cidade" value={store.cidade || '—'} />
          {veiculo && (
            <SummaryRow
              icon="information-circle-outline"
              label="Modelo"
              value={`${veiculo.modelo} · Frota ${veiculo.frota}`}
            />
          )}
        </SummarySection>

        {/* Serviços */}
        <SummarySection title="Serviços" step={2} onEdit={() => router.push('/nova-os/etapa-2')}>
          <SummaryRow
            icon="build-outline"
            label="Tipo"
            value={store.tipo === 'preventiva' ? 'Preventiva' : store.tipo === 'corretiva' ? 'Corretiva' : '—'}
          />
          {store.servicosSelecionados.map((s, i) => (
            <View key={i} style={styles.tagRow}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.accent} />
              <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>{s}</Text>
            </View>
          ))}
        </SummarySection>

        {/* Descrição */}
        {store.descricao ? (
          <SummarySection title="Descrição" step={3} onEdit={() => router.push('/nova-os/etapa-3')}>
            <Text variant="bodySmall" style={{ color: Colors.textSecondary, lineHeight: 20 }}>
              {store.descricao}
            </Text>
          </SummarySection>
        ) : null}

        {/* Agendamento */}
        <SummarySection title="Agendamento" step={4} onEdit={() => router.push('/nova-os/etapa-4')}>
          <SummaryRow icon="calendar-outline" label="Data" value={dataLabel} />
          <SummaryRow icon="time-outline" label="Horário" value={store.horario || '—'} />
          {store.observacoes ? (
            <SummaryRow icon="chatbubble-outline" label="Observações" value={store.observacoes} />
          ) : null}
        </SummarySection>

        <Button
          mode="contained"
          style={styles.btn}
          contentStyle={styles.btnContent}
          icon="send"
          onPress={() => router.push('/nova-os/etapa-6')}
        >
          Enviar OS
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  topTitle: { fontWeight: '600', color: Colors.textPrimary },
  scroll: { padding: 20, gap: 12 },
  heading: { fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  sub: { color: Colors.textSecondary, marginBottom: 8 },
  section: {
    borderRadius: 12,
    padding: 14,
    backgroundColor: Colors.card,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: { fontWeight: '700', color: Colors.textPrimary },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editLabel: { fontSize: 13, color: Colors.primary, fontWeight: '500' },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  rowLabel: { color: Colors.textHint, marginBottom: 1 },
  rowValue: { color: Colors.textPrimary, fontWeight: '500' },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  btn: { borderRadius: 10, marginTop: 8 },
  btnContent: { paddingVertical: 4 },
});
