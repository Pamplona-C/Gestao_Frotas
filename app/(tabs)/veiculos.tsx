import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal as RNModal,
} from 'react-native';
import {
  Text,
  TextInput,
  FAB,
  Button,
  Surface,
  Divider,
  Switch,
} from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import { Veiculo, VeiculoTipo } from '../../types';
import {
  getVeiculosPaginados,
  getAllVeiculos,
  createVeiculo,
  updateVeiculo,
  deleteVeiculo,
} from '../../services/veiculo.service';
import { cacheGet, cacheSet, cacheInvalidate } from '../../lib/cache';
import { SkeletonList } from '../../components/SkeletonCard';
import { Colors } from '../../constants/colors';

const CACHE_KEY = 'cache:veiculos:p1';

const schema = z.object({
  tipo:        z.enum(['carro', 'moto']),
  marca:       z.string().min(2, 'Obrigatório'),
  modelo:      z.string().min(2, 'Obrigatório'),
  frota:       z.string().min(1, 'Obrigatório'),
  placa:       z.string().optional(),
  ano:         z.string().regex(/^\d{4}$/, 'Ano inválido'),
  kmAtual:     z.string().optional(),
  departamento:z.string().min(2, 'Obrigatório'),
}).superRefine((data, ctx) => {
  if (data.tipo === 'carro' && (!data.placa || data.placa.length < 7)) {
    ctx.addIssue({ code: 'custom', path: ['placa'], message: 'Placa inválida' });
  }
});
type FormData = z.infer<typeof schema>;

