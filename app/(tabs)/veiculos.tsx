import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Veiculo } from '../../types';
import { subscribeToAllVeiculos, createVeiculo } from '../../services/veiculo.service';
import { Colors } from '../../constants/colors';

const schema = z.object({
  placa: z.string().min(7, 'Placa inválida').max(8),
  frota: z.string().min(1, 'Obrigatório'),
  modelo: z.string().min(2, 'Obrigatório'),
  ano: z.string().regex(/^\d{4}$/, 'Ano inválido'),
  departamento: z.string().min(2, 'Obrigatório'),
});
type FormData = z.infer<typeof schema>;

export default function VeiculosScreen() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState(false);
  const [ativo, setAtivo] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useFocusEffect(
    useCallback(() => {
      const unsub = subscribeToAllVeiculos((data) => {
        setVeiculos(data);
        setRefreshing(false);
      });
      return unsub;
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 2000);
  }, []);

  const filtered = veiculos.filter(
    (v) =>
      v.placa.toLowerCase().includes(busca.toLowerCase()) ||
      v.modelo.toLowerCase().includes(busca.toLowerCase()) ||
      v.frota.includes(busca)
  );

  const onSave = async (data: FormData) => {
    await createVeiculo({
      placa: data.placa.toUpperCase(),
      frota: data.frota,
      modelo: data.modelo,
      ano: parseInt(data.ano),
      departamento: data.departamento,
      ativo,
    });
    // onSnapshot já vai atualizar a lista automaticamente
    setModal(false);
    reset();
    setAtivo(true);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text variant="titleLarge" style={styles.title}>Veículos</Text>
        <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>
          {veiculos.length} cadastrados
        </Text>
      </View>

      <View style={styles.searchBar}>
        <TextInput
          mode="outlined"
          placeholder="Buscar placa, modelo ou frota…"
          value={busca}
          onChangeText={setBusca}
          left={<TextInput.Icon icon="magnify" />}
          style={styles.input}
          dense
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => <VeiculoCard veiculo={item} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            colors={[Colors.primary]} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="car-outline" size={48} color={Colors.textHint} />
            <Text variant="bodyMedium" style={{ color: Colors.textHint, marginTop: 8 }}>
              Nenhum veículo encontrado
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
          <Text variant="titleMedium" style={styles.modalTitle}>Novo veículo</Text>
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

function VeiculoCard({ veiculo }: { veiculo: Veiculo }) {
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
  list: { paddingHorizontal: 20, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  fab: { position: 'absolute', right: 20, bottom: 88, backgroundColor: Colors.primary },
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
