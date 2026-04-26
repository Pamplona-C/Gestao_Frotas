import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput as RNTextInput,
} from 'react-native';
import { Text, Button, Surface, Divider, Portal, Snackbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { OrdemServico, OSStatus, Fornecedor } from '../../../types';
import { subscribeToOSById, updateOS } from '../../../services/os.service';
import { subscribeToAllFornecedores } from '../../../services/fornecedor.service';
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

export default function GerenciarOSScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentUser } = useAuthStore();

  const [os, setOS] = useState<OrdemServico | null>(null);
  const [todos, setTodos] = useState<Fornecedor[]>([]);
  const [selectedFornecedor, setSelectedFornecedor] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<OSStatus | null>(null);
  const [nota, setNota] = useState('');
  const [snack, setSnack] = useState(false);

  // Derivado — recalcula automaticamente quando os ou todos mudam
  // Remove sufixo " - UF", acentos e caixa — tolera dados legados e IBGE
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
      });

      const unsubForn = subscribeToAllFornecedores((fornecedores) => {
        setTodos(fornecedores);
      });

      return () => { unsubOS(); unsubForn(); };
    }, [id])
  );

  const onSave = async () => {
    if (!os || !currentUser) return;
    await updateOS(os.id, {
      status:             selectedStatus ?? os.status,
      fornecedorId:       selectedFornecedor ?? undefined,
      notaInterna:        nota || undefined,
      gestorId:           currentUser.uid,
      gestorNome:         currentUser.nome,
      gestorPhotoURL:     currentUser.photoURL ?? null,
      gestorDepartamento: currentUser.departamento,
    });
    // Notificação disparada automaticamente pela Cloud Function (trigger onUpdate)
    setSnack(true);
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

      {/* Current status */}
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
                {active && (
                  <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                )}
              </TouchableOpacity>
            );
          })}
        </Surface>

        {/* Internal note */}
        <Surface style={styles.card} elevation={1}>
          <Text variant="titleSmall" style={styles.cardTitle}>Nota interna</Text>
          <Divider style={{ marginBottom: 10 }} />
          <View style={styles.textAreaWrapper}>
            <RNTextInput
              value={nota}
              onChangeText={setNota}
              multiline
              placeholder="Adicione uma nota interna sobre esta OS (orçamento, decisão, histórico…)"
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

      <Portal>
        <Snackbar
          visible={snack}
          onDismiss={() => setSnack(false)}
          duration={3000}
          action={{ label: 'OK', onPress: () => setSnack(false) }}
          style={styles.snackbar}
        >
          OS atualizada com sucesso!
        </Snackbar>
      </Portal>
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
  cityHint: { color: Colors.textHint, marginBottom: 4 },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
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
  statusLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },
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
  fornRowActive: {
    borderColor: Colors.primary,
    backgroundColor: '#F0FDF4',
  },
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
  textAreaWrapper: {
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  textArea: {
    fontSize: 14,
    color: Colors.textPrimary,
    minHeight: 90,
    lineHeight: 20,
  },
  btn: { borderRadius: 10 },
  btnContent: { paddingVertical: 4 },
  snackbar: { backgroundColor: Colors.primary },
});
