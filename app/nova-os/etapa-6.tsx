import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Text, Button, Surface, ProgressBar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StepperHeader } from '../../components/StepperHeader';
import { useNovaOSStore } from '../../store/novaOS.store';
import { useAuthStore } from '../../store/auth.store';
import { createOS, updateOS } from '../../services/os.service';
import { getVeiculoByPlaca } from '../../services/veiculo.service';
import { uploadFotosOS } from '../../services/storage.service';
import { Colors } from '../../constants/colors';

type Fase = 'enviando' | 'concluido' | 'concluido_sem_fotos';

export default function Etapa6() {
  const router = useRouter();
  const store = useNovaOSStore();
  const { currentUser } = useAuthStore();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const submittedRef = useRef(false);

  const [fase, setFase] = useState<Fase>('enviando');
  const [progresso, setProgresso] = useState<number | null>(null);
  const [osId, setOsId] = useState<string>('');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (submittedRef.current || !store.placa) return;
    submittedRef.current = true;

    async function submit() {
      try {
        const placa = store.placa;
        const fotosUris = store.fotos;

        const veiculo = await getVeiculoByPlaca(placa);
        const novaOS = await createOS({
          placa,
          frota: veiculo?.frota ?? '—',
          condutorId:            currentUser?.uid ?? '',
          condutorNome:          currentUser?.nome ?? '',
          condutorPhotoURL:      currentUser?.photoURL ?? null,
          condutorDepartamento:  currentUser?.departamento,
          hodometro: parseInt(store.hodometro) || 0,
          tipo: store.tipo as any,
          servicos: store.servicosSelecionados,
          descricao: store.descricao || undefined,
          cidade: store.cidade,
          dataDesejada: store.dataDesejada || undefined,
          horario: store.horario || undefined,
          observacoes: store.observacoes || undefined,
        });

        let fotosFalharam = false;
        if (fotosUris.length > 0) {
          try {
            const urls = await uploadFotosOS(fotosUris, novaOS.id, (pct) => setProgresso(pct));
            await updateOS(novaOS.id, { fotos: urls });
          } catch {
            fotosFalharam = true;
          }
        }

        setOsId(novaOS.id);
        store.reset();
        setFase(fotosFalharam ? 'concluido_sem_fotos' : 'concluido');

        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 80,
          useNativeDriver: true,
        }).start();
      } catch (e: any) {
        setErro(e?.message ?? 'Erro ao criar OS');
      }
    }

    submit();
  }, []);

  if (erro) {
    return (
      <SafeAreaView style={styles.safe}>
        <StepperHeader currentStep={6} />
        <View style={styles.container}>
          <Ionicons name="alert-circle-outline" size={72} color="#DC2626" />
          <Text variant="headlineSmall" style={[styles.title, { color: '#DC2626' }]}>
            Erro ao enviar OS
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>{erro}</Text>
          <Button
            mode="contained"
            style={styles.btn}
            contentStyle={styles.btnContent}
            onPress={() => router.replace('/(tabs)')}
          >
            Voltar ao início
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  if (fase === 'enviando') {
    return (
      <SafeAreaView style={styles.safe}>
        <StepperHeader currentStep={6} />
        <View style={styles.container}>
          <View style={styles.iconBg}>
            <Ionicons name="cloud-upload-outline" size={56} color={Colors.primary} />
          </View>
          <Text variant="titleLarge" style={styles.title}>
            {progresso !== null ? 'Enviando fotos…' : 'Criando OS…'}
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Aguarde, não feche o aplicativo.
          </Text>
          {progresso !== null && (
            <View style={styles.progressWrapper}>
              <ProgressBar
                progress={progresso / 100}
                color={Colors.primary}
                style={styles.progressBar}
              />
              <Text variant="labelMedium" style={styles.progressLabel}>
                {progresso}%
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (fase === 'concluido_sem_fotos') {
    return (
      <SafeAreaView style={styles.safe}>
        <StepperHeader currentStep={6} />
        <View style={styles.container}>
          <Ionicons name="checkmark-circle" size={96} color={Colors.primary} />
          <Text variant="headlineMedium" style={styles.title}>OS registrada!</Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            A OS foi criada com sucesso, mas o envio das fotos falhou. Você pode adicioná-las
            posteriormente pela tela de detalhes da OS.
          </Text>
          <Surface style={styles.osCard} elevation={1}>
            <Text variant="labelMedium" style={styles.osLabel}>Número da OS</Text>
            <Text variant="headlineSmall" style={styles.osNumber}>{osId.toUpperCase()}</Text>
          </Surface>
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
  iconBg: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
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
  progressWrapper: { width: '100%', gap: 8 },
  progressBar: { height: 8, borderRadius: 4 },
  progressLabel: {
    color: Colors.textSecondary,
    textAlign: 'right',
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
