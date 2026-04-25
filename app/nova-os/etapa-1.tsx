import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, TextInput, Button, Surface } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { StepperHeader } from '../../components/StepperHeader';
import { SemInternet } from '../../components/SemInternet';
import { CidadeAutocomplete } from '../../components/CidadeAutocomplete';
import { useNovaOSStore } from '../../store/novaOS.store';
import { useConectividade } from '../../hooks/useConectividade';
import { getVeiculoByPlaca } from '../../services/veiculo.service';
import { Veiculo } from '../../types';
import { Colors } from '../../constants/colors';

const schema = z.object({
  placa: z
    .string()
    .min(7, 'Placa inválida')
    .regex(/^[A-Z]{3}[-]?\d{4}$|^[A-Z]{3}\d[A-Z]\d{2}$/i, 'Formato: ABC-1234 ou ABC1D23'),
  hodometro: z.string().min(1, 'Informe o hodômetro').regex(/^\d+$/, 'Apenas números'),
  cidade: z.string().min(2, 'Selecione uma cidade'),
});
type FormData = z.infer<typeof schema>;

export default function Etapa1() {
  const router = useRouter();
  const online = useConectividade();
  const { placa: storedPlaca, hodometro: storedHod, cidade: storedCidade, setPlaca, setHodometro, setCidade } = useNovaOSStore();

  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { placa: storedPlaca, hodometro: storedHod, cidade: storedCidade },
  });

  const placaWatch = watch('placa');
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);

  useEffect(() => {
    if (!placaWatch || placaWatch.length < 7) { setVeiculo(null); return; }
    let mounted = true;
    getVeiculoByPlaca(placaWatch).then((v) => { if (mounted) setVeiculo(v); });
    return () => { mounted = false; };
  }, [placaWatch]);

  const onNext = (data: FormData) => {
    if (veiculo && !veiculo.ativo) return;
    setPlaca(data.placa.toUpperCase());
    setHodometro(data.hodometro);
    setCidade(data.cidade);
    router.push('/nova-os/etapa-2');
  };

  if (!online) return <SemInternet />;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Back + stepper */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text variant="titleMedium" style={styles.topTitle}>Nova OS</Text>
          <View style={{ width: 24 }} />
        </View>
        <StepperHeader currentStep={1} />

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text variant="headlineSmall" style={styles.heading}>Identificação do veículo</Text>
          <Text variant="bodyMedium" style={styles.sub}>Informe os dados do veículo</Text>

          {/* Placa */}
          <View style={styles.field}>
            <Controller
              control={control}
              name="placa"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextInput
                  label="Placa do veículo"
                  mode="outlined"
                  value={value}
                  onChangeText={(t) => onChange(t.toUpperCase())}
                  onBlur={onBlur}
                  autoCapitalize="characters"
                  placeholder="ABC-1234"
                  error={!!errors.placa}
                />
              )}
            />
            {errors.placa && <Text style={styles.err}>{errors.placa.message}</Text>}
            {veiculo && veiculo.ativo ? (
              <Surface style={styles.veiculoInfo} elevation={0}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.accent} />
                <Text style={styles.veiculoText}>
                  {veiculo.modelo} · {veiculo.ano} · Frota {veiculo.frota}
                </Text>
              </Surface>
            ) : veiculo && !veiculo.ativo ? (
              <Surface style={styles.veiculoInativo} elevation={0}>
                <Ionicons name="ban-outline" size={16} color="#DC2626" />
                <Text style={styles.veiculoInativoText}>
                  Veículo inativo — não é possível abrir OS
                </Text>
              </Surface>
            ) : placaWatch && placaWatch.length >= 7 ? (
              <View style={styles.veiculoWarn}>
                <Ionicons name="alert-circle-outline" size={14} color="#D97706" />
                <Text style={styles.veiculoWarnText}>Veículo não encontrado na frota</Text>
              </View>
            ) : null}
          </View>

          {/* Hodômetro */}
          <View style={styles.field}>
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
                  right={<TextInput.Affix text="km" />}
                />
              )}
            />
            {errors.hodometro && <Text style={styles.err}>{errors.hodometro.message}</Text>}
          </View>

          {/* Cidade autocomplete */}
          <View style={styles.field}>
            <Controller
              control={control}
              name="cidade"
              render={({ field: { value, onChange } }) => (
                <CidadeAutocomplete
                  label="Cidade do atendimento"
                  value={value}
                  onChange={(c) => { onChange(c); setCidade(c); }}
                  error={!!errors.cidade}
                  errorMessage={errors.cidade?.message}
                />
              )}
            />
          </View>

          <Button
            mode="contained"
            style={styles.btn}
            contentStyle={styles.btnContent}
            onPress={handleSubmit(onNext)}
          >
            Continuar
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scroll: { padding: 20, gap: 4 },
  heading: { fontWeight: '700', color: Colors.textPrimary },
  sub: { color: Colors.textSecondary, marginBottom: 8 },
  field: { marginBottom: 12 },
  err: { fontSize: 12, color: '#DC2626', marginLeft: 4, marginTop: 2 },
  veiculoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
  },
  veiculoText: { color: Colors.primary, fontSize: 13, fontWeight: '500' },
  veiculoWarn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  veiculoWarnText: { color: '#D97706', fontSize: 12 },
  veiculoInativo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  veiculoInativoText: { color: '#DC2626', fontSize: 13, fontWeight: '500' },
  btn: { marginTop: 24, borderRadius: 10 },
  btnContent: { paddingVertical: 4 },
});
