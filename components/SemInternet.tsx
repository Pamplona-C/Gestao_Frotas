import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';

interface Props {
  /** Rota para onde o botão "Voltar" navega. Padrão: back(). */
  onVoltar?: () => void;
}

export function SemInternet({ onVoltar }: Props) {
  const router = useRouter();
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View
        style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
      >
        {/* Ícone */}
        <View style={styles.iconBg}>
          <Ionicons name="cloud-offline-outline" size={64} color={Colors.primary} />
        </View>

        {/* Textos */}
        <Text variant="headlineSmall" style={styles.title}>Sem conexão</Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Você precisa de internet para abrir uma Ordem de Serviço.{'\n'}
          Vá para um local com sinal e tente novamente.
        </Text>

        {/* Dica visual */}
        <View style={styles.tipsCard}>
          <DicaRow icon="wifi-outline"      text="Verifique o Wi-Fi do dispositivo" />
          <DicaRow icon="cellular-outline"  text="Verifique os dados móveis" />
          <DicaRow icon="refresh-outline"   text="Aguarde o sinal retornar" />
        </View>

        {/* Ações */}
        <Button
          mode="contained"
          style={styles.btnPrimary}
          contentStyle={styles.btnContent}
          icon="arrow-left"
          onPress={onVoltar ?? (() => router.back())}
        >
          Voltar
        </Button>
      </Animated.View>
    </SafeAreaView>
  );
}

function DicaRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.dicaRow}>
      <View style={styles.dicaIconBg}>
        <Ionicons name={icon as any} size={16} color={Colors.primary} />
      </View>
      <Text variant="bodySmall" style={styles.dicaText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  iconBg: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
  },
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
  tipsCard: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginVertical: 8,
  },
  dicaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dicaIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dicaText: {
    color: Colors.textSecondary,
    flex: 1,
  },
  btnPrimary: {
    width: '100%',
    borderRadius: 10,
    marginTop: 4,
  },
  btnContent: { paddingVertical: 4 },
});
