import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  TextInput as RNTextInput,
} from 'react-native';
import { Text, Button, Surface } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { StepperHeader } from '../../components/StepperHeader';
import { useNovaOSStore } from '../../store/novaOS.store';
import { Colors } from '../../constants/colors';

export default function Etapa3() {
  const router = useRouter();
  const {
    servicosSelecionados,
    descricao: storedDesc,
    foto: storedFoto,
    setDescricao,
    setFoto,
  } = useNovaOSStore();

  const [desc, setDesc] = useState(storedDesc);
  const [foto, setFotoLocal] = useState<string | null>(storedFoto);

  const pickImage = async () => {
    if (Platform.OS === 'web') {
      setFotoLocal('https://placehold.co/400x300/e2e8f0/94a3b8?text=Foto');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setFotoLocal(result.assets[0].uri);
    }
  };

  const onNext = () => {
    setDescricao(desc);
    setFoto(foto);
    router.push('/nova-os/etapa-4');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text variant="titleMedium" style={styles.topTitle}>Nova OS</Text>
        <View style={{ width: 24 }} />
      </View>
      <StepperHeader currentStep={3} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text variant="headlineSmall" style={styles.heading}>Descrição do problema</Text>
        <Text variant="bodyMedium" style={styles.sub}>Detalhe o que está ocorrendo com o veículo</Text>

        {/* Serviços selecionados */}
        {servicosSelecionados.length > 0 && (
          <Surface style={styles.servList} elevation={0}>
            <Text variant="labelMedium" style={styles.servTitle}>Serviços selecionados</Text>
            {servicosSelecionados.map((s) => (
              <View key={s} style={styles.servRow}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.accent} />
                <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>{s}</Text>
              </View>
            ))}
          </Surface>
        )}

        {/* Descrição */}
        <View style={styles.field}>
          <Text variant="labelLarge" style={styles.label}>Descrição detalhada</Text>
          <Surface style={styles.textAreaSurface} elevation={1}>
            <RNTextInput
              value={desc}
              onChangeText={setDesc}
              multiline
              placeholder="Descreva o problema: quando começou, em que situação ocorre, sons ou comportamentos anormais…"
              placeholderTextColor={Colors.textHint}
              style={styles.textInput}
              textAlignVertical="top"
            />
          </Surface>
        </View>

        {/* Foto */}
        <View style={styles.field}>
          <Text variant="labelLarge" style={styles.label}>Foto do problema (opcional)</Text>
          <TouchableOpacity style={styles.photoBox} onPress={pickImage}>
            {foto ? (
              <View style={{ width: '100%' }}>
                <Image source={{ uri: foto }} style={styles.photo} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.removePhoto}
                  onPress={() => setFotoLocal(null)}
                >
                  <Ionicons name="close-circle" size={28} color="#DC2626" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="camera-outline" size={32} color={Colors.textHint} />
                <Text variant="bodySmall" style={{ color: Colors.textHint, marginTop: 4 }}>
                  Toque para adicionar foto
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <Button
          mode="contained"
          style={styles.btn}
          contentStyle={styles.btnContent}
          onPress={onNext}
        >
          Continuar
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  topTitle: { fontWeight: '600', color: Colors.textPrimary },
  scroll: { padding: 20 },
  heading: { fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  sub: { color: Colors.textSecondary, marginBottom: 12 },
  servList: {
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#F0FDF4',
    marginBottom: 16,
    gap: 4,
  },
  servTitle: { color: Colors.primary, marginBottom: 4, fontWeight: '600' },
  servRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  field: { marginBottom: 16 },
  label: { color: Colors.textPrimary, marginBottom: 8, fontWeight: '600' },
  textAreaSurface: {
    borderRadius: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  textInput: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 22,
    minHeight: 100,
  },
  photoBox: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
    minHeight: 140,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: { width: '100%', height: 180 },
  removePhoto: { position: 'absolute', top: 8, right: 8 },
  photoPlaceholder: { alignItems: 'center', padding: 24 },
  btn: { marginTop: 8, borderRadius: 10 },
  btnContent: { paddingVertical: 4 },
});
