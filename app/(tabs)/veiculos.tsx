import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  Text,
  TextInput,
  FAB,
  Portal,
  Modal,
  Button,
  Surface,
  Divider,
  Switch,
} from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import { Veiculo } from '../../types';
import {
  getVeiculosPaginados,
  getAllVeiculos,
  createVeiculo,
  updateVeiculo,
  deleteVeiculo,
} from '../../services/veiculo.service';
import { cacheGet, cacheSet, cacheInvalidate } from '../../lib/cache';
import { Colors } from '../../constants/colors';

const CACHE_KEY = 'cache:veiculos:p1';

const schema = z.object({
  placa: z.string().min(7, 'Placa inválida').max(8),
  frota: z.string().min(1, 'Obrigatório'),
  modelo: z.string().min(2, 'Obrigatório'),
  ano: z.string().regex(/^\d{4}$/, 'Ano inválido'),
  departamento: z.string().min(2, 'Obrigatório'),
});
type FormData = z.infer<typeof schema>;

export default function VeiculosScreen() {
  const { bottom: bottomInset } = useSafeAreaInsets();

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

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // ── Paginação ────────────────────────────────────────────────────────────
  const carregarPrimeiraPagina = useCallback(async () => {
    // 1. Mostra cache imediatamente (se válido)
    const cached = await cacheGet<Veiculo[]>(CACHE_KEY);
    if (cached) {
      setVeiculos(cached);
      setCarregando(false);
    } else {
      setCarregando(true);
    }

    // 2. Busca dados frescos do Firestore em background
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

  // Foca tela → carrega página 1 (apenas se não há busca ativa)
  useFocusEffect(
    useCallback(() => {
      if (!buscaRef.current.trim()) carregarPrimeiraPagina();
    }, [carregarPrimeiraPagina])
  );

  // Busca: debounce 350ms; quando vazia, volta ao modo paginado
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
              v.placa.toLowerCase().includes(lower) ||
              v.modelo.toLowerCase().includes(lower) ||
              v.frota.includes(trimmed),
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
    reset({ placa: '', frota: '', modelo: '', ano: '', departamento: '' });
    setAtivo(true);
    setModal(true);
  };

  const openEditar = (v: Veiculo) => {
    setEditando(v);
    reset({
      placa: v.placa,
      frota: v.frota,
      modelo: v.modelo,
      ano: String(v.ano),
      departamento: v.departamento,
    });
    setAtivo(v.ativo);
    setModal(true);
  };

  const onSave = async (data: FormData) => {
    const payload = {
      placa: data.placa.toUpperCase(),
      frota: data.frota,
      modelo: data.modelo,
      ano: parseInt(data.ano),
      departamento: data.departamento,
      ativo,
    };
    if (editando) {
      await updateVeiculo(editando.id, payload);
    } else {
      await createVeiculo(payload);
    }
    setModal(false);
    reset();
    setAtivo(true);
    setEditando(null);
    // Recarrega a lista para refletir a mudança
    cacheInvalidate(CACHE_KEY);
    setBusca('');
    carregarPrimeiraPagina();
  };

  const onDelete = (v: Veiculo) => {
    Alert.alert(
      'Excluir veículo',
      `Deseja excluir ${v.placa} — ${v.modelo}? Esta ação não pode ser desfeita.`,
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
          placeholder="Buscar placa, modelo ou frota…"
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
            onEdit={() => openEditar(item)}
            onDelete={() => onDelete(item)}
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
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
            <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
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

      <FAB icon="plus" style={[styles.fab, { bottom: bottomInset + 80 }]} onPress={openNovo} />

      <Portal>
        <Modal
          visible={modal}
          onDismiss={() => setModal(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Text variant="titleMedium" style={styles.modalTitle}>
            {editando ? 'Editar veículo' : 'Novo veículo'}
          </Text>
          <Divider style={{ marginBottom: 12 }} />

          {(['placa', 'frota', 'modelo', 'ano', 'departamento'] as const).map((field) => (
            <View key={field} style={{ marginBottom: 8 }}>
              <Controller
                control={control}
                name={field}
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    label={
                      field === 'placa' ? 'Placa' :
                      field === 'frota' ? 'Nº Frota' :
                      field === 'modelo' ? 'Modelo' :
                      field === 'ano' ? 'Ano' : 'Departamento'
                    }
                    mode="outlined"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType={field === 'ano' ? 'numeric' : 'default'}
                    autoCapitalize={field === 'placa' ? 'characters' : 'words'}
                    error={!!errors[field]}
                    dense
                  />
                )}
              />
              {errors[field] && (
                <Text style={styles.err}>{errors[field]?.message}</Text>
              )}
            </View>
          ))}

          <View style={styles.switchRow}>
            <Text variant="bodyMedium" style={{ color: Colors.textPrimary }}>Ativo</Text>
            <Switch value={ativo} onValueChange={setAtivo} color={Colors.primary} />
          </View>

          <View style={styles.modalActions}>
            <Button mode="outlined" onPress={() => setModal(false)} style={{ flex: 1 }}>
              Cancelar
            </Button>
            <Button mode="contained" onPress={handleSubmit(onSave)} style={{ flex: 1 }}>
              Salvar
            </Button>
          </View>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

function VeiculoCard({
  veiculo,
  onEdit,
  onDelete,
}: {
  veiculo: Veiculo;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Surface style={styles.card} elevation={1}>
      <View style={styles.cardHeader}>
        <View style={styles.plateBadge}>
          <Text style={styles.plateText}>{veiculo.placa}</Text>
        </View>
        <View style={styles.frotaBadge}>
          <Text style={styles.frotaText}>Frota {veiculo.frota}</Text>
        </View>
        <View style={[styles.statusDot, { backgroundColor: veiculo.ativo ? Colors.accent : Colors.textHint }]} />
        <Text style={[styles.statusLabel, { color: veiculo.ativo ? Colors.accent : Colors.textHint }]}>
          {veiculo.ativo ? 'Ativo' : 'Inativo'}
        </Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={onEdit} style={styles.actionBtn} hitSlop={8}>
          <Ionicons name="pencil-outline" size={17} color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={styles.actionBtn} hitSlop={8}>
          <Ionicons name="trash-outline" size={17} color="#DC2626" />
        </TouchableOpacity>
      </View>
      <Text variant="bodyMedium" style={styles.modelo}>{veiculo.modelo} · {veiculo.ano}</Text>
      <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>{veiculo.departamento}</Text>
    </Surface>
  );
}

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
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  statusDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 4 },
  statusLabel: { fontSize: 12, fontWeight: '600' },
  modelo: { color: Colors.textPrimary, fontWeight: '500' },
  actionBtn: { padding: 4 },
  // Modal
  modalContainer: {
    margin: 20,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    gap: 4,
  },
  modalTitle: { fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  err: { fontSize: 11, color: '#DC2626', marginLeft: 4 },
});
