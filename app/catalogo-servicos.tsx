import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput as RNTextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, Button, Surface } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import {
  subscribeToServicos,
  createServico,
  updateServico,
  toggleServico,
} from '../services/catalogo.service';
import { CatalogoServico, TipoServico } from '../types';
import { Colors } from '../constants/colors';

const TIPO_OPTIONS: { key: TipoServico; label: string; color: string; bg: string }[] = [
  { key: 'preventiva', label: 'Preventiva', color: '#166534', bg: '#DCFCE7' },
  { key: 'corretiva',  label: 'Corretiva',  color: '#1e40af', bg: '#DBEAFE' },
];

function TipoBadge({ tipo }: { tipo: TipoServico }) {
  const opt = TIPO_OPTIONS.find((o) => o.key === tipo)!;
  return (
    <View style={[styles.badge, { backgroundColor: opt.bg }]}>
      <Text style={[styles.badgeText, { color: opt.color }]}>{opt.label}</Text>
    </View>
  );
}

export default function CatalogoServicosScreen() {
  const router = useRouter();
  const [servicos, setServicos] = useState<CatalogoServico[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<CatalogoServico | null>(null);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoServico>('corretiva');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const unsub = subscribeToServicos(setServicos);
      return unsub;
    }, []),
  );

  const openCreate = () => {
    setEditing(null);
    setNome('');
    setTipo('corretiva');
    setModalVisible(true);
  };

  const openEdit = (item: CatalogoServico) => {
    setEditing(item);
    setNome(item.nome);
    setTipo(item.tipo);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!nome.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateServico(editing.id, { nome: nome.trim(), tipo });
      } else {
        await createServico({ nome: nome.trim(), tipo, ativo: true });
      }
      setModalVisible(false);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (item: CatalogoServico) => {
    await toggleServico(item.id, !item.ativo);
  };

  const renderItem = ({ item }: { item: CatalogoServico }) => (
    <TouchableOpacity style={styles.row} onPress={() => openEdit(item)} activeOpacity={0.75}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          variant="bodyMedium"
          style={[styles.rowNome, !item.ativo && styles.rowNomeInativo]}
        >
          {item.nome}
        </Text>
        <TipoBadge tipo={item.tipo} />
      </View>
      <Switch
        value={item.ativo}
        onValueChange={() => handleToggle(item)}
        trackColor={{ false: Colors.border, true: `${Colors.primary}80` }}
        thumbColor={item.ativo ? Colors.primary : Colors.textHint}
      />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text variant="titleLarge" style={styles.pageTitle}>Catálogo de Serviços</Text>
        <TouchableOpacity onPress={openCreate} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={26} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={servicos}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={servicos.length === 0 ? styles.emptyContainer : styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContent}>
            <Ionicons name="construct-outline" size={52} color={Colors.textHint} />
            <Text style={styles.emptyText}>Nenhum serviço cadastrado</Text>
            <Button mode="contained" onPress={openCreate} style={{ marginTop: 12 }}>
              Adicionar primeiro serviço
            </Button>
          </View>
        }
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text variant="titleMedium" style={styles.sheetTitle}>
              {editing ? 'Editar serviço' : 'Novo serviço'}
            </Text>

            <Text variant="labelLarge" style={styles.fieldLabel}>Nome do serviço / peça</Text>
            <Surface style={styles.inputSurface} elevation={0}>
              <RNTextInput
                value={nome}
                onChangeText={setNome}
                placeholder="Ex: Troca de óleo, Pastilha de freio…"
                placeholderTextColor={Colors.textHint}
                style={styles.input}
                autoFocus
              />
            </Surface>

            <Text variant="labelLarge" style={[styles.fieldLabel, { marginTop: 16 }]}>Tipo</Text>
            <View style={styles.tipoRow}>
              {TIPO_OPTIONS.map((opt) => {
                const active = tipo === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.tipoCard,
                      active && { borderColor: opt.color, backgroundColor: opt.bg },
                    ]}
                    onPress={() => setTipo(opt.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.tipoLabel, active && { color: opt.color }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.sheetActions}>
              <Button
                mode="outlined"
                onPress={() => setModalVisible(false)}
                style={{ flex: 1 }}
              >
                Cancelar
              </Button>
              <Button
                mode="contained"
                onPress={handleSave}
                loading={saving}
                disabled={!nome.trim() || saving}
                style={{ flex: 1 }}
              >
                Salvar
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pageTitle: { fontWeight: '700', color: Colors.textPrimary },
  list: { paddingHorizontal: 16, paddingVertical: 8 },
  emptyContainer: { flex: 1 },
  emptyContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 80 },
  emptyText: { color: Colors.textHint, fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  separator: { height: 1, backgroundColor: Colors.border },
  rowNome: { fontSize: 15, color: Colors.textPrimary, fontWeight: '500' },
  rowNomeInativo: { color: Colors.textHint },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    gap: 4,
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
  fieldLabel: { color: Colors.textPrimary, fontWeight: '600', marginBottom: 6 },
  inputSurface: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  input: { fontSize: 15, color: Colors.textPrimary },
  tipoRow: { flexDirection: 'row', gap: 12 },
  tipoCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tipoLabel: { fontWeight: '700', fontSize: 14, color: Colors.textSecondary },
  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
});
