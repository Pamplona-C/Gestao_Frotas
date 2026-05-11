import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput as RNTextInput,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, Button, Surface, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { OrdemServico, OSStatus, Fornecedor, CatalogoServico, ServicoRealizado } from '../../../types';
import { subscribeToOSById, updateOS, appendStatusEntry } from '../../../services/os.service';
import { subscribeToAllFornecedores } from '../../../services/fornecedor.service';
import { getServicosAtivos } from '../../../services/catalogo.service';
import { useAuthStore } from '../../../store/auth.store';
import { StatusBadge } from '../../../components/StatusBadge';
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

export default function GerenciarOSScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentUser } = useAuthStore();

  const [os, setOS] = useState<OrdemServico | null>(null);
  const [todos, setTodos] = useState<Fornecedor[]>([]);
  const [selectedFornecedor, setSelectedFornecedor] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<OSStatus | null>(null);
  const [nota, setNota] = useState('');
  const [servicosRealizados, setServicosRealizados] = useState<ServicoRealizado[]>([]);

  // Modal de seleção de serviço do catálogo
  const [catalogoModal, setCatalogoModal] = useState(false);
  const [catalogoItems, setCatalogoItems] = useState<CatalogoServico[]>([]);
  const [catalogoBusca, setCatalogoBusca] = useState('');

  const normCidade = (c: string) =>
    c.split(' - ')[0].trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const cidadeOS = os?.cidade ? normCidade(os.cidade) : '';
  const fornecedoresFiltrados = cidadeOS
    ? todos.filter((f) => normCidade(f.cidade) === cidadeOS)
    : [];

  useFocusEffect(
    useCallback(() => {
      const unsubOS = subscribeToOSById(id!, (data) => {
        if (!data) return;
        setOS(data);
        setSelectedFornecedor((prev) => prev ?? data.fornecedorId ?? null);
        setSelectedStatus((prev) => prev ?? data.status);
        setNota((prev) => prev || (data.notaInterna ?? ''));
        setServicosRealizados((prev) =>
          prev.length > 0 ? prev : (data.servicosRealizados ?? [])
        );
      });

      const unsubForn = subscribeToAllFornecedores((fornecedores) => {
        setTodos(fornecedores);
      });

      getServicosAtivos().then(setCatalogoItems);

      return () => { unsubOS(); unsubForn(); };
    }, [id])
  );

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

  const valorTotal       = servicosRealizados.reduce((acc, s) => acc + s.valor, 0);
  const gastoPreventiva  = servicosRealizados.filter((s) => s.tipo === 'preventiva').reduce((acc, s) => acc + s.valor, 0);
  const gastoCorretiva   = servicosRealizados.filter((s) => s.tipo === 'corretiva').reduce((acc, s) => acc + s.valor, 0);

  const onSave = async () => {
    if (!os || !currentUser) return;
    const novoStatus = selectedStatus ?? os.status;
    const ops: Promise<void>[] = [
      updateOS(os.id, {
        status:             novoStatus,
        fornecedorId:       selectedFornecedor ?? undefined,
        notaInterna:        nota || undefined,
        gestorId:           currentUser.uid,
        gestorNome:         currentUser.nome,
        gestorPhotoURL:     currentUser.photoURL ?? null,
        gestorDepartamento: currentUser.departamento,
        servicosRealizados: servicosRealizados.length > 0 ? servicosRealizados : undefined,
        valorTotal:         servicosRealizados.length > 0 ? valorTotal        : undefined,
        gastoPreventiva:    servicosRealizados.length > 0 ? gastoPreventiva   : undefined,
        gastoCorretiva:     servicosRealizados.length > 0 ? gastoCorretiva    : undefined,
      }),
    ];
    if (novoStatus !== os.status) {
      ops.push(appendStatusEntry(os.id, {
        status:    novoStatus,
        changedAt: new Date().toISOString(),
        changedBy: currentUser.nome,
      }));
    }
    await Promise.all(ops);
    router.back();
  };

  if (!os) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text variant="bodyMedium" style={{ color: Colors.textHint }}>Carregando…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const semMatchDeCidade = os.cidade != null && fornecedoresFiltrados.length === 0;
  const listaExibida = semMatchDeCidade ? todos : fornecedoresFiltrados;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text variant="titleMedium" style={styles.topTitle}>Gerenciar OS</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.currentStatus}>
        <Text variant="labelMedium" style={{ color: Colors.textSecondary }}>
          {os.id.toUpperCase()} · {os.placa}
        </Text>
        <StatusBadge status={os.status} />
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
          <Divider style={{ marginBottom: 10 }} />

          {listaExibida.map((f) => {
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
          })}
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

      {/* Modal catálogo */}
      <Modal
        visible={catalogoModal}
        animationType="slide"
        transparent
        onRequestClose={() => setCatalogoModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
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
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
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
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 12,
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
