import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Surface, Text, TextInput } from 'react-native-paper';
import { Colors } from '../constants/colors';
import { getRecentChecklists } from '../services/checklist.service';
import {
  getVinculosByIds,
  getVinculosComPendenciaChecklist,
} from '../services/vinculo.service';
import { useAuthStore } from '../store/auth.store';
import { Checklist, Vinculo } from '../types';

type TipoFilter = 'todos' | 'entrada' | 'saida';
type StatusFilter = 'todos' | 'concluido' | 'pendente';
type PeriodFilter = '30' | '90' | 'todos';

type ChecklistReportRow = {
  id: string;
  checklistId?: string;
  vinculoId: string;
  tipo: 'entrada' | 'saida';
  status: 'concluido' | 'pendente';
  dateIso?: string;
  condutorNome: string;
  veiculoId: string;
  veiculoLabel: string;
  frota: string;
  placa?: string;
  observacoes?: string;
};

const PERIOD_FILTERS: { key: PeriodFilter; label: string }[] = [
  { key: '30', label: '30 dias' },
  { key: '90', label: '90 dias' },
  { key: 'todos', label: 'Recentes' },
];

const TIPO_FILTERS: { key: TipoFilter; label: string }[] = [
  { key: 'todos', label: 'Tipos' },
  { key: 'entrada', label: 'Entrada' },
  { key: 'saida', label: 'Saída' },
];

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'todos', label: 'Status' },
  { key: 'concluido', label: 'Concluído' },
  { key: 'pendente', label: 'Pendente' },
];

function safeTime(value?: string): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function formatDate(value?: string) {
  const time = safeTime(value);
  if (!time) return 'Sem data';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

function diffLabel(value?: string) {
  const time = safeTime(value);
  if (!time) return 'sem referência';
  const diffMs = Date.now() - time;
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays <= 0) return 'hoje';
  if (diffDays === 1) return 'há 1 dia';
  return `há ${diffDays} dias`;
}

function vehicleLabel(v: Vinculo) {
  return `${v.veiculoMarca} ${v.veiculoModelo}`.trim() || `Frota ${v.veiculoFrota}`;
}

function periodStartIso(periodo: PeriodFilter): string | undefined {
  if (periodo === 'todos') return undefined;
  return new Date(Date.now() - Number(periodo) * 86_400_000).toISOString();
}

function buildRows(checklists: Checklist[], vinculos: Vinculo[]): ChecklistReportRow[] {
  const vinculosMap = new Map(vinculos.map((v) => [v.id, v]));
  const concluded = checklists.map((c) => {
    const vinculo = vinculosMap.get(c.vinculoId);
    return {
      id: `checklist-${c.id}`,
      checklistId: c.id,
      vinculoId: c.vinculoId,
      tipo: c.tipo,
      status: 'concluido' as const,
      dateIso: c.completadoEm,
      condutorNome: vinculo?.condutorNome ?? 'Condutor não encontrado',
      veiculoId: vinculo?.veiculoId ?? c.veiculoId,
      veiculoLabel: vinculo ? vehicleLabel(vinculo) : 'Veículo não encontrado',
      frota: vinculo?.veiculoFrota ?? '—',
      placa: vinculo?.veiculoPlaca,
      observacoes: c.observacoes,
    };
  });

  const pendingEntrada = vinculos
    .filter((v) => v.status === 'ativo' && !v.checklistEntradaId)
    .map((v) => ({
      id: `pendente-entrada-${v.id}`,
      vinculoId: v.id,
      tipo: 'entrada' as const,
      status: 'pendente' as const,
      dateIso: v.criadoEm,
      condutorNome: v.condutorNome,
      veiculoId: v.veiculoId,
      veiculoLabel: vehicleLabel(v),
      frota: v.veiculoFrota,
      placa: v.veiculoPlaca,
    }));

  const pendingSaida = vinculos
    .filter((v) => v.status === 'inativo' && !v.checklistSaidaId)
    .map((v) => ({
      id: `pendente-saida-${v.id}`,
      vinculoId: v.id,
      tipo: 'saida' as const,
      status: 'pendente' as const,
      dateIso: v.encerradoEm ?? v.criadoEm,
      condutorNome: v.condutorNome,
      veiculoId: v.veiculoId,
      veiculoLabel: vehicleLabel(v),
      frota: v.veiculoFrota,
      placa: v.veiculoPlaca,
    }));

  return [...concluded, ...pendingEntrada, ...pendingSaida].sort(
    (a, b) => safeTime(b.dateIso) - safeTime(a.dateIso),
  );
}