export default function VeiculosScreen() {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const router = useRouter();

  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [busca, setBusca] = useState('');
  const buscaRef = useRef('');
  useEffect(() => { buscaRef.current = busca; }, [busca]);

  const [modal, setModal] = useState(false);
  const [ativo, setAtivo] = useState(true);
  const [editando, setEditando] = useState<Veiculo | null>(null);
  const [detalhe, setDetalhe] = useState<Veiculo | null>(null);

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: 'carro' },
  });

  const tipoWatch = watch('tipo');

  // ── Paginação ────────────────────────────────────────────────────────────
  const carregarPrimeiraPagina = useCallback(async () => {
    const cached = await cacheGet<Veiculo[]>(CACHE_KEY);
    if (cached) {
      setVeiculos(cached);
      setCarregando(false);
    } else {
      setCarregando(true);
    }

    try {
      const res = await getVeiculosPaginados();
      setVeiculos(res.items);
      setCursor(res.cursor);
      setHasMore(res.hasMore);
      cacheSet(CACHE_KEY, res.items);
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, []);

  const carregarMais = useCallback(async () => {
    if (!hasMore || carregandoMais || buscaRef.current.trim()) return;
    setCarregandoMais(true);
    try {
      const res = await getVeiculosPaginados(cursor);
      setVeiculos((prev) => [...prev, ...res.items]);
      setCursor(res.cursor);
      setHasMore(res.hasMore);
    } finally {
      setCarregandoMais(false);
    }
  }, [hasMore, carregandoMais, cursor]);

  useFocusEffect(
    useCallback(() => {
      if (!buscaRef.current.trim()) carregarPrimeiraPagina();
    }, [carregarPrimeiraPagina])
  );

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }

    const trimmed = busca.trim();
    if (!trimmed) {
      carregarPrimeiraPagina();
      return;
    }

    const timer = setTimeout(async () => {
      setCarregando(true);
      try {
        const todos = await getAllVeiculos();
        const lower = trimmed.toLowerCase();
        setVeiculos(
          todos.filter(
            (v) =>
              (v.placa ?? '').toLowerCase().includes(lower) ||
              (v.modelo ?? '').toLowerCase().includes(lower) ||
              (v.frota ?? '').includes(trimmed) ||
              (v.marca ?? '').toLowerCase().includes(lower),
          )
        );
        setCursor(null);
        setHasMore(false);
      } finally {
        setCarregando(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [busca]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setBusca('');
    carregarPrimeiraPagina();
  }, [carregarPrimeiraPagina]);

  // ── CRUD ─────────────────────────────────────────────────────────────────
  const openNovo = () => {
    setEditando(null);
    reset({ tipo: 'carro', marca: '', modelo: '', frota: '', placa: '', ano: '', kmAtual: '', departamento: '' });
    setAtivo(true);
    setModal(true);
  };

  const openEditar = (v: Veiculo) => {
    setEditando(v);
    reset({
      tipo:         v.tipo ?? 'carro',
      marca:        v.marca ?? '',
      modelo:       v.modelo,
      frota:        v.frota,
      placa:        v.placa ?? '',
      ano:          String(v.ano),
      kmAtual:      v.kmAtual !== undefined ? String(v.kmAtual) : '',
      departamento: v.departamento,
    });
    setAtivo(v.ativo);
    setModal(true);
  };

  const onSave = async (data: FormData) => {
    const payload: Omit<Veiculo, 'id'> = {
      tipo:         data.tipo,
      marca:        data.marca,
      modelo:       data.modelo,
      frota:        data.frota,
      placa:        data.tipo === 'carro' ? (data.placa ?? '').toUpperCase() : undefined,
      ano:          parseInt(data.ano),
      kmAtual:      data.kmAtual ? parseInt(data.kmAtual) : undefined,
      departamento: data.departamento,
      ativo,
    };
    const clean = Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== undefined),
    ) as Omit<Veiculo, 'id'>;

    if (editando) {
      await updateVeiculo(editando.id, clean);
    } else {
      await createVeiculo(clean);
    }
    setModal(false);
    reset();
    setAtivo(true);
    setEditando(null);
    cacheInvalidate(CACHE_KEY);
    setBusca('');
    carregarPrimeiraPagina();
  };

  const onDelete = (v: Veiculo) => {
    Alert.alert(
      'Excluir veículo',
      `Deseja excluir ${v.placa ?? v.frota} — ${v.modelo}? Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await deleteVeiculo(v.id);
            cacheInvalidate(CACHE_KEY);
            carregarPrimeiraPagina();
          },
        },
      ]
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text variant="titleLarge" style={styles.title}>Veículos</Text>
        <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>
          {veiculos.length}{hasMore && !busca ? '+' : ''} cadastrados
        </Text>
      </View>

      <View style={styles.searchBar}>
        <TextInput
          mode="outlined"
          placeholder="Buscar placa, marca, modelo ou frota…"
          value={busca}
          onChangeText={setBusca}
          left={<TextInput.Icon icon="magnify" />}
          right={busca ? <TextInput.Icon icon="close" onPress={() => setBusca('')} /> : undefined}
          style={styles.input}
          dense
        />
      </View>

      <FlatList
        data={veiculos}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => (
          <VeiculoCard
            veiculo={item}
            onPress={() => setDetalhe(item)}
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        onEndReached={carregarMais}
        onEndReachedThreshold={0.3}
        ListFooterComponent={() =>
          carregandoMais ? (
            <ActivityIndicator style={styles.footerLoader} color={Colors.primary} />
          ) : hasMore && !busca ? (
            <Text style={styles.footerHint}>Role para carregar mais</Text>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          carregando ? (
            <SkeletonList variant="veiculo" count={6} />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="car-outline" size={48} color={Colors.textHint} />
              <Text variant="bodyMedium" style={{ color: Colors.textHint, marginTop: 8 }}>
                Nenhum veículo encontrado
              </Text>
            </View>
          )
        }
      />

      <FAB icon="plus" color="#FFFFFF" style={[styles.fab, { bottom: bottomInset + 80 }]} onPress={openNovo} />

      {/* Bottom sheet: detalhe do veículo */}
      <RNModal
        visible={!!detalhe}
        transparent
        animationType="slide"
        onRequestClose={() => setDetalhe(null)}
      >
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setDetalhe(null)} />
        {detalhe && (
          <View style={[styles.sheet, { paddingBottom: bottomInset + 16 }]}>
            <View style={styles.sheetHandle} />

            {/* Info */}
            <View style={styles.sheetHeader}>
              <View style={[styles.tipoBadge, detalhe.tipo === 'moto' && styles.tipoBadgeMoto]}>
                <Ionicons
                  name={detalhe.tipo === 'moto' ? 'bicycle-outline' : 'car-outline'}
                  size={13}
                  color={detalhe.tipo === 'moto' ? '#7C3AED' : Colors.primary}
                />
                <Text style={[styles.tipoBadgeLabel, detalhe.tipo === 'moto' && { color: '#7C3AED' }]}>
                  {detalhe.tipo === 'moto' ? 'Moto' : 'Carro'}
                </Text>
              </View>
              <View style={styles.frotaBadge}>
                <Text style={styles.frotaText}>Frota {detalhe.frota}</Text>
              </View>
              <View style={[styles.statusDot, { backgroundColor: detalhe.ativo ? Colors.accent : Colors.textHint, marginLeft: 4 }]} />
              <Text style={[styles.statusLabel, { color: detalhe.ativo ? Colors.accent : Colors.textHint }]}>
                {detalhe.ativo ? 'Ativo' : 'Inativo'}
              </Text>
            </View>

            <Text variant="titleMedium" style={styles.sheetNome}>
              {detalhe.marca} {detalhe.modelo}
            </Text>

            <View style={styles.sheetMeta}>
              {detalhe.placa ? (
                <View style={styles.plateBadge}>
                  <Text style={styles.plateText}>{detalhe.placa}</Text>
                </View>
              ) : null}
              <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>
                {detalhe.ano}
                {detalhe.kmAtual ? ` · ${detalhe.kmAtual.toLocaleString('pt-BR')} km` : ''}
              </Text>
              <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>
                {detalhe.departamento}
              </Text>
            </View>

            <Divider style={{ marginVertical: 16 }} />

            {/* Ações */}
            <TouchableOpacity
              style={styles.sheetAction}
              onPress={() => { setDetalhe(null); openEditar(detalhe); }}
            >
              <View style={[styles.sheetActionIcon, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="pencil-outline" size={18} color={Colors.primary} />
              </View>
              <Text variant="bodyMedium" style={styles.sheetActionLabel}>Editar veículo</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textHint} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetAction}
              onPress={() => { setDetalhe(null); router.push(`/veiculo/${detalhe.id}` as any); }}
            >
              <View style={[styles.sheetActionIcon, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="people-outline" size={18} color="#16A34A" />
              </View>
              <Text variant="bodyMedium" style={styles.sheetActionLabel}>Vínculos e condutores</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textHint} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetAction}
              onPress={() => { setDetalhe(null); onDelete(detalhe); }}
            >
              <View style={[styles.sheetActionIcon, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="trash-outline" size={18} color="#DC2626" />
              </View>
              <Text variant="bodyMedium" style={[styles.sheetActionLabel, { color: '#DC2626' }]}>Excluir veículo</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textHint} />
            </TouchableOpacity>
          </View>
        )}
      </RNModal>

      {/* Bottom sheet: formulário novo/editar */}
      <RNModal
        visible={modal}
        transparent
        animationType="slide"
        onRequestClose={() => setModal(false)}
      >
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setModal(false)} />
        <View style={[styles.sheet, styles.formSheet, { paddingBottom: bottomInset + 16 }]}>
          <View style={styles.sheetHandle} />
          <Text variant="titleMedium" style={styles.formTitle}>
            {editando ? 'Editar veículo' : 'Novo veículo'}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Tipo */}
            <Controller
              control={control}
              name="tipo"
              render={({ field: { value, onChange } }) => (
                <View style={styles.tipoRow}>
                  {(['carro', 'moto'] as VeiculoTipo[]).map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.tipoCard, value === t && styles.tipoCardActive]}
                      onPress={() => onChange(t)}
                    >
                      <Ionicons
                        name={t === 'carro' ? 'car-outline' : 'bicycle-outline'}
                        size={22}
                        color={value === t ? Colors.primary : Colors.textSecondary}
                      />
                      <Text style={[styles.tipoLabel, value === t && { color: Colors.primary }]}>
                        {t === 'carro' ? 'Carro' : 'Moto'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />

            {/* Marca + Modelo */}
            <View style={styles.row2}>
              {(['marca', 'modelo'] as const).map((name) => (
                <View key={name} style={{ flex: 1 }}>
                  <Controller
                    control={control}
                    name={name}
                    render={({ field: { value, onChange, onBlur } }) => (
                      <TextInput
                        label={name === 'marca' ? 'Marca' : 'Modelo'}
                        mode="outlined"
                        value={value ?? ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        autoCapitalize="words"
                        error={!!errors[name]}
                        dense
                      />
                    )}
                  />
                  {errors[name] && <Text style={styles.err}>{errors[name]?.message}</Text>}
                </View>
              ))}
            </View>

            {/* Frota + Placa */}
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Controller
                  control={control}
                  name="frota"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <TextInput
                      label="Nº Frota"
                      mode="outlined"
                      value={value ?? ''}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={!!errors.frota}
                      dense
                    />
                  )}
                />
                {errors.frota && <Text style={styles.err}>{errors.frota.message}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Controller
                  control={control}
                  name="placa"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <TextInput
                      label={tipoWatch === 'moto' ? 'Placa (opcional)' : 'Placa'}
                      mode="outlined"
                      value={value ?? ''}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      autoCapitalize="characters"
                      error={!!errors.placa}
                      dense
                    />
                  )}
                />
                {errors.placa && <Text style={styles.err}>{errors.placa.message}</Text>}
              </View>
            </View>

            {/* Ano + KM */}
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Controller
                  control={control}
                  name="ano"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <TextInput
                      label="Ano"
                      mode="outlined"
                      value={value ?? ''}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      keyboardType="numeric"
                      error={!!errors.ano}
                      dense
                    />
                  )}
                />
                {errors.ano && <Text style={styles.err}>{errors.ano.message}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Controller
                  control={control}
                  name="kmAtual"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <TextInput
                      label="KM atual (opcional)"
                      mode="outlined"
                      value={value ?? ''}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      keyboardType="numeric"
                      dense
                    />
                  )}
                />
              </View>
            </View>

            {/* Departamento */}
            <View style={{ marginBottom: 8 }}>
              <Controller
                control={control}
                name="departamento"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    label="Departamento"
                    mode="outlined"
                    value={value ?? ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="words"
                    error={!!errors.departamento}
                    dense
                  />
                )}
              />
              {errors.departamento && <Text style={styles.err}>{errors.departamento.message}</Text>}
            </View>

            {/* Ativo */}
            <View style={styles.switchRow}>
              <Text variant="bodyMedium" style={{ color: Colors.textPrimary }}>Veículo ativo</Text>
              <Switch value={ativo} onValueChange={setAtivo} color={Colors.primary} />
            </View>

            <View style={styles.formActions}>
              <Button mode="outlined" onPress={() => setModal(false)} style={{ flex: 1 }}>
                Cancelar
              </Button>
              <Button mode="contained" onPress={handleSubmit(onSave)} style={{ flex: 1 }}>
                Salvar
              </Button>
            </View>
          </ScrollView>
        </View>
      </RNModal>
    </SafeAreaView>
  );
}

const VeiculoCard = React.memo(function VeiculoCard({ veiculo, onPress }: { veiculo: Veiculo; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Surface style={styles.card} elevation={1}>
        <View style={styles.cardHeader}>
          {veiculo.placa ? (
            <View style={styles.plateBadge}>
              <Text style={styles.plateText}>{veiculo.placa}</Text>
            </View>
          ) : null}
          <View style={styles.frotaBadge}>
            <Text style={styles.frotaText}>Frota {veiculo.frota}</Text>
          </View>
          <View style={[styles.tipoBadge, veiculo.tipo === 'moto' && styles.tipoBadgeMoto]}>
            <Ionicons
              name={veiculo.tipo === 'moto' ? 'bicycle-outline' : 'car-outline'}
              size={11}
              color={veiculo.tipo === 'moto' ? '#7C3AED' : Colors.primary}
            />
          </View>
          <View style={[styles.statusDot, { backgroundColor: veiculo.ativo ? Colors.accent : Colors.textHint }]} />
          <Text style={[styles.statusLabel, { color: veiculo.ativo ? Colors.accent : Colors.textHint }]}>
            {veiculo.ativo ? 'Ativo' : 'Inativo'}
          </Text>
          <View style={{ flex: 1 }} />
          <Ionicons name="chevron-forward" size={16} color={Colors.textHint} />
        </View>
        <Text variant="bodyMedium" style={styles.modelo}>{veiculo.marca} {veiculo.modelo} · {veiculo.ano}</Text>
        <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>{veiculo.departamento}</Text>
      </Surface>
    </TouchableOpacity>
  );
}, (prev, next) =>
  prev.veiculo.id === next.veiculo.id &&
  prev.veiculo.ativo === next.veiculo.ativo
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  title: { fontWeight: '700', color: Colors.textPrimary },
  searchBar: { paddingHorizontal: 20, marginBottom: 12 },
  input: { backgroundColor: Colors.card },
  list: { paddingHorizontal: 20, paddingBottom: 130 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  fab: { position: 'absolute', right: 20, backgroundColor: Colors.primary },
  footerLoader: { paddingVertical: 16 },
  footerHint: { textAlign: 'center', color: Colors.textHint, fontSize: 12, paddingVertical: 12 },
  card: {
    borderRadius: 12,
    padding: 14,
    backgroundColor: Colors.card,
    gap: 4,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  plateBadge: {
    backgroundColor: Colors.textPrimary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  plateText: { color: '#fff', fontWeight: '700', fontSize: 13, letterSpacing: 1 },
  frotaBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  frotaText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '500' },
  tipoBadge: {
    borderRadius: 4,
    padding: 3,
    backgroundColor: '#EFF6FF',
  },
  tipoBadgeMoto: { backgroundColor: '#F5F3FF' },
  tipoBadgeLabel: { fontSize: 12, fontWeight: '600' as const, color: Colors.primary },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 4 },
  statusLabel: { fontSize: 12, fontWeight: '600' },
  modelo: { color: Colors.textPrimary, fontWeight: '500' },
  // Bottom sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: 16,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sheetNome: { fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  sheetMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  sheetActionIcon: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetActionLabel: { flex: 1, color: Colors.textPrimary, fontWeight: '500' },
  // Formulário
  formSheet: { maxHeight: '92%' },
  formTitle: { fontWeight: '700', color: Colors.textPrimary, marginBottom: 16 },
  row2: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 12, marginBottom: 8 },
  tipoRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  tipoCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 12,
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.background,
  },
  tipoCardActive: {
    borderColor: Colors.primary,
    backgroundColor: '#EFF6FF',
  },
  tipoLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  err: { fontSize: 11, color: '#DC2626', marginLeft: 4 },
});
