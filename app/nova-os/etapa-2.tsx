import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StepperHeader } from '../../components/StepperHeader';
import { AccordionItem } from '../../components/AccordionItem';
import { useNovaOSStore } from '../../store/novaOS.store';
import { servicosCategorias } from '../../constants/servicosCategorias';
import { Colors } from '../../constants/colors';

export default function Etapa2() {
  const router = useRouter();
  const { servicosSelecionados: stored, setServicosSelecionados } = useNovaOSStore();

  const [selecionados, setSelecionados] = useState<string[]>(stored);

  const onToggle = (item: string) => {
    setSelecionados((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const canContinue = selecionados.length > 0;

  const onNext = () => {
    setServicosSelecionados(selecionados);
    router.push('/nova-os/etapa-3');
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
      <StepperHeader currentStep={2} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.sectionPad}>
          <Text variant="headlineSmall" style={styles.heading}>Serviços necessários</Text>
          <Text variant="bodyMedium" style={styles.sub}>
            Selecione os serviços que o veículo precisa
          </Text>
          {selecionados.length > 0 && (
            <Text variant="labelSmall" style={styles.countLabel}>
              {selecionados.length} selecionado(s)
            </Text>
          )}
        </View>

        <View style={styles.accordion}>
          {servicosCategorias.map((cat) => (
            <AccordionItem
              key={cat.id}
              label={cat.label}
              subitens={cat.subitens}
              selected={selecionados}
              onToggle={onToggle}
            />
          ))}
        </View>

        <View style={styles.footer}>
          <Button
            mode="contained"
            style={styles.btn}
            contentStyle={styles.btnContent}
            disabled={!canContinue}
            onPress={onNext}
          >
            Continuar {selecionados.length > 0 ? `(${selecionados.length})` : ''}
          </Button>
        </View>
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
  sectionPad: { paddingHorizontal: 20, paddingTop: 8 },
  heading: { fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  sub: { color: Colors.textSecondary, marginBottom: 8 },
  countLabel: { color: Colors.accent, marginBottom: 8 },
  accordion: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 8,
    backgroundColor: Colors.card,
  },
  footer: { padding: 20, paddingBottom: 32 },
  btn: { borderRadius: 10 },
  btnContent: { paddingVertical: 4 },
});
