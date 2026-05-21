import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Text, Surface, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Vinculo } from '../../types';
import { subscribeToVinculosByCondutorId } from '../../services/vinculo.service';
import { useAuthStore } from '../../store/auth.store';
import { Colors } from '../../constants/colors';

type ChecklistStatus = 'pendente_entrada' | 'em_uso' | 'pendente_saida';

function getChecklistStatus(v: Vinculo): ChecklistStatus {
  if (!v.checklistEntradaId) return 'pendente_entrada';
  if (!v.checklistSaidaId) return 'em_uso';
  return 'pendente_saida';
}

const STATUS_CONFIG: Record<ChecklistStatus, { label: string; color: string; bg: string }> = {
  pendente_entrada: { label: 'Pendente checklist de entrada', color: '#D97706', bg: '#FFFBEB' },
  em_uso:           { label: 'Em uso',                        color: '#16A34A', bg: '#F0FDF4' },
  pendente_saida:   { label: 'Pendente checklist de saída',   color: '#2563EB', bg: '#EFF6FF' },
};

export default function MeusVeiculosScreen() {
  const router = useRouter();
  const { currentUser } = useAuthStore();
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [carregando, setCarregando] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!currentUser?.uid) return;
      const unsub = subscribeToVinculosByCondutorId(currentUser.uid, (all) => {
        setVinculos(all.filter((v) => v.status === 'ativo'));
        setCarregando(false);
      });
      return unsub;
    }, [currentUser?.uid])
  );

  const handleChecklist = (vinculo: Vinculo, tipo: 'entrada' | 'saida') => {
    router.push(`/checklist/${vinculo.id}/${tipo}` as any);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text variant="titleLarge" style={styles.title}>Meus Veículos</Text>
        <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>
          {vinculos.length} vinculado{vinculos.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {carregando ? (
        <ActivityIndicator style={{ flex: 1 }} color={Colors.primary} />
      ) : (
        <FlatList
          data={vinculos}
          keyExtractor={(v) => v.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="car-outline" size={52} color={Colors.textHint} />
              <Text variant="bodyMedium" style={{ color: Colors.textHint, marginTop: 10, textAlign: 'center' }}>
                Nenhum veículo vinculado.{'\n'}Contate o gestor.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const st = getChecklistStatus(item);
            const cfg = STATUS_CONFIG[st];
            return (
              <Surface style={styles.card} elevation={1}>
                <View style={styles.cardHeader}>
                  <View style={[styles.tipoBadge, item.veiculoTipo === 'moto' && styles.tipoBadgeMoto]}>
                    <Ionicons
                      name={item.veiculoTipo === 'moto' ? 'bicycle-outline' : 'car-outline'}
                      size={13}
                      color={item.veiculoTipo === 'moto' ? '#7C3AED' : Colors.primary}
                    />
                    <Text style={[styles.tipoBadgeText, item.veiculoTipo === 'moto' && { color: '#7C3AED' }]}>
                      {item.veiculoTipo === 'moto' ? 'Moto' : 'Carro'}
                    </Text>
                  </View>
                  <View style={styles.frotaBadge}>
                    <Text style={styles.frotaText}>Frota {item.veiculoFrota}</Text>
                  </View>
                </View>

                <Text variant="titleSmall" style={styles.veiculoNome}>
                  {item.veiculoMarca} {item.veiculoModelo}
                </Text>
                {item.veiculoPlaca ? (
                  <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>
                    {item.veiculoPlaca}
                  </Text>
                ) : null}

                <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                  <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
                  <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>

                {st === 'pendente_entrada' && (
                  <Button
                    mode="contained"
                    icon="camera"
                    onPress={() => handleChecklist(item, 'entrada')}
                    style={{ marginTop: 10 }}
                  >
                    Fazer checklist de entrada
                  </Button>
                )}
                {st === 'em_uso' && (
                  <Button
                    mode="outlined"
                    icon="camera"
                    onPress={() => handleChecklist(item, 'saida')}
                    style={{ marginTop: 10 }}
                  >
                    Fazer checklist de saída
                  </Button>
                )}
              </Surface>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontWeight: '700', color: Colors.textPrimary },
  list: { paddingHorizontal: 20, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingTop: 80 },
  card: { borderRadius: 14, padding: 16, backgroundColor: Colors.card, gap: 6 },
  cardHeader: { flexDirection: 'row', gap: 8, marginBottom: 2 },
  tipoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#EFF6FF',
  },
  tipoBadgeMoto: { backgroundColor: '#F5F3FF' },
  tipoBadgeText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  frotaBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  frotaText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '500' },
  veiculoNome: { fontWeight: '700', color: Colors.textPrimary },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '600' },
});
