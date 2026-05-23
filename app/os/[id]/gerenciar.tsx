import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput as RNTextInput,
  FlatList,
} from 'react-native';
import { Text, Button, Surface, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { arrayUnion, doc, runTransaction, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { AppUser, CatalogoServico, Fornecedor, OrdemServico, OSStatus, ServicoRealizado, StatusEntry } from '../../../types';
import { subscribeToOSById } from '../../../services/os.service';
import { getAllFornecedores } from '../../../services/fornecedor.service';
import { getServicosAtivos } from '../../../services/catalogo.service';
import { getGestoresAtivos } from '../../../services/usuarios.service';
import { useAuthStore } from '../../../store/auth.store';

import { BottomSheet } from '../../../components/BottomSheet';
import { Colors } from '../../../constants/colors';

const STATUS_OPTIONS: { key: OSStatus; label: string; icon: string }[] = [
  { key: 'nova', label: 'Nova', icon: 'add-circle-outline' },
  { key: 'em_andamento', label: 'Em andamento', icon: 'play-circle-outline' },
  { key: 'em_diagnostico', label: 'Em diagnóstico', icon: 'search-outline' },
  { key: 'orcamento_aprovado', label: 'Orç. aprovado', icon: 'checkmark-circle-outline' },
  { key: 'concluida', label: 'Concluída', icon: 'flag-outline' },
];

const TIPO_COLORS = {
  preventiva: { color: '#166534', bg: '#DCFCE7' },
  corretiva:  { color: '#1e40af', bg: '#DBEAFE' },
};

function TipoBadge({ tipo }: { tipo: 'preventiva' | 'corretiva' }) {
  const { color, bg } = TIPO_COLORS[tipo];
  return (
    <View style={[styles.tipoBadge, { backgroundColor: bg }]}>
      <Text style={[styles.tipoBadgeText, { color }]}>
        {tipo === 'preventiva' ? 'Preventiva' : 'Corretiva'}
      </Text>
    </View>
  );
}

// Normaliza cidade para comparação sem acento e sem sufixo " - UF"
const normalizaCidade = (c: string) =>
  c.split(' - ')[0].trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function GerenciarOSScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentUser } = useAuthStore();

  const [os, setOS] = useState<OrdemServico | null>(null);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [selectedFornecedor, setSelectedFornecedor] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<OSStatus | null>(null);
  const [nota, setNota] = useState('');
  const [servicosRealizados, setServicosRealizados] = useState<ServicoRealizado[]>([]);

  const [gestores, setGestores] = useState<AppUser[]>([]);
  const [transferenciaModal, setTransferenciaModal] = useState(false);
  const [buscaGestor, setBuscaGestor] = useState('');
  const [loadingTransferencia, setLoadingTransferencia] = useState(false);

  // Modal de seleção de serviço do catálogo
  const [catalogoModal, setCatalogoModal] = useState(false);
  const [catalogoItems, setCatalogoItems] = useState<CatalogoServico[]>([]);
  const [catalogoBusca, setCatalogoBusca] = useState('');
  const [buscaFornecedor, setBuscaFornecedor] = useState('');

  // Ref para aplicar dados do Firestore só no primeiro snapshot — evita sobrescrever edições do usuário
  const initialized = useRef(false);

  // Catálogo: busca uma única vez no mount, não a cada focus
  useEffect(() => {
    let alive = true;
    getServicosAtivos().then((items) => { if (alive) setCatalogoItems(items); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    getGestoresAtivos().then((items) => { if (alive) setGestores(items); });
    return () => { alive = false; };
  }, []);

  // Fornecedores: one-shot — não precisam de listener em tempo real aqui
  useEffect(() => {
    let alive = true;
    getAllFornecedores().then((items) => { if (alive) setFornecedores(items); });
    return () => { alive = false; };
  }, []);

  useFocusEffect(
    useCallback(() => {
      initialized.current = false;
      const unsubOS = subscribeToOSById(id!, (data) => {
        if (!data) return;
        setOS(data);
        setSelectedFornecedor((prev) => prev ?? data.fornecedorId ?? null);
        setSelectedStatus((prev) => prev ?? data.status);
        setNota((prev) => prev || (data.notaInterna ?? ''));
        // Aplica serviços do Firestore apenas no primeiro disparo — preserva edições locais
        if (!initialized.current) {
          setServicosRealizados(data.servicosRealizados ?? []);
          initialized.current = true;
        }
      });
      return () => { unsubOS(); };
    }, [id])
  );

  useEffect(() => {
    if (!os || !currentUser) return;
    if (os.gestorId && os.gestorId !== currentUser.uid) {
      Alert.alert(
        'Acesso negado',
        'Esta OS já está sendo gerenciada por outro gestor.',
        [{ text: 'Voltar', onPress: () => router.back() }],
      );
    }
  }, [os, currentUser]);

  // Derived state memoizado — evita filter/reduce em todo render
  const cidadeOS = useMemo(
    () => (os?.cidade ? normalizaCidade(os.cidade) : ''),
    [os?.cidade],
  );

  const fornecedoresFiltrados = useMemo(
    () => (cidadeOS ? fornecedores.filter((f) => normalizaCidade(f.cidade) === cidadeOS) : []),
    [fornecedores, cidadeOS],
  );

  const gestoresFiltrados = useMemo(() => {
    const busca = buscaGestor.toLowerCase().trim();
    return gestores.filter(
      (g) => g.uid !== currentUser?.uid &&
        (!busca || g.nome.toLowerCase().includes(busca) || g.departamento.toLowerCase().includes(busca))
    );
  }, [gestores, buscaGestor, currentUser?.uid]);

  const handleTransferir = (destino: AppUser) => {
    Alert.alert(
      'Transferir responsabilidade',
      `Passar esta OS para ${destino.nome}? Você perderá o acesso de gerenciamento.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Transferir',
          style: 'destructive',
          onPress: async () => {
            setLoadingTransferencia(true);
            setTransferenciaModal(false);
            try {
              await updateDoc(doc(db, 'ordens-servico', os!.id), {
                gestorId:           destino.uid,
                gestorNome:         destino.nome,
                gestorPhotoURL:     destino.photoURL ?? null,
                gestorDepartamento: destino.departamento,
              });
              router.replace('/(tabs)');
            } catch {
              Alert.alert('Erro', 'Não foi possível transferir a OS. Tente novamente.');
            } finally {
              setLoadingTransferencia(false);
            }
          },
        },
      ],
    );
  };

  const openCatalogo = () => {
    setCatalogoBusca('');
    setCatalogoModal(true);
  };

  const addServico = (item: CatalogoServico) => {
    const jaAdicionado = servicosRealizados.some((s) => s.catalogoId === item.id);
    if (!jaAdicionado) {
      setServicosRealizados((prev) => [
        ...prev,
        { catalogoId: item.id, nome: item.nome, tipo: item.tipo, valor: 0 },
      ]);
    }
    setCatalogoModal(false);
  };

  const removeServico = (catalogoId: string) => {
    setServicosRealizados((prev) => prev.filter((s) => s.catalogoId !== catalogoId));
  };

  const updateValor = (catalogoId: string, raw: string) => {
    const valor = parseFloat(raw.replace(',', '.')) || 0;
    setServicosRealizados((prev) =>
      prev.map((s) => (s.catalogoId === catalogoId ? { ...s, valor } : s))
    );
  };

  const { valorTotal, gastoPreventiva, gastoCorretiva } = useMemo(() => ({
    valorTotal:      servicosRealizados.reduce((acc, s) => acc + s.valor, 0),
    gastoPreventiva: servicosRealizados.filter((s) => s.tipo === 'preventiva').reduce((acc, s) => acc + s.valor, 0),
    gastoCorretiva:  servicosRealizados.filter((s) => s.tipo === 'corretiva').reduce((acc, s) => acc + s.valor, 0),
  }), [servicosRealizados]);

  const onSave = async () => {
    if (!os || !currentUser) return;
    const novoStatus = selectedStatus ?? os.status;
    const temServicos = servicosRealizados.length > 0;

    const updates = Object.fromEntries(Object.entries({
      status:             novoStatus,
      fornecedorId:       selectedFornecedor ?? undefined,
      notaInterna:        nota || undefined,
      gestorId:           currentUser.uid,
      gestorNome:         currentUser.nome,
      gestorPhotoURL:     currentUser.photoURL ?? null,
      gestorDepartamento: currentUser.departamento,
      servicosRealizados: temServicos ? servicosRealizados : undefined,
      valorTotal:         temServicos ? valorTotal          : undefined,
      gastoPreventiva:    temServicos ? gastoPreventiva     : undefined,
      gastoCorretiva:     temServicos ? gastoCorretiva      : undefined,
      ...(novoStatus !== os.status && {
        statusHistory: arrayUnion({
          status:    novoStatus,
          changedAt: new Date().toISOString(),
          changedBy: currentUser.nome,
        } satisfies StatusEntry),
      }),
    }).filter(([, v]) => v !== undefined));

    const osRef = doc(db, 'ordens-servico', os.id);
    const primeiroAssignment = !os.gestorId;

    if (primeiroAssignment) {
      try {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(osRef);
          if (snap.data()?.gestorId) {
            throw new Error('OS já foi assumida por outro gestor.');
          }
          tx.update(osRef, updates);
        });
      } catch (e: any) {
        Alert.alert('Conflito', e.message ?? 'Não foi possível salvar. Tente novamente.');
        return;
      }
    } else {
      const batch = writeBatch(db);
      batch.update(osRef, updates);
      await batch.commit();
    }
    router.back();
  };

  // Busca + limite de fornecedores — hooks antes do early return
  const semMatchDeCidade = os?.cidade != null && fornecedoresFiltrados.length === 0;
  const baseList = semMatchDeCidade ? fornecedores : fornecedoresFiltrados;

  const FORN_LIMIT = 5;
  const { listaVisivelForn, totalBaseForn } = useMemo(() => {
    const q = buscaFornecedor.toLowerCase().trim();
    const filtered = q
      ? baseList.filter((f) =>
          f.nome.toLowerCase().includes(q) || f.cidade.toLowerCase().includes(q)
        )
      : baseList;

    if (q) return { listaVisivelForn: filtered, totalBaseForn: filtered.length };

    // Sem busca: limita a FORN_LIMIT, mas garante que o selecionado aparece
    const sliced = filtered.slice(0, FORN_LIMIT);
    if (selectedFornecedor && !sliced.find((f) => f.id === selectedFornecedor)) {
      const sel = filtered.find((f) => f.id === selectedFornecedor);
      if (sel) return { listaVisivelForn: [sel, ...sliced.slice(0, FORN_LIMIT - 1)], totalBaseForn: filtered.length };
    }
    return { listaVisivelForn: sliced, totalBaseForn: filtered.length };
  }, [baseList, buscaFornecedor, selectedFornecedor]);

  if (!os) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text variant="bodyMedium" style={{ color: Colors.textHint }}>Carregando…</Text>
        </View>
      </SafeAreaView>
    );
  }
  const veiculoNome = [os.veiculoMarca, os.veiculoModelo].filter(Boolean).join(' ').trim();
  const veiculoLabel = veiculoNome || `Frota ${os.frota}`;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text variant="titleMedium" style={styles.topTitle}>Gerenciar OS</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.currentStatus}>
        <Text variant="labelSmall" style={styles.currentStatusText} numberOfLines={1}>
          {os.id.toUpperCase()} · {veiculoLabel}{os.placa ? ` · ${os.placa}` : ''}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Status selector */}
        <Surface style={styles.card} elevation={1}>
          <Text variant="titleSmall" style={styles.cardTitle}>Status da OS</Text>
          <Divider style={{ marginBottom: 10 }} />
          <View style={styles.statusGrid}>
            {STATUS_OPTIONS.map((opt) => {
              const active = (selectedStatus ?? os.status) === opt.key;
              const { bg, text } = Colors.status[opt.key];
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.statusOption,
                    active && { backgroundColor: bg, borderColor: text },
                  ]}
                  onPress={() => setSelectedStatus(opt.key)}
                >
                  <Ionicons
                    name={opt.icon as any}
                    size={18}
                    color={active ? text : Colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.statusLabel,
                      active && { color: text, fontWeight: '700' },
                    ]}
                    numberOfLines={2}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Surface>

        {/* Fornecedor picker */}
        <Surface style={styles.card} elevation={1}>
          <Text variant="titleSmall" style={styles.cardTitle}>Fornecedor</Text>
          {os.cidade && !semMatchDeCidade && (
            <Text variant="labelSmall" style={styles.cityHint}>
              Fornecedores em {os.cidade}
            </Text>
          )}
          {semMatchDeCidade && (
            <View style={styles.noMatchBanner}>
              <Ionicons name="warning-outline" size={13} color="#B45309" />
              <Text variant="labelSmall" style={styles.noMatchText}>
                Nenhum fornecedor em {os.cidade} · Mostrando todas as cidades
              </Text>
            </View>
          )}

          {/* Busca */}
          <View style={styles.fornBuscaWrapper}>
            <Ionicons name="search-outline" size={15} color={Colors.textHint} />
            <RNTextInput
              value={buscaFornecedor}
              onChangeText={setBuscaFornecedor}
              placeholder="Buscar por nome ou cidade…"
              placeholderTextColor={Colors.textHint}
              style={styles.fornBuscaInput}
              returnKeyType="search"
            />
            {buscaFornecedor.length > 0 && (
              <TouchableOpacity onPress={() => setBuscaFornecedor('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={Colors.textHint} />
              </TouchableOpacity>
            )}
          </View>

          <Divider style={{ marginBottom: 10 }} />

          {listaVisivelForn.length === 0 ? (
            <Text style={styles.fornVazio}>Nenhum fornecedor encontrado</Text>
          ) : (
            listaVisivelForn.map((f) => {
              const active = selectedFornecedor === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.fornRow, active && styles.fornRowActive]}
                  onPress={() => setSelectedFornecedor(active ? null : f.id)}
                >
                  <View style={styles.fornIcon}>
                    <Ionicons
                      name={active ? 'business' : 'business-outline'}
                      size={18}
                      color={active ? Colors.primary : Colors.textSecondary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      variant="bodyMedium"
                      style={[{ fontWeight: '500', color: Colors.textPrimary }, active && { color: Colors.primary }]}
                    >
                      {f.nome}
                    </Text>
                    <Text variant="labelSmall" style={{ color: Colors.textSecondary }}>
                      {f.cidade} · {f.horario}
                    </Text>
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
                </TouchableOpacity>
              );
            })
          )}

          {!buscaFornecedor && totalBaseForn > FORN_LIMIT && (
            <Text style={styles.fornContador}>
              Mostrando {listaVisivelForn.length} de {totalBaseForn} · Use a busca para filtrar
            </Text>
          )}
          {buscaFornecedor.length > 0 && (
            <Text style={styles.fornContador}>
              {totalBaseForn} resultado{totalBaseForn !== 1 ? 's' : ''}
            </Text>
          )}
        </Surface>

        {/* Serviços realizados */}
        <Surface style={styles.card} elevation={1}>
          <View style={styles.cardTitleRow}>
            <Text variant="titleSmall" style={styles.cardTitle}>Serviços realizados</Text>
            <TouchableOpacity onPress={openCatalogo} style={styles.addBtn}>
              <Ionicons name="add" size={16} color={Colors.primary} />
              <Text style={styles.addBtnText}>Adicionar</Text>
            </TouchableOpacity>
          </View>
          <Divider style={{ marginBottom: 10 }} />

          {servicosRealizados.length === 0 ? (
            <Text variant="bodySmall" style={styles.emptyServicos}>
              Nenhum serviço adicionado ainda
            </Text>
          ) : (
            <>
              {servicosRealizados.map((s) => (
                <View key={s.catalogoId} style={styles.servicoRow}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text variant="bodyMedium" style={{ color: Colors.textPrimary, fontWeight: '500' }}>
                      {s.nome}
                    </Text>
                    <TipoBadge tipo={s.tipo} />
                  </View>
                  <View style={styles.valorWrapper}>
                    <Text style={styles.cifrao}>R$</Text>
                    <RNTextInput
                      value={s.valor > 0 ? String(s.valor) : ''}
                      onChangeText={(v) => updateValor(s.catalogoId, v)}
                      keyboardType="decimal-pad"
                      placeholder="0,00"
                      placeholderTextColor={Colors.textHint}
                      style={styles.valorInput}
                    />
                  </View>
                  <TouchableOpacity onPress={() => removeServico(s.catalogoId)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              ))}
              <Divider style={{ marginVertical: 10 }} />
              <View style={styles.totalRow}>
                <Text variant="labelMedium" style={{ color: Colors.textSecondary }}>Total</Text>
                <Text variant="titleSmall" style={styles.totalValue}>
                  {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </Text>
              </View>
            </>
          )}
        </Surface>

        {/* Internal note */}
        <Surface style={styles.card} elevation={1}>
          <Text variant="titleSmall" style={styles.cardTitle}>Mensagem para o condutor</Text>
          <Divider style={{ marginBottom: 10 }} />
          <View style={styles.textAreaWrapper}>
            <RNTextInput
              value={nota}
              onChangeText={setNota}
              multiline
              placeholder="Adicione uma mensagem para o condutor sobre esta OS…"
              placeholderTextColor={Colors.textHint}
              style={styles.textArea}
              textAlignVertical="top"
            />
          </View>
        </Surface>

        {os.gestorId && (
          <Button
            mode="outlined"
            icon="account-switch-outline"
            loading={loadingTransferencia}
            disabled={loadingTransferencia}
            style={[styles.btn, { marginBottom: 4 }]}
            contentStyle={styles.btnContent}
            onPress={() => { setBuscaGestor(''); setTransferenciaModal(true); }}
          >
            Transferir responsabilidade
          </Button>
        )}

        <Button
          mode="contained"
          style={styles.btn}
          contentStyle={styles.btnContent}
          icon="content-save"
          onPress={onSave}
        >
          Salvar e notificar
        </Button>
      </ScrollView>

      </KeyboardAvoidingView>

      {/* Modal catálogo */}
      <BottomSheet
        visible={catalogoModal}
        onDismiss={() => setCatalogoModal(false)}
        keyboardAvoiding
        contentStyle={styles.sheet}
      >
        <Text variant="titleMedium" style={styles.sheetTitle}>Selecionar serviço</Text>
        <View style={styles.buscaWrapper}>
          <Ionicons name="search-outline" size={16} color={Colors.textHint} />
          <RNTextInput
            value={catalogoBusca}
            onChangeText={setCatalogoBusca}
            placeholder="Buscar serviço…"
            placeholderTextColor={Colors.textHint}
            style={styles.buscaInput}
          />
        </View>
        <FlatList
          data={catalogoItems.filter((i) =>
            i.nome.toLowerCase().includes(catalogoBusca.toLowerCase())
          )}
          keyExtractor={(item) => item.id}
          style={{ maxHeight: 400 }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: Colors.border }} />}
          ListEmptyComponent={
            <Text style={{ color: Colors.textHint, textAlign: 'center', padding: 20 }}>
              Nenhum serviço ativo no catálogo
            </Text>
          }
          renderItem={({ item }) => {
            const jaAdicionado = servicosRealizados.some((s) => s.catalogoId === item.id);
            return (
              <TouchableOpacity
                style={[styles.catalogoRow, jaAdicionado && styles.catalogoRowDisabled]}
                onPress={() => !jaAdicionado && addServico(item)}
                activeOpacity={jaAdicionado ? 1 : 0.7}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text variant="bodyMedium" style={{ color: jaAdicionado ? Colors.textHint : Colors.textPrimary }}>
                    {item.nome}
                  </Text>
                  <TipoBadge tipo={item.tipo} />
                </View>
                {jaAdicionado && (
                  <Text style={{ color: Colors.textHint, fontSize: 12 }}>Adicionado</Text>
                )}
              </TouchableOpacity>
            );
          }}
        />
        <Button mode="outlined" onPress={() => setCatalogoModal(false)} style={{ marginTop: 12 }}>
          Fechar
        </Button>
      </BottomSheet>

      {/* Modal transferência de titularidade */}
      <BottomSheet
        visible={transferenciaModal}
        onDismiss={() => setTransferenciaModal(false)}
        keyboardAvoiding
        contentStyle={styles.sheet}
      >
        <Text variant="titleMedium" style={styles.sheetTitle}>Transferir para</Text>
        <View style={styles.buscaWrapper}>
          <Ionicons name="search-outline" size={16} color={Colors.textHint} />
          <RNTextInput
            value={buscaGestor}
            onChangeText={setBuscaGestor}
            placeholder="Buscar por nome ou departamento…"
            placeholderTextColor={Colors.textHint}
            style={styles.buscaInput}
          />
        </View>
        <FlatList
          data={gestoresFiltrados}
          keyExtractor={(g) => g.uid}
          style={{ maxHeight: 320 }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: Colors.border }} />}
          ListEmptyComponent={
            <Text style={{ color: Colors.textHint, textAlign: 'center', padding: 20 }}>
              Nenhum gestor encontrado
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.catalogoRow}
              onPress={() => handleTransferir(item)}
            >
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium" style={{ color: Colors.textPrimary }}>{item.nome}</Text>
                <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>{item.departamento}</Text>
              </View>
              <Ionicons name="arrow-forward-outline" size={18} color={Colors.textHint} />
            </TouchableOpacity>
          )}
        />
        <Button mode="outlined" onPress={() => setTransferenciaModal(false)} style={{ marginTop: 12 }}>
          Fechar
        </Button>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  topTitle: { fontWeight: '600', color: Colors.textPrimary },
  currentStatus: {
    paddingHorizontal: 20,
    marginBottom: 8,
    alignItems: 'center',
  },
  currentStatusText: { color: Colors.textSecondary, textAlign: 'center' },
  scroll: { padding: 20, gap: 12 },
  card: { borderRadius: 12, padding: 14, backgroundColor: Colors.card },
  cardTitle: { fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cityHint: { color: Colors.textHint, marginBottom: 4 },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusOption: {
    width: '30%',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  statusLabel: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center', fontWeight: '500' },
  fornRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderRadius: 8,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginBottom: 6,
  },
  fornRowActive: { borderColor: Colors.primary, backgroundColor: '#F0FDF4' },
  fornBuscaWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
    marginBottom: 10,
    backgroundColor: Colors.background,
  },
  fornBuscaInput: { flex: 1, fontSize: 14, color: Colors.textPrimary },
  fornVazio: { color: Colors.textHint, textAlign: 'center', paddingVertical: 12, fontSize: 13 },
  fornContador: { color: Colors.textHint, fontSize: 12, textAlign: 'center', marginTop: 6 },
  fornIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noMatchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 4,
  },
  noMatchText: { color: '#B45309', flex: 1 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  emptyServicos: { color: Colors.textHint, textAlign: 'center', paddingVertical: 8 },
  servicoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  valorWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 90,
  },
  cifrao: { color: Colors.textSecondary, fontSize: 13, marginRight: 2 },
  valorInput: { fontSize: 14, color: Colors.textPrimary, flex: 1 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalValue: { color: Colors.primary, fontWeight: '700' },
  tipoBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  tipoBadgeText: { fontSize: 11, fontWeight: '700' },
  textAreaWrapper: {
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  textArea: { fontSize: 14, color: Colors.textPrimary, minHeight: 90, lineHeight: 20 },
  btn: { borderRadius: 10 },
  btnContent: { paddingVertical: 4 },
  sheet: {
    backgroundColor: Colors.background,
  },
  sheetTitle: { fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  buscaWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    backgroundColor: Colors.card,
  },
  buscaInput: { flex: 1, fontSize: 14, color: Colors.textPrimary },
  catalogoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  catalogoRowDisabled: { opacity: 0.5 },
});
