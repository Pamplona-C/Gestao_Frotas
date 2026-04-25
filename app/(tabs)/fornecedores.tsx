import React, { useState, useCallback } from 'react';
import { View, StyleSheet, SectionList, ScrollView, RefreshControl, Linking, TouchableOpacity } from 'react-native';
import {
  Text,
  TextInput,
  FAB,
  Portal,
  Modal,
  Button,
  Surface,
  Divider,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Fornecedor } from '../../types';
import { subscribeToAllFornecedores, createFornecedor } from '../../services/fornecedor.service';
import { CidadeAutocomplete } from '../../components/CidadeAutocomplete';
import { Colors } from '../../constants/colors';

const schema = z.object({
  nome: z.string().min(2, 'Obrigatório'),
  cidade: z.string().min(2, 'Selecione uma cidade'),
  endereco: z.string().min(5, 'Obrigatório'),
  horario: z.string().min(2, 'Ex: Seg-Sex 8h-18h'),
  responsavel: z.string().min(2, 'Obrigatório'),
  telefone: z.string().min(10, 'Telefone inválido'),
  googleMapsUrl: z.string().url('URL inválida').optional().or(z.literal('')),
});
type FormData = z.infer<typeof schema>;

export default function FornecedoresScreen() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useFocusEffect(
    useCallback(() => {
      const unsub = subscribeToAllFornecedores((data) => {
        setFornecedores(data);
        setRefreshing(false);
      });
      return unsub;
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 2000);
  }, []);

  const filtered = fornecedores.filter(
    (f) =>
      f.nome.toLowerCase().includes(busca.toLowerCase()) ||
      f.cidade.toLowerCase().includes(busca.toLowerCase())
  );

  const grouped = filtered.reduce<Record<string, Fornecedor[]>>((acc, f) => {
    (acc[f.cidade] ??= []).push(f);
    return acc;
  }, {});
  const sections = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([title, data]) => ({ title, data }));

  const onSave = async (data: FormData) => {
    const payload = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined && v !== '')
    ) as Omit<typeof data, 'id'>;
    await createFornecedor(payload);
    setModal(false);
    reset();
  };

  const fields: { key: Exclude<keyof FormData, 'cidade'>; label: string; keyboard?: any }[] = [
    { key: 'nome', label: 'Nome da oficina' },
    { key: 'endereco', label: 'Endereço' },
    { key: 'horario', label: 'Horário (ex: Seg-Sex 8h-18h)' },
    { key: 'responsavel', label: 'Responsável' },
    { key: 'telefone', label: 'Telefone', keyboard: 'phone-pad' },
    { key: 'googleMapsUrl', label: 'Link do Google Maps (opcional)', keyboard: 'url' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text variant="titleLarge" style={styles.title}>Fornecedores</Text>
        <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>
          {fornecedores.length} cadastrados
        </Text>
      </View>

      <View style={styles.searchBar}>
        <TextInput
          mode="outlined"
          placeholder="Buscar por nome ou cidade…"
          value={busca}
          onChangeText={setBusca}
          left={<TextInput.Icon icon="magnify" />}
          style={styles.input}
          dense
        />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(f) => f.id}
        renderItem={({ item }) => <FornecedorCard fornecedor={item} />}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Ionicons name="location-outline" size={12} color={Colors.primary} />
            <Text variant="labelSmall" style={styles.sectionHeaderText}>{title}</Text>
          </View>
        )}
        SectionSeparatorComponent={() => <View style={{ height: 4 }} />}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            colors={[Colors.primary]} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="business-outline" size={48} color={Colors.textHint} />
            <Text variant="bodyMedium" style={{ color: Colors.textHint, marginTop: 8 }}>
              Nenhum fornecedor encontrado
            </Text>
          </View>
        }
      />

      <FAB icon="plus" style={styles.fab} onPress={() => setModal(true)} />

      <Portal>
        <Modal
          visible={modal}
          onDismiss={() => setModal(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Text variant="titleMedium" style={styles.modalTitle}>Novo fornecedor</Text>
          <Divider style={{ marginBottom: 12 }} />

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Campo cidade com autocomplete IBGE */}
            <View style={{ marginBottom: 8 }}>
              <Controller
                control={control}
                name="cidade"
                render={({ field: { value, onChange } }) => (
                  <CidadeAutocomplete
                    label="Cidade"
                    value={value}
                    onChange={onChange}
                    error={!!errors.cidade}
                    errorMessage={errors.cidade?.message}
                  />
                )}
              />
            </View>

            {fields.map(({ key, label, keyboard }) => (
              <View key={key} style={{ marginBottom: 8 }}>
                <Controller
                  control={control}
                  name={key}
                  render={({ field: { value, onChange, onBlur } }) => (
                    <TextInput
                      label={label}
                      mode="outlined"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      keyboardType={keyboard}
                      error={!!errors[key]}
                      dense
                    />
                  )}
                />
                {errors[key] && (
                  <Text style={styles.err}>{errors[key]?.message}</Text>
                )}
              </View>
            ))}
          </ScrollView>

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

function FornecedorCard({ fornecedor }: { fornecedor: Fornecedor }) {
  return (
    <Surface style={styles.card} elevation={1}>
      <View style={styles.cardHeader}>
        <View style={styles.iconCircle}>
          <Ionicons name="business" size={18} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="titleSmall" style={{ fontWeight: '600', color: Colors.textPrimary }}>
            {fornecedor.nome}
          </Text>
          <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>
            {fornecedor.cidade}
          </Text>
        </View>
      </View>
      <View style={styles.infoRow}>
        <Ionicons name="location-outline" size={13} color={Colors.textHint} />
        <Text variant="labelSmall" style={{ color: Colors.textSecondary }}>{fornecedor.endereco}</Text>
      </View>
      <View style={styles.infoRow}>
        <Ionicons name="time-outline" size={13} color={Colors.textHint} />
        <Text variant="labelSmall" style={{ color: Colors.textSecondary }}>{fornecedor.horario}</Text>
      </View>
      <View style={styles.infoRow}>
        <Ionicons name="person-outline" size={13} color={Colors.textHint} />
        <Text variant="labelSmall" style={{ color: Colors.textSecondary }}>
          {fornecedor.responsavel} · {fornecedor.telefone}
        </Text>
      </View>
      {fornecedor.googleMapsUrl ? (
        <TouchableOpacity
          style={styles.mapsBtn}
          onPress={() => Linking.openURL(fornecedor.googleMapsUrl!)}
          activeOpacity={0.75}
        >
          <Ionicons name="map-outline" size={13} color={Colors.primary} />
          <Text variant="labelSmall" style={{ color: Colors.primary, fontWeight: '600' }}>
            Ver no Google Maps
          </Text>
        </TouchableOpacity>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  title: { fontWeight: '700', color: Colors.textPrimary },
  searchBar: { paddingHorizontal: 20, marginBottom: 12 },
  input: { backgroundColor: Colors.card },
  list: { paddingHorizontal: 20, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  fab: { position: 'absolute', right: 20, bottom: 88, backgroundColor: Colors.primary },
  card: { borderRadius: 12, padding: 14, backgroundColor: Colors.card, gap: 6 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mapsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  sectionHeaderText: { color: Colors.primary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  modalContainer: {
    margin: 20,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: { fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  err: { fontSize: 11, color: '#DC2626', marginLeft: 4 },
});
