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

const MAX_FOTOS = 5;

export default function Etapa3() {
  const router = useRouter();
  const { servicosSelecionados, descricao: storedDesc, fotos: storedFotos, setDescricao, setFotos } =
    useNovaOSStore();

  const [desc, setDesc] = useState(storedDesc);
  const [fotos, setFotosLocal] = useState<string[]>(storedFotos);

  const addFotos = async () => {
    if (Platform.OS === 'web') {
      if (fotos.length < MAX_FOTOS) {
        setFotosLocal((prev) => [
          ...prev,
          `https://placehold.co/400x300/e2e8f0/94a3b8?text=Foto+${prev.length + 1}`,
        ]);
      }
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const remaining = MAX_FOTOS - fotos.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.7,
    });

    if (!result.canceled && result.assets.length > 0) {
      const uris = result.assets.map((a) => a.uri);
      setFotosLocal((prev) => [...prev, ...uris].slice(0, MAX_FOTOS));
    }
  };

  const removePhoto = (index: number) => {
    setFotosLocal((prev) => prev.filter((_, i) => i !== index));
  };

  const onNext = () => {
    setDescricao(desc);
    setFotos(fotos);
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

        {/* Fotos */}
        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Text variant="labelLarge" style={styles.label}>
              Fotos do problema (opcional)
            </Text>
            <Text variant="labelSmall" style={styles.fotosCounter}>
              {fotos.length}/{MAX_FOTOS}
            </Text>
          </View>

          {fotos.length > 0 && (
            <View style={styles.photoGrid}>
              {fotos.map((uri, i) => (
                <View key={i} style={styles.photoThumbWrapper}>
                  <Image source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
                  <TouchableOpacity style={styles.removeBtn} onPress={() => removePhoto(i)}>
                    <Ionicons name="close-circle" size={22} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {fotos.length < MAX_FOTOS && (
            <TouchableOpacity style={styles.addPhotoBtn} onPress={addFotos}>
              <Ionicons name="camera-outline" size={24} color={Colors.primary} />
              <Text style={styles.addPhotoText}>
                {fotos.length === 0 ? 'Adicionar fotos' : 'Adicionar mais'}
              </Text>
            </TouchableOpacity>
          )}
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
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { color: Colors.textPrimary, fontWeight: '600' },
  fotosCounter: { color: Colors.textHint },
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
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  photoThumbWrapper: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'visible',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    backgroundColor: Colors.border,
  },
  removeBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    paddingVertical: 14,
    backgroundColor: '#F0FDF4',
  },
  addPhotoText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  btn: { marginTop: 8, borderRadius: 10 },
  btnContent: { paddingVertical: 4 },
});
