import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { Text, FAB, Surface } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/auth.store';
import { useConectividade } from '../../hooks/useConectividade';
import { OSCard } from '../../components/OSCard';
import { MetricCard } from '../../components/MetricCard';
import { StatusBadge } from '../../components/StatusBadge';
import { NotificationBell } from '../../components/NotificationBell';
import {
  subscribeToOSByCondutorId,
  subscribeToAllOS,
} from '../../services/os.service';
import { subscribeToAllFornecedores } from '../../services/fornecedor.service';
import { subscribeToVinculosByCondutorId } from '../../services/vinculo.service';
import { OrdemServico, OSStatus, Fornecedor, Vinculo } from '../../types';
import { Colors } from '../../constants/colors';

type ChecklistStatus = 'pendente_entrada' | 'em_uso' | 'pendente_saida';
function getChecklistStatus(v: Vinculo): ChecklistStatus {
  if (!v.checklistEntradaId) return 'pendente_entrada';
  if (!v.checklistSaidaId)   return 'em_uso';
  return 'pendente_saida';
}
const CHECKLIST_CFG: Record<ChecklistStatus, { label: string; color: string; bg: string; icon: string }> = {
  pendente_entrada: { label: 'Checklist pendente', color: '#D97706', bg: '#FFFBEB', icon: 'alert-circle-outline' },
  em_uso:           { label: 'Em uso',             color: '#16A34A', bg: '#F0FDF4', icon: 'checkmark-circle-outline' },
  pendente_saida:   { label: 'Devolução pendente', color: '#2563EB', bg: '#EFF6FF', icon: 'time-outline' },
};