function MetricTile({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
}) {
  return (
    <Surface style={[styles.metricTile, accent && styles.metricTileAccent]} elevation={0}>
      <View style={[styles.metricIcon, accent && styles.metricIconAccent]}>
        <Ionicons name={icon} size={18} color={accent ? '#FFFFFF' : Colors.primary} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </Surface>
  );
}

function RelatoriosContent() {
  const router = useRouter();
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<PeriodFilter>('30');
  const [tipo, setTipo] = useState<TipoFilter>('todos');
  const [status, setStatus] = useState<StatusFilter>('todos');
  const [busca, setBusca] = useState('');

  const loadReport = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErro(null);

    try {
      const startIso = periodStartIso(periodo);
      const [loadedChecklists, pendingVinculos] = await Promise.all([
        getRecentChecklists(startIso, 200),
        getVinculosComPendenciaChecklist(),
      ]);

      const linkedVinculos = await getVinculosByIds(
        loadedChecklists.map((checklist) => checklist.vinculoId),
      );
      const vinculosById = new Map<string, Vinculo>();
      [...pendingVinculos, ...linkedVinculos].forEach((vinculo) => {
        vinculosById.set(vinculo.id, vinculo);
      });

      setChecklists(loadedChecklists);
      setVinculos([...vinculosById.values()]);
    } catch {
      setErro('Não foi possível carregar os relatórios de checklist.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [periodo]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const rows = useMemo(() => buildRows(checklists, vinculos), [checklists, vinculos]);

  const filteredRows = useMemo(() => {
    const term = busca.trim().toLowerCase();
    const minTime = periodo === 'todos'
      ? 0
      : Date.now() - Number(periodo) * 86_400_000;

    return rows.filter((row) => {
      if (periodo !== 'todos' && safeTime(row.dateIso) < minTime) return false;
      if (tipo !== 'todos' && row.tipo !== tipo) return false;
      if (status !== 'todos' && row.status !== status) return false;
      if (!term) return true;
      const haystack = [
        row.condutorNome,
        row.veiculoLabel,
        row.frota,
        row.placa,
        row.observacoes,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [busca, periodo, rows, status, tipo]);

  const metrics = useMemo(() => ({
    realizados: filteredRows.filter((row) => row.status === 'concluido').length,
    entradaPendente: filteredRows.filter((row) => row.status === 'pendente' && row.tipo === 'entrada').length,
    saidaPendente: filteredRows.filter((row) => row.status === 'pendente' && row.tipo === 'saida').length,
    comObservacao: filteredRows.filter((row) => !!row.observacoes?.trim()).length,
  }), [filteredRows]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/configuracoes')} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text variant="titleLarge" style={styles.title}>Relatórios</Text>
          <Text variant="bodySmall" style={styles.subtitle}>Auditoria de checklists</Text>
        </View>
        <TouchableOpacity onPress={() => loadReport(true)} hitSlop={8} disabled={loading || refreshing}>
          {refreshing ? (
            <ActivityIndicator color={Colors.primary} size="small" />
          ) : (
            <Ionicons name="refresh-outline" size={22} color={Colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.metricsGrid}>
          <MetricTile label="Realizados" value={metrics.realizados} icon="checkmark-circle-outline" accent />
          <MetricTile label="Entrada pendente" value={metrics.entradaPendente} icon="log-in-outline" />
          <MetricTile label="Saída pendente" value={metrics.saidaPendente} icon="log-out-outline" />
          <MetricTile label="Com observação" value={metrics.comObservacao} icon="alert-circle-outline" />
        </View>

        <TextInput
          mode="outlined"
          label="Buscar por condutor, frota ou placa"
          value={busca}
          onChangeText={setBusca}
          left={<TextInput.Icon icon="magnify" />}
          style={styles.search}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {PERIOD_FILTERS.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.filterChip, periodo === item.key && styles.filterChipActive]}
              onPress={() => setPeriodo(item.key)}
            >
              <Text style={[styles.filterText, periodo === item.key && styles.filterTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {TIPO_FILTERS.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.filterChip, tipo === item.key && styles.filterChipActive]}
              onPress={() => setTipo(item.key)}
            >
              <Text style={[styles.filterText, tipo === item.key && styles.filterTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
          {STATUS_FILTERS.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.filterChip, status === item.key && styles.filterChipActive]}
              onPress={() => setStatus(item.key)}
            >
              <Text style={[styles.filterText, status === item.key && styles.filterTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text variant="titleSmall" style={styles.sectionTitle}>Checklists</Text>
          <Text variant="bodySmall" style={styles.countText}>{filteredRows.length} registros</Text>
        </View>

        {erro ? (
          <Surface style={styles.emptyCard} elevation={0}>
            <Ionicons name="alert-circle-outline" size={42} color="#DC2626" />
            <Text style={[styles.emptyText, { color: '#DC2626' }]}>{erro}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => loadReport(true)}>
              <Text style={styles.retryText}>Tentar novamente</Text>
            </TouchableOpacity>
          </Surface>
        ) : loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginVertical: 32 }} />
        ) : filteredRows.length === 0 ? (
          <Surface style={styles.emptyCard} elevation={0}>
            <Ionicons name="document-text-outline" size={42} color={Colors.textHint} />
            <Text style={styles.emptyText}>Nenhum checklist encontrado neste filtro</Text>
          </Surface>
        ) : (
          filteredRows.map((row) => (
            <TouchableOpacity
              key={row.id}
              activeOpacity={0.82}
              onPress={() => {
                if (row.checklistId) {
                  router.push(`/checklists/${row.checklistId}` as any);
                } else {
                  router.push(`/veiculo/${row.veiculoId}` as any);
                }
              }}
            >
              <Surface style={styles.rowCard} elevation={1}>
                <View style={styles.rowTop}>
                  <View style={[
                    styles.typeBadge,
                    row.tipo === 'saida' && styles.typeBadgeExit,
                  ]}>
                    <Ionicons
                      name={row.tipo === 'entrada' ? 'log-in-outline' : 'log-out-outline'}
                      size={14}
                      color={row.tipo === 'entrada' ? Colors.primary : '#2563EB'}
                    />
                    <Text style={[
                      styles.typeText,
                      row.tipo === 'saida' && styles.typeTextExit,
                    ]}>
                      {row.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                    </Text>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    row.status === 'pendente' && styles.statusBadgePending,
                  ]}>
                    <Text style={[
                      styles.statusText,
                      row.status === 'pendente' && styles.statusTextPending,
                    ]}>
                      {row.status === 'concluido' ? 'Concluído' : 'Pendente'}
                    </Text>
                  </View>
                </View>

                <Text variant="bodyMedium" style={styles.vehicleName} numberOfLines={1}>
                  {row.veiculoLabel}
                </Text>
                <Text variant="bodySmall" style={styles.metaText} numberOfLines={1}>
                  Frota {row.frota}{row.placa ? ` · ${row.placa}` : ''} · {row.condutorNome}
                </Text>
                <View style={styles.rowBottom}>
                  <Text variant="bodySmall" style={styles.dateText}>
                    {row.status === 'pendente' ? diffLabel(row.dateIso) : formatDate(row.dateIso)}
                  </Text>
                  {row.observacoes ? (
                    <View style={styles.obsBadge}>
                      <Ionicons name="chatbubble-ellipses-outline" size={13} color="#D97706" />
                      <Text style={styles.obsText}>Observação</Text>
                    </View>
                  ) : null}
                </View>
              </Surface>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function RelatoriosScreen() {
  const { currentUser } = useAuthStore();
  if (!currentUser) return <Redirect href="/login" />;
  if (currentUser.perfil !== 'gestor') return <Redirect href="/(tabs)" />;
  return <RelatoriosContent />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { color: Colors.textPrimary, fontWeight: '700' },
  subtitle: { color: Colors.textSecondary, marginTop: 2 },
  content: { paddingHorizontal: 20, paddingBottom: 120 },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  metricTile: {
    width: '48%',
    minHeight: 104,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 12,
  },
  metricTileAccent: { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  metricIconAccent: { backgroundColor: Colors.primary },
  metricValue: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  metricLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  search: { marginBottom: 12, backgroundColor: Colors.card },
  filterRow: { gap: 8, paddingBottom: 10 },
  filterChip: {
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  filterTextActive: { color: '#FFFFFF' },
  sectionHeader: {
    marginTop: 4,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { color: Colors.textPrimary, fontWeight: '700' },
  countText: { color: Colors.textHint },
  emptyCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: { color: Colors.textHint, textAlign: 'center' },
  retryButton: {
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 4,
  },
  retryText: { color: Colors.primary, fontWeight: '700' },
  rowCard: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 10,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 7,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  typeBadgeExit: { backgroundColor: '#EFF6FF' },
  typeText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  typeTextExit: { color: '#2563EB' },
  statusBadge: {
    borderRadius: 7,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusBadgePending: { backgroundColor: '#FFFBEB' },
  statusText: { color: '#15803D', fontSize: 12, fontWeight: '700' },
  statusTextPending: { color: '#D97706' },
  vehicleName: { color: Colors.textPrimary, fontWeight: '700' },
  metaText: { color: Colors.textSecondary, marginTop: 2 },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },
  dateText: { color: Colors.textHint },
  obsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  obsText: { color: '#D97706', fontSize: 12, fontWeight: '700' },
});
