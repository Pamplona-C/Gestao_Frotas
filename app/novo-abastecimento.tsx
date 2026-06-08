import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { Text, TextInput, Button, Surface, Divider, Portal, Snackbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../store/auth.store';
import { subscribeToVinculosByCondutorId } from '../services/vinculo.service';
import { criarAbastecimento } from '../services/abastecimento.service';
import { Colors } from '../constants/colors';
import { TipoCombustivel, Vinculo } from '../types';
import { BottomSheet } from '../components/BottomSheet';

const COMBUSTIVEIS: { key: TipoCombustivel; label: string }[] = [
  { key: 'gasolina', label: 'Gasolina' },
  { key: 'etanol',   label: 'Etanol' },
  { key: 'diesel',   label: 'Diesel' },
  { key: 'gnv',      label: 'GNV' },
  { key: 'eletrico', label: 'Elétrico' },
];

const schema = z.object({
  hodometro: z.string().min(1, 'Hodômetro obrigatório').refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Valor inválido'),
  tipoCombustivel: z.enum(['gasolina', 'etanol', 'diesel', 'gnv', 'eletrico'] as const, { message: 'Selecione o combustível' }),
  valor: z.string().min(1, 'Valor obrigatório').refine((v) => !isNaN(Number(v.replace(',', '.'))) && Number(v.replace(',', '.')) > 0, 'Valor inválido'),
  litros: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NovoAbastecimentoScreen() {
  const router = useRouter();
  const { currentUser } = useAuthStore();
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [vinculo, setVinculo] = useState<Vinculo | null>(null);
  const [loadingVinculo, setLoadingVinculo] = useState(true);
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [combustivelSheet, setCombustivelSheet] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [snackMsg, setSnackMsg] = useState('');
  const [snackVisible, setSnackVisible] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const tipoCombustivelSelecionado = watch('tipoCombustivel');

  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = subscribeToVinculosByCondutorId(currentUser.uid, (ativos) => {
      const ativos2 = ativos.filter((v) => v.status === 'ativo' && v.checklistEntradaId);
      setVinculos(ativos2);
      if (ativos2.length === 1) setVinculo(ativos2[0]);
      else setVinculo(null);
      setLoadingVinculo(false);
    });
    return unsub;
  }, [currentUser?.uid]);

  async function selecionarFoto() {
    Alert.alert('Foto do cupom', 'Escolha a origem', [
      {
        text: 'Câmera',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) return;
          const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
          if (!result.canceled) setFotoUri(result.assets[0].uri);
        },
      },
      {
        text: 'Galeria',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return;
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
          if (!result.canceled) setFotoUri(result.assets[0].uri);
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function onSubmit(data: FormData) {
    if (!currentUser || !vinculo) return;
    setSalvando(true);
    setProgresso(null);
    try {
      await criarAbastecimento(
        {
          condutorId:      currentUser.uid,
          condutorNome:    currentUser.nome,
          veiculoId:       vinculo.veiculoId,
          veiculoPlaca:    vinculo.veiculoPlaca ?? '',
          veiculoFrota:    vinculo.veiculoFrota,
          hodometro:       Number(data.hodometro),
          tipoCombustivel: data.tipoCombustivel,
          litros:          data.litros ? Number(data.litros.replace(',', '.')) : undefined,
          valor:           Number(data.valor.replace(',', '.')),
        },
        fotoUri ?? undefined,
        (pct) => setProgresso(pct),
      );
      setSnackMsg('Abastecimento registrado!');
      setSnackVisible(true);
      setTimeout(() => router.back(), 1500);
    } catch (err) {
      console.error('[NovoAbastecimento] criarAbastecimento falhou:', err);
      setSnackMsg('Erro ao registrar. Tente novamente.');
      setSnackVisible(true);
    } finally {
      setSalvando(false);
      setProgresso(null);
    }
  }

  function veiculoLabel(v: Vinculo) {
    return `${v.veiculoMarca} ${v.veiculoModelo}${v.veiculoPlaca ? ` · ${v.veiculoPlaca}` : ` · Frota ${v.veiculoFrota}`}`;
  }

  const semVinculo = !loadingVinculo && vinculos.length === 0;
  const precisaEscolher = !loadingVinculo && vinculos.length > 1 && !vinculo;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text variant="titleMedium" style={styles.topTitle}>Registrar abastecimento</Text>
          <View style={{ width: 24 }} />
        </View>

        {loadingVinculo ? (
          <View style={styles.centered}>
            <Text style={{ color: Colors.textSecondary }}>Carregando veículo...</Text>
          </View>
        ) : semVinculo ? (
          <View style={styles.centered}>
            <Ionicons name="car-outline" size={48} color={Colors.textHint} />
            <Text variant="bodyMedium" style={styles.semVeiculo}>
              Nenhum veículo vinculado ativo.{'\n'}Solicite um vínculo ao gestor.
            </Text>
          </View>
        ) : precisaEscolher ? (
          <View style={styles.centered}>
            <Ionicons name="car-outline" size={48} color={Colors.primary} />
            <Text variant="bodyMedium" style={styles.semVeiculo}>
              Você tem {vinculos.length} veículos vinculados.{'\n'}Selecione qual está abastecendo:
            </Text>
            <View style={{ width: '100%', gap: 10, marginTop: 8 }}>
              {vinculos.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={styles.veiculoOpcao}
                  onPress={() => setVinculo(v)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="car-outline" size={20} color={Colors.primary} />
                  <Text style={styles.veiculoOpcaoText}>{veiculoLabel(v)}</Text>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Veículo */}
            <TouchableOpacity
              style={styles.veiculoBadge}
              onPress={() => vinculos.length > 1 && setVinculo(null)}
              activeOpacity={vinculos.length > 1 ? 0.7 : 1}
            >
              <Ionicons name="car-outline" size={18} color={Colors.primary} />
              <Text variant="bodyMedium" style={styles.veiculoText}>{veiculoLabel(vinculo!)}</Text>
              {vinculos.length > 1 && <Ionicons name="swap-horizontal-outline" size={16} color={Colors.accent} />}
            </TouchableOpacity>

            <Surface style={styles.card} elevation={1}>
              <Text variant="titleSmall" style={styles.cardTitle}>Dados do abastecimento</Text>
              <Divider style={styles.divider} />

              {/* Hodômetro */}
              <Field error={errors.hodometro?.message}>
                <Controller
                  control={control}
                  name="hodometro"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <TextInput
                      label="Hodômetro (km)"
                      mode="outlined"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      keyboardType="numeric"
                      error={!!errors.hodometro}
                      style={styles.input}
                    />
                  )}
                />
              </Field>

              {/* Tipo de combustível */}
              <Field error={errors.tipoCombustivel?.message}>
                <TouchableOpacity
                  style={[styles.picker, !!errors.tipoCombustivel && styles.pickerError]}
                  onPress={() => setCombustivelSheet(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerLabel, !tipoCombustivelSelecionado && styles.pickerPlaceholder]}>
                    {tipoCombustivelSelecionado
                      ? COMBUSTIVEIS.find((c) => c.key === tipoCombustivelSelecionado)?.label
                      : 'Tipo de combustível'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </Field>

              {/* Valor */}
              <Field error={errors.valor?.message}>
                <Controller
                  control={control}
                  name="valor"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <TextInput
                      label="Valor (R$)"
                      mode="outlined"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      keyboardType="decimal-pad"
                      error={!!errors.valor}
                      style={styles.input}
                    />
                  )}
                />
              </Field>

              {/* Litros (opcional) */}
              <Controller
                control={control}
                name="litros"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    label="Litros (opcional)"
                    mode="outlined"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType="decimal-pad"
                    style={styles.input}
                  />
                )}
              />
            </Surface>

            {/* Foto do cupom */}
            <Surface style={styles.card} elevation={1}>
              <Text variant="titleSmall" style={styles.cardTitle}>Cupom fiscal</Text>
              <Divider style={styles.divider} />

              {fotoUri ? (
                <View style={styles.fotoContainer}>
                  <Image source={{ uri: fotoUri }} style={styles.fotoPreview} resizeMode="cover" />
                  <TouchableOpacity style={styles.fotoRemover} onPress={() => setFotoUri(null)}>
                    <Ionicons name="close-circle" size={22} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.fotoBotao} onPress={selecionarFoto} activeOpacity={0.7}>
                  <Ionicons name="camera-outline" size={24} color={Colors.textSecondary} />
                  <Text style={styles.fotoBotaoText}>Adicionar foto do cupom</Text>
                </TouchableOpacity>
              )}
            </Surface>

            {progresso !== null && (
              <Text style={styles.progresso}>Enviando foto… {progresso}%</Text>
            )}

            <Button
              mode="contained"
              onPress={handleSubmit(onSubmit)}
              loading={salvando}
              disabled={salvando}
              icon="gas-station"
              style={styles.btn}
              contentStyle={styles.btnContent}
            >
              {salvando ? 'Registrando...' : 'Registrar abastecimento'}
            </Button>
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* Picker de combustível */}
      <BottomSheet
        visible={combustivelSheet}
        onDismiss={() => setCombustivelSheet(false)}
        disableDrag
      >
        <Text variant="titleSmall" style={styles.sheetTitle}>Tipo de combustível</Text>
        {COMBUSTIVEIS.map((c) => {
          const selected = tipoCombustivelSelecionado === c.key;
          return (
            <TouchableOpacity
              key={c.key}
              style={[styles.sheetItem, selected && styles.sheetItemSelected]}
              onPress={() => {
                setValue('tipoCombustivel', c.key, { shouldValidate: true });
                setCombustivelSheet(false);
              }}
            >
              <Text style={[styles.sheetItemText, selected && styles.sheetItemTextSelected]}>
                {c.label}
              </Text>
              {selected && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
            </TouchableOpacity>
          );
        })}
      </BottomSheet>

      <Portal>
        <Snackbar visible={snackVisible} onDismiss={() => setSnackVisible(false)} duration={2500} style={styles.snackbar}>
          {snackMsg}
        </Snackbar>
      </Portal>
    </SafeAreaView>
  );
}

