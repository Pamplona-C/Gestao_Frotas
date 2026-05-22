import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Text, Button, Surface, Divider, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Veiculo, Vinculo, AppUser } from '../../types';
import { getVeiculoById } from '../../services/veiculo.service';
import {
  subscribeToVinculosByVeiculoId,
  createVinculo,
  encerrarVinculo,
} from '../../services/vinculo.service';
import { getCondutoresAtivos } from '../../services/usuarios.service';
import { useAuthStore } from '../../store/auth.store';
import { BottomSheet } from '../../components/BottomSheet';
import { SkeletonCondutorList } from '../../components/SkeletonCard';
import { Colors } from '../../constants/colors';

type ChecklistStatus = 'pendente_entrada' | 'em_uso' | 'pendente_saida' | 'encerrado';

function getStatus(v: Vinculo): ChecklistStatus {
  if (v.status === 'inativo') return 'encerrado';
  if (!v.checklistEntradaId) return 'pendente_entrada';
  if (!v.checklistSaidaId) return 'em_uso';
  return 'encerrado';
}

const STATUS_LABELS: Record<ChecklistStatus, string> = {
  pendente_entrada: 'Pendente entrada',
  em_uso:           'Em uso',
  pendente_saida:   'Pendente saída',
  encerrado:        'Encerrado',
};
const STATUS_COLORS: Record<ChecklistStatus, string> = {
  pendente_entrada: '#D97706',
  em_uso:           '#16A34A',
  pendente_saida:   '#2563EB',
  encerrado:        '#94A3B8',
};

