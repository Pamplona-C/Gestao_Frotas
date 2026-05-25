import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  TextInput as RNTextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Text, Button, Surface, ProgressBar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Vinculo } from '../../../types';
import { getVinculoById } from '../../../services/vinculo.service';
import { createChecklist, skipChecklistDev } from '../../../services/checklist.service';
import {
  getAngulosByTipo,
  CHECKLIST_ANGULO_LABELS,
} from '../../../constants/checklistAngulos';
import { useAuthStore } from '../../../store/auth.store';
import { Colors } from '../../../constants/colors';

export default function ChecklistScreen() {
  const { vinculoId, tipo } = useLocalSearchParams<{ vinculoId: string; tipo: 'entrada' | 'saida' }>();
  const router = useRouter();
  const { currentUser } = useAuthStore();

  const [vinculo, setVinculo] = useState<Vinculo | null>(null);
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const [observacoes, setObservacoes] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!vinculoId) return;
      getVinculoById(vinculoId).then((v) => { if (v) setVinculo(v); });
    }, [vinculoId])
  );

  const angulos = vinculo ? getAngulosByTipo(vinculo.veiculoTipo) : [];
  const total = angulos.length;
  const feitos = Object.keys(fotos).length;
  const podeConcluir = feitos === total && total > 0;

  const tirarFoto = async (angulo: string) => {
    const escolherFonte = () =>
      new Promise<'camera' | 'galeria' | null>((resolve) => {
        Alert.alert(
          'Adicionar foto',
          'Como deseja adicionar a foto?',
          [
            { text: 'Câmera', onPress: () => resolve('camera') },
            { text: 'Galeria', onPress: () => resolve('galeria') },
            { text: 'Cancelar', style: 'cancel', onPress: () => resolve(null) },
          ],
        );
      });

    const fonte = await escolherFonte();
    if (!fonte) return;

    if (fonte === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Permita o acesso à câmera nas configurações.');
        return;
      }
      try {
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: 'images',
          quality: 0.7,
          allowsEditing: false,
        });
        if (!result.canceled && result.assets[0]?.uri) {
          setFotos((prev) => ({ ...prev, [angulo]: result.assets[0].uri }));
        }
      } catch {
        Alert.alert('Câmera indisponível', 'Use a galeria para selecionar uma foto.');
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Permita o acesso à galeria nas configurações.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 0.7,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setFotos((prev) => ({ ...prev, [angulo]: result.assets[0].uri }));
      }
    }
  };

  const handleConcluir = async () => {
    if (!vinculo || !currentUser || !podeConcluir) return;

    Alert.alert(
      `Confirmar checklist de ${tipo}`,
      'As fotos serão enviadas e este checklist não poderá ser alterado.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            setEnviando(true);
            try {
              await createChecklist(
                {
                  tipo,
                  vinculoId:   vinculo.id,
                  condutorId:  currentUser.uid,
                  veiculoId:   vinculo.veiculoId,
                  veiculoTipo: vinculo.veiculoTipo,
                  fotos:       {},
                  observacoes: observacoes.trim() || undefined,
                  completadoEm: new Date().toISOString(),
                },
                fotos,
                setProgresso,
              );
              router.back();
            } catch (e) {
              Alert.alert('Erro', 'Não foi possível enviar o checklist. Tente novamente.');
            } finally {
              setEnviando(false);
            }
          },
        },
      ]
    );
  };

  if (!vinculo) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator style={{ flex: 1 }} color={Colors.primary} />
      </SafeAreaView>
    );
  }

  const isTipoEntrada = tipo === 'entrada';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text variant="titleSmall" style={{ fontWeight: '700', color: Colors.textPrimary }}>
              Checklist de {isTipoEntrada ? 'entrada' : 'saída'}
            </Text>
            <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>
              {vinculo.veiculoMarca} {vinculo.veiculoModelo} · Frota {vinculo.veiculoFrota}
            </Text>
          </View>
        </View>

        {/* Progresso */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${total > 0 ? (feitos / total) * 100 : 0}%` }]} />
        </View>
        <Text style={styles.progressText}>{feitos} de {total} fotos</Text>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Grade de ângulos */}
          <View style={styles.grid}>
            {angulos.map((angulo) => {
              const uri = fotos[angulo];
              return (
                <TouchableOpacity
                  key={angulo}
                  style={[styles.slotCard, uri && styles.slotDone]}
                  onPress={() => tirarFoto(angulo)}
                  disabled={enviando}
                >
                  {uri ? (
                    <>
                      <Image source={{ uri }} style={styles.thumbnail} />
                      <View style={styles.doneOverlay}>
                        <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
                      </View>
                    </>
                  ) : (
                    <View style={styles.slotEmpty}>
                      <Ionicons name="camera-outline" size={26} color={Colors.textHint} />
                    </View>
                  )}
                  <Text
                    style={[styles.slotLabel, uri && { color: Colors.textPrimary }]}
                    numberOfLines={2}
                  >
                    {CHECKLIST_ANGULO_LABELS[angulo as keyof typeof CHECKLIST_ANGULO_LABELS] ?? angulo}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Observações */}
          <Text variant="labelMedium" style={styles.obsLabel}>Observações (opcional)</Text>
          <Surface style={styles.obsCard} elevation={0}>
            <RNTextInput
              style={styles.obsInput}
              placeholder="Descreva o estado do veículo, avarias, etc."
              placeholderTextColor={Colors.textHint}
              multiline
              numberOfLines={3}
              value={observacoes}
              onChangeText={setObservacoes}
              editable={!enviando}
            />
          </Surface>

          {/* Botão concluir */}
          {enviando ? (
            <View style={styles.enviandoBox}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={{ color: Colors.textSecondary, marginLeft: 10 }}>
                Enviando fotos… {progresso}%
              </Text>
            </View>
          ) : (
            <Button
              mode="contained"
              icon="check"
              disabled={!podeConcluir}
              onPress={handleConcluir}
              style={styles.btnConcluir}
              contentStyle={{ paddingVertical: 6 }}
            >
              Concluir checklist
            </Button>
          )}

          {!podeConcluir && feitos < total && (
            <Text style={styles.hintText}>
              Fotografe todos os {total} ângulos para concluir
            </Text>
          )}

          {__DEV__ && (
            <Button
              mode="outlined"
              icon="flash"
              onPress={async () => {
                if (!vinculo || !currentUser) return;
                setEnviando(true);
                try {
                  await skipChecklistDev(vinculo.id, tipo, currentUser.uid, vinculo.veiculoId, vinculo.veiculoTipo);
                  router.back();
                } finally {
                  setEnviando(false);
                }
              }}
              disabled={enviando}
              style={styles.btnDev}
              textColor="#D97706"
            >
              Pular checklist [DEV]
            </Button>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const SLOT_SIZE = 160;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.border,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  progressText: {
    textAlign: 'right',
    marginHorizontal: 20,
    marginTop: 4,
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  content: { padding: 16, paddingBottom: 60 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  slotCard: {
    width: SLOT_SIZE,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    paddingBottom: 8,
  },
  slotDone: {
    borderStyle: 'solid',
    borderColor: '#16A34A',
  },
  slotEmpty: {
    width: '100%',
    height: SLOT_SIZE * 0.65,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  thumbnail: {
    width: '100%',
    height: SLOT_SIZE * 0.65,
  },
  doneOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: Colors.card,
    borderRadius: 12,
  },
  slotLabel: {
    fontSize: 11,
    color: Colors.textHint,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 6,
  },
  obsLabel: { color: Colors.textSecondary, marginBottom: 6 },
  obsCard: {
    borderRadius: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  obsInput: {
    padding: 12,
    fontSize: 14,
    color: Colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  btnConcluir: { backgroundColor: Colors.primary, borderRadius: 10 },
  btnDev: { borderRadius: 10, marginTop: 10, borderColor: '#D97706' },
  enviandoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  hintText: {
    textAlign: 'center',
    color: Colors.textHint,
    fontSize: 12,
    marginTop: 8,
  },
});
