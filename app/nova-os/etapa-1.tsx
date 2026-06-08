import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Text, TextInput, Button, Surface } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFocusEffect } from '@react-navigation/native';
import { StepperHeader } from '../../components/StepperHeader';
import { SemInternet } from '../../components/SemInternet';
import { CidadeAutocomplete } from '../../components/CidadeAutocomplete';
import { useNovaOSStore } from '../../store/novaOS.store';
import { useAuthStore } from '../../store/auth.store';
import { useConectividade } from '../../hooks/useConectividade';
import { subscribeToVinculosByCondutorId } from '../../services/vinculo.service';
import { Vinculo } from '../../types';
import { Colors } from '../../constants/colors';

const schema = z.object({
  hodometro: z.string().optional(),
  cidade:    z.string().min(2, 'Selecione uma cidade'),
});
type FormData = z.infer<typeof schema>;

export default function Etapa1() {
  const router = useRouter();
  const online = useConectividade();
  const { currentUser } = useAuthStore();
  const store = useNovaOSStore();

  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [selecionado, setSelecionado] = useState<Vinculo | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!currentUser?.uid) return;
      const unsub = subscribeToVinculosByCondutorId(currentUser.uid, (all) => {
        const disponiveis = all.filter(
          (v) => v.status === 'ativo' && !!v.checklistEntradaId,
        );
        setVinculos(disponiveis);
        setCarregando(false);
        // Re-selecionar se já havia seleção (store preenchido)
        if (store.veiculoId) {
          const match = disponiveis.find((v) => v.veiculoId === store.veiculoId);
          if (match) setSelecionado(match);
        }
      });
      return unsub;
    }, [currentUser?.uid]) // eslint-disable-line react-hooks/exhaustive-deps
  );

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      hodometro: store.hodometro,
      cidade:    store.cidade,
    },
  });

  const isMoto = selecionado?.veiculoTipo === 'moto';

  const onNext = (data: FormData) => {
    if (!selecionado) return;
    if (!isMoto && !data.hodometro) return;

    store.setVeiculoId(selecionado.veiculoId);
    store.setVeiculoTipo(selecionado.veiculoTipo);
    store.setVeiculoMarca(selecionado.veiculoMarca);
    store.setVeiculoModelo(selecionado.veiculoModelo);
    store.setPlaca(selecionado.veiculoPlaca ?? '');
    store.setFrota(selecionado.veiculoFrota);
    store.setHodometro(data.hodometro ?? '');
    store.setCidade(data.cidade);

    router.push('/nova-os/etapa-2');
  };

  if (!online) return <SemInternet />;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
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
          <Text variant="bodyMedium" style={styles.sub}>Selecione o veículo que precisa de atendimento</Text>

          {/* Lista de veículos disponíveis */}
          {carregando ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 24 }} />
          ) : vinculos.length === 0 ? (
            <Surface style={styles.emptyCard} elevation={0}>
              <Ionicons name="car-outline" size={40} color={Colors.textHint} />
              <Text variant="bodyMedium" style={styles.emptyText}>
                Nenhum veículo disponível.{'\n'}Contate o gestor ou faça o checklist de entrada.
              </Text>
            </Surface>
          ) : (
            vinculos.map((v) => {
              const selected = selecionado?.id === v.id;
              return (
                <TouchableOpacity
                  key={v.id}
                  onPress={() => setSelecionado(v)}
                  activeOpacity={0.7}
                >
                  <Surface
                    style={[styles.veiculoCard, selected && styles.veiculoCardSelected]}
                    elevation={selected ? 2 : 1}
                  >
                    <View style={styles.veiculoCardInner}>
                      <View style={[styles.tipoBadge, v.veiculoTipo === 'moto' && styles.tipoBadgeMoto]}>
                        <Ionicons
                          name={v.veiculoTipo === 'moto' ? 'bicycle-outline' : 'car-outline'}
                          size={13}
                          color={v.veiculoTipo === 'moto' ? '#7C3AED' : Colors.primary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyMedium" style={styles.veiculoNome}>
                          {v.veiculoMarca} {v.veiculoModelo}
                        </Text>
                        <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>
                          Frota {v.veiculoFrota}{v.veiculoPlaca ? ` · ${v.veiculoPlaca}` : ''}
                        </Text>
                      </View>
                      {selected && (
                        <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                      )}
                    </View>
                  </Surface>
                </TouchableOpacity>
              );
            })
          )}

          {/* Hodômetro */}
          <View style={styles.field}>
            <Controller
              control={control}
              name="hodometro"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextInput
                  label={isMoto ? 'Hodômetro (km) — opcional' : 'Hodômetro (km)'}
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

          {/* Cidade */}
          <View style={styles.field}>
            <Controller
              control={control}
              name="cidade"
              render={({ field: { value, onChange } }) => (
                <CidadeAutocomplete
                  label="Cidade do atendimento"
                  value={value}
                  onChange={(c) => { onChange(c); store.setCidade(c); }}
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
            disabled={!selecionado || vinculos.length === 0}
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
  safe:      { flex: 1, backgroundColor: Colors.background },
  topBar:    {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  topTitle:  { fontWeight: '600', color: Colors.textPrimary },
  scroll:    { padding: 20, gap: 4 },
  heading:   { fontWeight: '700', color: Colors.textPrimary },
  sub:       { color: Colors.textSecondary, marginBottom: 12 },
  field:     { marginBottom: 12, marginTop: 8 },
  err:       { fontSize: 12, color: '#DC2626', marginLeft: 4, marginTop: 2 },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    backgroundColor: Colors.card,
    padding: 28,
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  emptyText: { color: Colors.textHint, textAlign: 'center', lineHeight: 22 },
  veiculoCard: {
    borderRadius: 12,
    padding: 14,
    backgroundColor: Colors.card,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  veiculoCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#EFF6FF',
  },
  veiculoCardInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tipoBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
  },
  tipoBadgeMoto: { backgroundColor: '#F5F3FF' },
  veiculoNome: { fontWeight: '600', color: Colors.textPrimary },
  btn:        { marginTop: 16, borderRadius: 10 },
  btnContent: { paddingVertical: 4 },
});