// ──────────────── Condutor Home ────────────────
function CondutorHome() {
  const { currentUser } = useAuthStore();
  const router = useRouter();
  const online = useConectividade();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [fornecedoresMap, setFornecedoresMap] = useState<Map<string, Fornecedor>>(new Map());
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const unsubOS = subscribeToOSByCondutorId(currentUser.uid, (data) => {
      setOrdens(data);
      setLoading(false);
      setRefreshing(false);
    });
    const unsubForn = subscribeToAllFornecedores((list) => {
      setFornecedoresMap(new Map(list.map((f) => [f.id, f])));
    });
    const unsubVinculos = subscribeToVinculosByCondutorId(currentUser.uid, (all) => {
      setVinculos(all.filter((v) => v.status === 'ativo'));
    });
    return () => { unsubOS(); unsubForn(); unsubVinculos(); };
  }, [currentUser?.uid]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // onSnapshot já é real-time — o listener vai disparar e setar refreshing=false
    // Timeout de segurança caso não haja mudanças
    setTimeout(() => setRefreshing(false), 2000);
  }, []);

  const abertas = useMemo(
    () => ordens.filter((o) => o.status !== 'concluida').length,
    [ordens],
  );
  const initials = useMemo(
    () => currentUser?.nome.split(' ').slice(0, 2).map((n) => n[0]).join('') ?? '',
    [currentUser?.nome],
  );

  const listHeader = (
    <>
      {!online && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color="#92400E" />
          <Text style={styles.offlineText}>
            Sem internet — OS existentes visíveis, mas nova OS indisponível
          </Text>
        </View>
      )}
      <View style={styles.header}>
        <View>
          <Text variant="titleLarge" style={styles.greeting}>
            Olá, {currentUser?.nome.split(' ')[0]} 👋
          </Text>
          <Text variant="bodySmall" style={styles.dept}>
            {currentUser?.departamento}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <NotificationBell />
          <TouchableOpacity onPress={() => router.push('/perfil')} activeOpacity={0.8}>
            {currentUser?.photoURL ? (
              <Image source={{ uri: currentUser.photoURL }} style={styles.avatarPhoto} cachePolicy="memory-disk" transition={200} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.metrics}>
        <MetricCard label="Total de OS" value={ordens.length} />
        <MetricCard label="Em aberto" value={abertas} accent />
      </View>

      {/* ── Meus Veículos ── */}
      <View style={styles.sectionRow}>
        <Text variant="titleSmall" style={styles.sectionTitle}>Meus veículos</Text>
        {vinculos.length > 0 && (
          <TouchableOpacity onPress={() => router.push('/meus-veiculos' as any)}>
            <Text style={styles.sectionLink}>Ver todos</Text>
          </TouchableOpacity>
        )}
      </View>

      {vinculos.length === 0 ? (
        <Surface style={styles.veiculoEmpty} elevation={0}>
          <Ionicons name="car-outline" size={20} color={Colors.textHint} />
          <Text variant="bodySmall" style={{ color: Colors.textHint }}>
            Nenhum veículo vinculado — contate o gestor
          </Text>
        </Surface>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.veiculoScroll}
        >
          {vinculos.map((v) => {
            const st  = getChecklistStatus(v);
            const cfg = CHECKLIST_CFG[st];
            return (
              <TouchableOpacity
                key={v.id}
                activeOpacity={0.85}
                onPress={() =>
                  router.push(
                    `/checklist/${v.id}/${st === 'pendente_entrada' ? 'entrada' : 'saida'}` as any,
                  )
                }
                disabled={st === 'em_uso'}
              >
                <Surface style={styles.veiculoCard} elevation={1}>
                  {/* Tipo badge */}
                  <View style={[styles.veiculoTipoBadge, v.veiculoTipo === 'moto' && styles.veiculoTipoBadgeMoto]}>
                    <Ionicons
                      name={v.veiculoTipo === 'moto' ? 'bicycle-outline' : 'car-outline'}
                      size={14}
                      color={v.veiculoTipo === 'moto' ? '#7C3AED' : Colors.primary}
                    />
                  </View>
                  <Text style={styles.veiculoNome} numberOfLines={1}>
                    {v.veiculoMarca} {v.veiculoModelo}
                  </Text>
                  <Text style={styles.veiculoFrota}>Frota {v.veiculoFrota}</Text>
                  {v.veiculoPlaca ? (
                    <Text style={styles.veiculoPlaca}>{v.veiculoPlaca}</Text>
                  ) : null}
                  {/* Status */}
                  <View style={[styles.veiculoStatus, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
                    <Text style={[styles.veiculoStatusText, { color: cfg.color }]}>
                      {cfg.label}
                    </Text>
                  </View>
                  {/* Ação */}
                  {st !== 'em_uso' && (
                    <View style={styles.veiculoAction}>
                      <Ionicons name="camera-outline" size={13} color={Colors.primary} />
                      <Text style={styles.veiculoActionText}>
                        {st === 'pendente_entrada' ? 'Fazer entrada' : 'Fazer saída'}
                      </Text>
                    </View>
                  )}
                </Surface>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <Text variant="titleSmall" style={[styles.sectionTitle, { marginTop: 8 }]}>
        Minhas ordens de serviço
      </Text>
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={ordens}
        keyExtractor={(o) => o.id}
        renderItem={({ item }) => (
          <OSCard
            os={item}
            onPress={() => router.push(`/os/${item.id}`)}
            fornecedor={item.fornecedorId ? fornecedoresMap.get(item.fornecedorId) : null}
          />
        )}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={10}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle-outline" size={48} color={Colors.textHint} />
              <Text variant="bodyMedium" style={{ color: Colors.textHint, marginTop: 8 }}>
                Nenhuma OS encontrada
              </Text>
            </View>
          ) : null
        }
      />

      <FAB
        icon={online ? 'plus' : 'cloud-off-outline'}
        color="#FFFFFF"
        style={[styles.fab, { bottom: bottomInset + 80 }, !online && styles.fabOffline]}
        onPress={() => router.push('/nova-os/etapa-1')}
        label="Nova OS"
      />
    </SafeAreaView>
  );
}

// ──────────────── Gestor Dashboard ────────────────
const STATUS_FILTERS: { key: OSStatus | 'todas'; label: string }[] = [
  { key: 'todas',             label: 'Todas' },
  { key: 'nova',              label: 'Nova' },
  { key: 'em_andamento',      label: 'Em andamento' },
  { key: 'em_diagnostico',    label: 'Diagnóstico' },
  { key: 'orcamento_aprovado',label: 'Aprovado' },
];

function GestorDashboard() {
  const { currentUser } = useAuthStore();
  const router = useRouter();
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [fornecedoresMap, setFornecedoresMap] = useState<Map<string, Fornecedor>>(new Map());
  const [metrics, setMetrics] = useState({ total: 0, emAndamento: 0, orcamentoAprovado: 0, gastoPreventiva: 0, gastoCorretiva: 0 });
  const [filtro, setFiltro] = useState<OSStatus | 'todas'>('todas');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const unsubOS = subscribeToAllOS((data, m) => {
      setOrdens(data);
      setMetrics(m);
      setLoading(false);
      setRefreshing(false);
    });
    const unsubForn = subscribeToAllFornecedores((list) => {
      setFornecedoresMap(new Map(list.map((f) => [f.id, f])));
    });
    return () => { unsubOS(); unsubForn(); };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 2000);
  }, []);

  const filtered = useMemo(
    () => filtro === 'todas' ? ordens : ordens.filter((o) => o.status === filtro),
    [filtro, ordens],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.gestorHeader}>
        <View>
          <Text variant="titleLarge" style={styles.panelTitle}>Painel de Frotas</Text>
          <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>
            {currentUser?.nome}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <NotificationBell />
          <TouchableOpacity onPress={() => router.push('/perfil')} activeOpacity={0.8}>
            {currentUser?.photoURL ? (
              <Image source={{ uri: currentUser.photoURL }} style={styles.avatarPhoto} cachePolicy="memory-disk" transition={200} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {currentUser?.nome.split(' ').slice(0, 2).map((n) => n[0]).join('')}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.metricsGrid}>
          <View style={styles.metricsRow}>
            <MetricCard label="Total de OS"    value={metrics.total} />
            <MetricCard label="Em andamento"   value={metrics.emAndamento} accent />
          </View>
          <View style={styles.metricsRow}>
            <MetricCard label="Ag. aprovação"  value={metrics.orcamentoAprovado} />
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {STATUS_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterTab, filtro === f.key && styles.filterTabActive]}
              onPress={() => setFiltro(f.key)}
            >
              <Text style={[styles.filterLabel, filtro === f.key && styles.filterLabelActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.listContainer}>
          {filtered.map((os) => (
            <OSCard
              key={os.id}
              os={os}
              onPress={() => router.push(`/os/${os.id}`)}
              fornecedor={os.fornecedorId ? fornecedoresMap.get(os.fornecedorId) : null}
              showValor
            />
          ))}
          {!loading && filtered.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="document-outline" size={48} color={Colors.textHint} />
              <Text variant="bodyMedium" style={{ color: Colors.textHint, marginTop: 8 }}>
                Nenhuma OS neste filtro
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ──────────────── Export ────────────────
export default function HomeScreen() {
  const { currentUser } = useAuthStore();
  return currentUser?.perfil === 'gestor' ? <GestorDashboard /> : <CondutorHome />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  offlineText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
  },
  fabOffline: {
    backgroundColor: Colors.textHint,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  greeting: { fontWeight: '700', color: Colors.textPrimary },
  dept: { color: Colors.textSecondary, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  avatarPhoto: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2, borderColor: Colors.primary,
  },
  metrics: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 20 },
  sectionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 10,
  },
  sectionTitle: {
    paddingHorizontal: 20, marginBottom: 12,
    color: Colors.textPrimary, fontWeight: '600',
  },
  sectionLink: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  veiculoEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 12,
    borderRadius: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  veiculoScroll: { paddingHorizontal: 20, paddingBottom: 16, gap: 10 },
  veiculoCard: {
    width: 160,
    borderRadius: 14,
    padding: 12,
    backgroundColor: Colors.card,
    gap: 4,
  },
  veiculoTipoBadge: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#EFF6FF', marginBottom: 4,
  },
  veiculoTipoBadgeMoto: { backgroundColor: '#F5F3FF' },
  veiculoNome: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  veiculoFrota: { fontSize: 11, color: Colors.textSecondary },
  veiculoPlaca: { fontSize: 11, color: Colors.textSecondary },
  veiculoStatus: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4, marginTop: 6,
  },
  veiculoStatusText: { fontSize: 10, fontWeight: '600' },
  veiculoAction: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6,
  },
  veiculoActionText: { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  list: { paddingHorizontal: 20, paddingBottom: 100, flexGrow: 1 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  fab: { position: 'absolute', right: 20, backgroundColor: Colors.primary },
  // Gestor
  gestorHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
  },
  panelTitle: { fontWeight: '700', color: Colors.textPrimary },
  metricsGrid: { paddingHorizontal: 20, paddingTop: 8, gap: 12, marginBottom: 16 },
  metricsRow: { flexDirection: 'row', gap: 12 },
  filterRow: { paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  filterTab: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
  },
  filterTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  filterLabelActive: { color: '#fff' },
  listContainer: { paddingHorizontal: 20, paddingBottom: 24 },
});