function Field({ error, children }: { error?: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldWrap}>
      {children}
      {error && <Text style={styles.err}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
  },
  topTitle: { fontWeight: '600', color: Colors.textPrimary },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  semVeiculo: { color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  veiculoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primaryLight, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: Colors.primaryBorder,
  },
  veiculoOpcao: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
    marginHorizontal: 20,
  },
  veiculoOpcaoText: { flex: 1, fontSize: 15, color: Colors.textPrimary, fontWeight: '500' },
  veiculoText: { color: Colors.textPrimary, fontWeight: '500', flex: 1 },
  card: { borderRadius: 14, padding: 16, backgroundColor: Colors.card },
  cardTitle: { fontWeight: '700', color: Colors.textPrimary },
  divider: { marginVertical: 12 },
  fieldWrap: { marginBottom: 8 },
  input: { backgroundColor: Colors.card },
  err: { fontSize: 12, color: '#DC2626', marginLeft: 4, marginTop: 2 },
  picker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.border, borderRadius: 4,
    paddingHorizontal: 14, paddingVertical: 14, backgroundColor: Colors.card,
  },
  pickerError: { borderColor: '#DC2626' },
  pickerLabel: { fontSize: 16, color: Colors.textPrimary },
  pickerPlaceholder: { color: Colors.textSecondary },
  fotoContainer: { position: 'relative', alignSelf: 'flex-start' },
  fotoPreview: { width: 120, height: 120, borderRadius: 10 },
  fotoRemover: { position: 'absolute', top: -8, right: -8 },
  fotoBotao: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed',
    borderRadius: 10, padding: 16, justifyContent: 'center',
  },
  fotoBotaoText: { color: Colors.textSecondary, fontSize: 14 },
  progresso: { textAlign: 'center', color: Colors.textSecondary, fontSize: 13 },
  btn: { borderRadius: 10 },
  btnContent: { paddingVertical: 4 },
  snackbar: { backgroundColor: Colors.primary },
  sheetItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sheetItemSelected: { backgroundColor: '#EDF2FB', borderRadius: 8, paddingHorizontal: 8 },
  sheetTitle: { fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  sheetItemText: { fontSize: 16, color: Colors.textPrimary },
  sheetItemTextSelected: { color: Colors.primary, fontWeight: '600' },
});
