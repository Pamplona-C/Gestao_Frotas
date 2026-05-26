import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Surface, Text } from 'react-native-paper';
import { CHECKLIST_ANGULO_LABELS } from '../../constants/checklistAngulos';
import { Colors } from '../../constants/colors';
import { getChecklistById } from '../../services/checklist.service';
import { createOS } from '../../services/os.service';
import { getVinculoById } from '../../services/vinculo.service';
import { useAuthStore } from '../../store/auth.store';
import { Checklist, Vinculo } from '../../types';

function formatDate(value?: string) {
  if (!value) return 'Sem data';
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 'Sem data';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

function photoLabel(key: string) {
  return CHECKLIST_ANGULO_LABELS[key as keyof typeof CHECKLIST_ANGULO_LABELS] ?? key;
}

export default function ChecklistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentUser } = useAuthStore();
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [vinculo, setVinculo] = useState<Vinculo | null>(null);
  const [loading, setLoading] = useState(true);
  const [criandoOS, setCriandoOS] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      async function load() {
        setLoading(true);
        const found = await getChecklistById(id);
        const foundVinculo = found ? await getVinculoById(found.vinculoId) : null;
        if (!mounted) return;
        setChecklist(found);
        setVinculo(foundVinculo);
        setLoading(false);
      }
      load();
      return () => { mounted = false; };
    }, [id]),
  );

  const canCreateOS = currentUser?.perfil === 'gestor' && checklist?.observacoes?.trim() && vinculo;

  const handleCriarOS = () => {
    if (!checklist || !vinculo || !currentUser || !canCreateOS) return;
    Alert.alert(
      'Criar OS a partir do checklist',
      'A OS será criada com a observação do checklist como descrição inicial.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Criar OS',
          onPress: async () => {
            setCriandoOS(true);
            try {
              const novaOS = await createOS({
                veiculoId:            vinculo.veiculoId,
                origemChecklistId:    checklist.id,
                origemVinculoId:      vinculo.id,
                veiculoMarca:         vinculo.veiculoMarca,
                veiculoModelo:        vinculo.veiculoModelo,
                veiculoTipo:          vinculo.veiculoTipo,
                placa:                vinculo.veiculoPlaca,
                frota:                vinculo.veiculoFrota,
                condutorId:           vinculo.condutorId,
                condutorNome:         vinculo.condutorNome,
                descricao:            checklist.observacoes?.trim(),
                gestorId:             currentUser.uid,
                gestorNome:           currentUser.nome,
                gestorPhotoURL:       currentUser.photoURL ?? null,
                gestorDepartamento:   currentUser.departamento,
              });
              router.replace(`/os/${novaOS.id}` as any);
            } catch {
              Alert.alert('Erro', 'Não foi possível criar a OS a partir deste checklist.');
            } finally {
              setCriandoOS(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator style={{ flex: 1 }} color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!checklist) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text variant="titleMedium" style={styles.headerTitle}>Checklist</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={48} color={Colors.textHint} />
          <Text style={styles.emptyText}>Checklist não encontrado</Text>
        </View>
      </SafeAreaView>
    );
  }

  const fotos = Object.entries(checklist.fotos ?? {});
  const tipoLabel = checklist.tipo === 'entrada' ? 'Entrada' : 'Saída';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text variant="titleMedium" style={styles.headerTitle}>Detalhe do checklist</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Surface style={styles.summaryCard} elevation={1}>
          <View style={styles.summaryTop}>
            <View style={[
              styles.typeBadge,
              checklist.tipo === 'saida' && styles.typeBadgeExit,
            ]}>
              <Ionicons
                name={checklist.tipo === 'entrada' ? 'log-in-outline' : 'log-out-outline'}
                size={16}
                color={checklist.tipo === 'entrada' ? Colors.primary : '#2563EB'}
              />
              <Text style={[
                styles.typeText,
                checklist.tipo === 'saida' && styles.typeTextExit,
              ]}>
                {tipoLabel}
              </Text>
            </View>
            <Text style={styles.dateText}>{formatDate(checklist.completadoEm)}</Text>
          </View>

          <Text variant="titleMedium" style={styles.vehicleName}>
            {vinculo ? `${vinculo.veiculoMarca} ${vinculo.veiculoModelo}` : 'Veículo não encontrado'}
          </Text>
          <Text variant="bodySmall" style={styles.metaText}>
            {vinculo ? `Frota ${vinculo.veiculoFrota}${vinculo.veiculoPlaca ? ` · ${vinculo.veiculoPlaca}` : ''}` : checklist.veiculoId}
          </Text>
          <Text variant="bodySmall" style={styles.metaText}>
            Condutor: {vinculo?.condutorNome ?? checklist.condutorId}
          </Text>
          {vinculo ? (
            <Text variant="bodySmall" style={styles.metaText}>
              Vínculo: {formatDate(vinculo.criadoEm)}{vinculo.encerradoEm ? ` até ${formatDate(vinculo.encerradoEm)}` : ''}
            </Text>
          ) : null}
        </Surface>

        <Text variant="titleSmall" style={styles.sectionTitle}>Observações</Text>
        <Surface style={styles.observationCard} elevation={0}>
          {checklist.observacoes?.trim() ? (
            <Text style={styles.observationText}>{checklist.observacoes.trim()}</Text>
          ) : (
            <Text style={styles.noObservationText}>Nenhuma observação registrada.</Text>
          )}
        </Surface>

        {canCreateOS ? (
          <Button
            mode="contained"
            icon="wrench-outline"
            loading={criandoOS}
            disabled={criandoOS}
            onPress={handleCriarOS}
            style={styles.createButton}
            contentStyle={{ paddingVertical: 5 }}
          >
            Criar OS
          </Button>
        ) : null}

        <View style={styles.sectionRow}>
          <Text variant="titleSmall" style={styles.sectionTitle}>Fotos</Text>
          <Text variant="bodySmall" style={styles.photoCount}>{fotos.length} imagens</Text>
        </View>

        <View style={styles.photoGrid}>
          {fotos.map(([angulo, url]) => (
            <TouchableOpacity key={angulo} onPress={() => setFotoAmpliada(url)} activeOpacity={0.85}>
              <Surface style={styles.photoCard} elevation={1}>
                <Image source={{ uri: url }} style={styles.photo} contentFit="cover" />
                <View style={styles.photoFooter}>
                  <Text style={styles.photoText} numberOfLines={2}>{photoLabel(angulo)}</Text>
                  <Ionicons name="expand-outline" size={16} color={Colors.textHint} />
                </View>
              </Surface>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Modal visible={!!fotoAmpliada} transparent animationType="fade" statusBarTranslucent>
        <StatusBar hidden />
        <View style={styles.modalBg}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setFotoAmpliada(null)} hitSlop={12}>
            <Ionicons name="close-circle" size={36} color="#fff" />
          </TouchableOpacity>
          {fotoAmpliada && (
            <Image
              source={{ uri: fotoAmpliada }}
              style={styles.modalPhoto}
              contentFit="contain"
            />
          )}
        </View>
      </Modal>
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
  headerTitle: { color: Colors.textPrimary, fontWeight: '700' },
  content: { padding: 20, paddingBottom: 36 },
  summaryCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 14,
    marginBottom: 18,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 7,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  typeBadgeExit: { backgroundColor: '#EFF6FF' },
  typeText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  typeTextExit: { color: '#2563EB' },
  dateText: { color: Colors.textHint, fontSize: 12 },
  vehicleName: { color: Colors.textPrimary, fontWeight: '700', marginBottom: 4 },
  metaText: { color: Colors.textSecondary, marginTop: 2 },
  sectionTitle: { color: Colors.textPrimary, fontWeight: '700', marginBottom: 10 },
  observationCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
  },
  observationText: { color: Colors.textPrimary, lineHeight: 20 },
  noObservationText: { color: Colors.textHint, fontStyle: 'italic' },
  createButton: { borderRadius: 9, marginBottom: 20 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  photoCount: { color: Colors.textHint, marginBottom: 10 },
  photoGrid: { gap: 12 },
  photoCard: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  photo: { width: '100%', height: 220, backgroundColor: Colors.border },
  photoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  photoText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700', flex: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  modalClose: { position: 'absolute', top: 52, right: 20, zIndex: 10 },
  modalPhoto: { width: '100%', height: '80%' },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  emptyText: { color: Colors.textHint, textAlign: 'center' },
});
