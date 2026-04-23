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
import { OSTipo } from '../../types';
import { Colors } from '../../constants/colors';

const TIPO_OPTIONS: { key: OSTipo; label: string; icon: string; desc: string }[] = [
  { key: 'preventiva', label: 'Preventiva', icon: 'shield-checkmark-outline', desc: 'Manutenção programada' },
  { key: 'corretiva', label: 'Corretiva', icon: 'build-outline', desc: 'Reparo de problema' },
];

export default function Etapa2() {
  const router = useRouter();
  const {
    tipo: storedTipo,
    servicosSelecionados: stored,
    setTipo,
    setServicosSelecionados,
  } = useNovaOSStore();

  const [tipo, setTipoLocal] = useState<OSTipo | ''>(storedTipo);
  const [selecionados, setSelecionados] = useState<string[]>(stored);

  const onToggle = (item: string) => {
    setSelecionados((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const canContinue = tipo !== '' && selecionados.length > 0;

  const onNext = () => {
    setTipo(tipo as OSTipo);
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
          <Text variant="headlineSmall" style={styles.heading}>Tipo de serviço</Text>
          <Text variant="bodyMedium" style={styles.sub}>Selecione o tipo e os serviços necessários</Text>

          {/* Tipo toggle */}
          <View style={styles.tipoRow}>
            {TIPO_OPTIONS.map((opt) => {
              const selected = tipo === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.tipoCard, selected && styles.tipoCardActive]}
                  onPress={() => {
                    setTipoLocal(opt.key);
                    setSelecionados([]);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={opt.icon as any}
                    size={24}
                    color={selected ? '#fff' : Colors.textSecondary}
                  />
                  <Text style={[styles.tipoLabel, selected && styles.tipoLabelActive]}>
                    {opt.label}
                  </Text>
                  <Text style={[styles.tipoDesc, selected && styles.tipoDescActive]}>
                    {opt.desc}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {tipo !== '' && (
          <>
            <View style={styles.sectionPad}>
              <Text variant="titleSmall" style={styles.sectionTitle}>
                {tipo === 'preventiva' ? 'Serviços preventivos' : 'Sistema com problema'}
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
          </>
        )}

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
  sectionPad: { paddingHorizontal: 20 },
  heading: { fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  sub: { color: Colors.textSecondary, marginBottom: 16 },
  tipoRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  tipoCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    gap: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: 'center',
  },
  tipoCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  tipoLabel: { fontWeight: '700', fontSize: 14, color: Colors.textPrimary },
  tipoLabelActive: { color: '#fff' },
  tipoDesc: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center' },
  tipoDescActive: { color: 'rgba(255,255,255,0.8)' },
  sectionTitle: { fontWeight: '600', color: Colors.textPrimary, marginBottom: 4 },
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
