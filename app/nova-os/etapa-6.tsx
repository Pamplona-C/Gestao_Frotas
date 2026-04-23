import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Text, Button, Surface } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StepperHeader } from '../../components/StepperHeader';
import { useNovaOSStore } from '../../store/novaOS.store';
import { useAuthStore } from '../../store/auth.store';
import { createOS } from '../../services/os.service';
import { getVeiculoByPlaca } from '../../services/veiculo.service';
import { Colors } from '../../constants/colors';

export default function Etapa6() {
  const router = useRouter();
  const store = useNovaOSStore();
  const { currentUser } = useAuthStore();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const submittedRef = useRef(false);
  const [osId, setOsId] = useState<string>('…');

  useEffect(() => {
    if (submittedRef.current || !store.placa) return;
    submittedRef.current = true;

    async function submit() {
      // Capturar placa antes do reset para usar na notificação
      const placa = store.placa;
      const veiculo = await getVeiculoByPlaca(placa);
      const novaOS = await createOS({
        placa,
        frota: veiculo?.frota ?? '—',
        condutorId: currentUser?.uid ?? '',
        condutorNome: currentUser?.nome ?? '',
        hodometro: parseInt(store.hodometro) || 0,
        tipo: store.tipo as any,
        servicos: store.servicosSelecionados,
        descricao: store.descricao || undefined,
        foto: store.foto || undefined,
        cidade: store.cidade,
        dataDesejada: store.dataDesejada || undefined,
        horario: store.horario || undefined,
        observacoes: store.observacoes || undefined,
      });
      setOsId(novaOS.id);
      store.reset();
      // Notificação disparada automaticamente pela Cloud Function (trigger onCreate)
    }

    submit();

    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StepperHeader currentStep={6} />

      <View style={styles.container}>
        <Animated.View style={[styles.iconWrapper, { transform: [{ scale: scaleAnim }] }]}>
          <Ionicons name="checkmark-circle" size={96} color={Colors.primary} />
        </Animated.View>

        <Text variant="headlineMedium" style={styles.title}>OS enviada com sucesso!</Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Sua ordem de serviço foi registrada e será analisada pela equipe de frotas.
        </Text>

        <Surface style={styles.osCard} elevation={1}>
          <Text variant="labelMedium" style={styles.osLabel}>Número da OS</Text>
          <Text variant="headlineSmall" style={styles.osNumber}>
            {osId.toUpperCase()}
          </Text>
        </Surface>

        <View style={styles.infoList}>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
            <Text variant="bodySmall" style={styles.infoText}>
              Você receberá atualizações sobre o status da OS
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="notifications-outline" size={16} color={Colors.textSecondary} />
            <Text variant="bodySmall" style={styles.infoText}>
              O gestor irá analisar e aprovar o orçamento
            </Text>
          </View>
        </View>

        <Button
          mode="contained"
          style={styles.btn}
          contentStyle={styles.btnContent}
          icon="home"
          onPress={() => router.replace('/(tabs)')}
        >
          Ir para início
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  iconWrapper: { marginBottom: 8 },
  title: {
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  osCard: {
    borderRadius: 12,
    padding: 20,
    backgroundColor: Colors.card,
    alignItems: 'center',
    width: '100%',
    marginVertical: 8,
  },
  osLabel: { color: Colors.textSecondary, marginBottom: 4 },
  osNumber: {
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 2,
  },
  infoList: { gap: 10, width: '100%' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoText: { color: Colors.textSecondary, flex: 1, lineHeight: 18 },
  btn: { borderRadius: 10, width: '100%', marginTop: 8 },
  btnContent: { paddingVertical: 4 },
});