export default function VeiculoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentUser } = useAuthStore();

  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [condutores, setCondutores] = useState<AppUser[]>([]);
  const [buscaCondutor, setBuscaCondutor] = useState('');
  const [erroCondutores, setErroCondutores] = useState<string | null>(null);
  const [modalVincular, setModalVincular] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [carregandoCondutores, setCarregandoCondutores] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (currentUser?.perfil !== 'gestor') {
        setCarregando(false);
        return undefined;
      }

      let unsubVinculos: (() => void) | undefined;

      (async () => {
        const v = await getVeiculoById(id);
        setVeiculo(v);
        setCarregando(false);
      })();

      unsubVinculos = subscribeToVinculosByVeiculoId(id, setVinculos);

      return () => {
        unsubVinculos?.();
      };
    }, [currentUser?.perfil, id])
  );

  const vinculosAtivos = vinculos.filter((v) => v.status === 'ativo');

  const condutoresDisponiveis = condutores.filter(
    (c) => !vinculosAtivos.some((v) => v.condutorId === c.uid),
  );

  const carregarCondutores = useCallback(async (busca = '') => {
    setCarregandoCondutores(true);
    setErroCondutores(null);
    try {
      const lista = await getCondutoresAtivos({ busca, limite: 30 });
      setCondutores(lista);
    } catch {
      setCondutores([]);
      setErroCondutores('Não foi possível carregar condutores. Tente novamente.');
    } finally {
      setCarregandoCondutores(false);
    }
  }, []);

  useEffect(() => {
    if (!modalVincular) return;

    const timer = setTimeout(() => {
      carregarCondutores(buscaCondutor);
    }, buscaCondutor.trim() ? 350 : 0);

    return () => clearTimeout(timer);
  }, [buscaCondutor, carregarCondutores, modalVincular]);

  const openVincular = () => {
    setBuscaCondutor('');
    setCondutores([]);
    setErroCondutores(null);
    setModalVincular(true);
  };

  const handleVincular = async (condutor: AppUser) => {
    if (!veiculo || !currentUser) return;
    setSalvando(true);
    try {
      await createVinculo({
        condutorId:    condutor.uid,
        condutorNome:  condutor.nome,
        veiculoId:     veiculo.id,
        veiculoFrota:  veiculo.frota,
        veiculoModelo: veiculo.modelo,
        veiculoMarca:  veiculo.marca ?? '',
        veiculoPlaca:  veiculo.placa,
        veiculoTipo:   veiculo.tipo ?? 'carro',
        status:        'ativo',
        gestorId:      currentUser.uid,
      });
      setModalVincular(false);
    } finally {
      setSalvando(false);
    }
  };

  const confirmarVinculo = (condutor: AppUser) => {
    if (!veiculo) return;
    Alert.alert(
      'Vincular condutor',
      `Vincular ${condutor.nome} ao veículo ${veiculo.marca} ${veiculo.modelo} - Frota ${veiculo.frota}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Vincular',
          onPress: () => handleVincular(condutor),
        },
      ],
    );
  };

  const handleDesvincular = (v: Vinculo) => {
    Alert.alert(
      'Desvincular condutor',
      `Remover ${v.condutorNome} deste veículo?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desvincular',
          style: 'destructive',
          onPress: async () => {
            await encerrarVinculo(v.id);
          },
        },
      ]
    );
  };

  if (carregando || !veiculo) {
    if (currentUser?.perfil !== 'gestor') {
      return <Redirect href="/(tabs)" />;
    }

    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator style={{ flex: 1 }} color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text variant="titleMedium" style={styles.headerTitle}>Detalhe do veículo</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Info do veículo */}
        <Surface style={styles.card} elevation={1}>
          <View style={styles.veiculoHeader}>
            <View style={[styles.tipoBadge, veiculo.tipo === 'moto' && styles.tipoBadgeMoto]}>
              <Ionicons
                name={veiculo.tipo === 'moto' ? 'bicycle-outline' : 'car-outline'}
                size={14}
                color={veiculo.tipo === 'moto' ? '#7C3AED' : Colors.primary}
              />
              <Text style={[styles.tipoBadgeText, veiculo.tipo === 'moto' && { color: '#7C3AED' }]}>
                {veiculo.tipo === 'moto' ? 'Moto' : 'Carro'}
              </Text>
            </View>
            <View style={styles.frotaBadge}>
              <Text style={styles.frotaText}>Frota {veiculo.frota}</Text>
            </View>
          </View>

          <Text variant="titleMedium" style={styles.veiculoNome}>
            {veiculo.marca} {veiculo.modelo}
          </Text>
          <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>
            {veiculo.ano}{veiculo.placa ? ` · ${veiculo.placa}` : ''}
            {veiculo.kmAtual ? ` · ${veiculo.kmAtual.toLocaleString('pt-BR')} km` : ''}
          </Text>
          <Text variant="bodySmall" style={{ color: Colors.textSecondary, marginTop: 2 }}>
            {veiculo.departamento}
          </Text>
        </Surface>

        {/* Condutores vinculados */}
        <View style={styles.sectionHeader}>
          <Text variant="titleSmall" style={styles.sectionTitle}>Condutor vinculado</Text>
          <Button
            mode="contained-tonal"
            compact
            icon="account-plus"
            disabled={vinculosAtivos.length > 0}
            onPress={openVincular}
          >
            Vincular
          </Button>
        </View>
        {vinculosAtivos.length > 0 && (
          <Text variant="bodySmall" style={{ color: Colors.textSecondary, marginBottom: 4 }}>
            Desvincule o condutor atual antes de vincular outro.
          </Text>
        )}

        {vinculosAtivos.length === 0 ? (
          <Surface style={styles.emptyCard} elevation={0}>
            <Ionicons name="people-outline" size={36} color={Colors.textHint} />
            <Text variant="bodySmall" style={{ color: Colors.textHint, marginTop: 6 }}>
              Nenhum condutor vinculado
            </Text>
          </Surface>
        ) : (
          vinculosAtivos.map((v) => {
            const st = getStatus(v);
            return (
              <Surface key={v.id} style={styles.vinculoCard} elevation={1}>
                <View style={styles.vinculoRow}>
                  <Ionicons name="person-circle-outline" size={36} color={Colors.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium" style={{ fontWeight: '600', color: Colors.textPrimary }}>
                      {v.condutorNome}
                    </Text>
                    <View style={styles.statusRow}>
                      <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[st] }]} />
                      <Text variant="bodySmall" style={{ color: STATUS_COLORS[st] }}>
                        {STATUS_LABELS[st]}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => handleDesvincular(v)} hitSlop={8}>
                    <Ionicons name="person-remove-outline" size={20} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              </Surface>
            );
          })
        )}

        {/* Vínculos inativos com checklist de saída pendente — gestor pode fazer no lugar */}
        {vinculos.filter((v) => v.status === 'inativo' && !v.checklistSaidaId).map((v) => (
          <Surface key={v.id} style={[styles.vinculoCard, { borderLeftWidth: 3, borderLeftColor: '#D97706' }]} elevation={1}>
            <View style={styles.vinculoRow}>
              <Ionicons name="person-circle-outline" size={36} color={Colors.textHint} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium" style={{ fontWeight: '600', color: Colors.textSecondary }}>
                  {v.condutorNome}
                </Text>
                <Text variant="bodySmall" style={{ color: '#D97706' }}>
                  Checklist de saída pendente
                </Text>
              </View>
              <Button
                compact
                mode="outlined"
                onPress={() => router.push(`/checklist/${v.id}/saida` as any)}
              >
                Fazer saída
              </Button>
            </View>
          </Surface>
        ))}

        {/* Histórico de vínculos encerrados */}
        {vinculos.filter((v) => v.status === 'inativo' && !!v.checklistSaidaId).length > 0 && (
          <>
            <Text variant="labelMedium" style={[styles.sectionTitle, { marginTop: 16, color: Colors.textHint }]}>
              Vínculos encerrados
            </Text>
            {vinculos.filter((v) => v.status === 'inativo' && !!v.checklistSaidaId).map((v) => (
              <Surface key={v.id} style={[styles.vinculoCard, { opacity: 0.6 }]} elevation={0}>
                <View style={styles.vinculoRow}>
                  <Ionicons name="person-circle-outline" size={36} color={Colors.textHint} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium" style={{ color: Colors.textSecondary }}>{v.condutorNome}</Text>
                    <Text variant="bodySmall" style={{ color: Colors.textHint }}>Encerrado</Text>
                  </View>
                </View>
              </Surface>
            ))}
          </>
        )}
      </ScrollView>

      {/* Modal: selecionar condutor */}
      <BottomSheet
        visible={modalVincular}
        onDismiss={() => setModalVincular(false)}
        maxHeight="70%"
      >
        <Text variant="titleMedium" style={styles.modalTitle}>Selecionar condutor</Text>
        <Divider style={{ marginBottom: 12 }} />

        <TextInput
          mode="outlined"
          dense
          value={buscaCondutor}
          onChangeText={setBuscaCondutor}
          placeholder="Buscar por nome ou departamento"
          left={<TextInput.Icon icon="magnify" />}
          right={
            buscaCondutor
              ? <TextInput.Icon icon="close" onPress={() => setBuscaCondutor('')} />
              : undefined
          }
          style={styles.searchInput}
        />

        {carregandoCondutores ? (
          <SkeletonCondutorList count={4} />
        ) : erroCondutores ? (
          <View style={styles.emptyModal}>
            <Text variant="bodyMedium" style={{ color: Colors.textHint, textAlign: 'center' }}>
              {erroCondutores}
            </Text>
            <Button
              mode="outlined"
              compact
              onPress={() => carregarCondutores(buscaCondutor)}
              style={{ marginTop: 12 }}
            >
              Tentar novamente
            </Button>
          </View>
        ) : condutoresDisponiveis.length === 0 ? (
          <View style={styles.emptyModal}>
            <Text variant="bodyMedium" style={{ color: Colors.textHint }}>
              {buscaCondutor.trim()
                ? 'Nenhum condutor encontrado'
                : 'Nenhum condutor disponível'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={condutoresDisponiveis}
            keyExtractor={(c) => c.uid}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.condutorItem}
                onPress={() => confirmarVinculo(item)}
                disabled={salvando}
              >
                <Ionicons name="person-circle-outline" size={32} color={Colors.textSecondary} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text variant="bodyMedium" style={{ fontWeight: '600', color: Colors.textPrimary }}>
                    {item.nome}
                  </Text>
                  <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>
                    {item.departamento}
                  </Text>
                </View>
                {salvando && <ActivityIndicator size="small" color={Colors.primary} />}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <Divider />}
          />
        )}

        <Button
          mode="outlined"
          onPress={() => setModalVincular(false)}
          style={{ marginTop: 12 }}
        >
          Fechar
        </Button>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontWeight: '700', color: Colors.textPrimary },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  card: { borderRadius: 12, padding: 14, backgroundColor: Colors.card, gap: 6 },
  veiculoHeader: { flexDirection: 'row', gap: 8, marginBottom: 4 },
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  sectionTitle: { fontWeight: '700', color: Colors.textPrimary },
  emptyCard: {
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  vinculoCard: { borderRadius: 12, padding: 12, backgroundColor: Colors.card },
  vinculoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  modalTitle: { fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  searchInput: { backgroundColor: Colors.card, marginBottom: 8 },
  emptyModal: { padding: 24, alignItems: 'center' },
  condutorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
});
