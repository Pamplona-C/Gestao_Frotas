import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Text, Surface, Button, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { StatusBadge } from '../../../components/StatusBadge';
import { Timeline } from '../../../components/Timeline';
import { subscribeToOSById } from '../../../services/os.service';
import { getFornecedorById } from '../../../services/fornecedor.service';
import { useAuthStore } from '../../../store/auth.store';
import { OrdemServico, Fornecedor } from '../../../types';
import { Colors } from '../../../constants/colors';

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={15} color={Colors.textSecondary} />
      <View>
        <Text variant="labelSmall" style={{ color: Colors.textHint }}>{label}</Text>
        <Text variant="bodyMedium" style={{ color: Colors.textPrimary, fontWeight: '500' }}>{value}</Text>
      </View>
    </View>
  );
}

export default function OSDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentUser } = useAuthStore();
  const [os, setOS] = useState<OrdemServico | null>(null);
  const [fornecedor, setFornecedor] = useState<Fornecedor | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const unsub = subscribeToOSById(id!, (data) => {
        if (!mounted) return;
        setOS(data);
        if (data?.fornecedorId) {
          getFornecedorById(data.fornecedorId).then((f) => {
            if (mounted) setFornecedor(f);
          });
        } else {
          setFornecedor(null);
        }
      });
      return () => {
        mounted = false;
        unsub();
      };
    }, [id])
  );

  if (!os) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text variant="bodyMedium" style={{ color: Colors.textHint }}>Carregando…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const criadoEm = format(parseISO(os.criadoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const dataDesejada = os.dataDesejada
    ? format(parseISO(os.dataDesejada), "dd/MM/yyyy", { locale: ptBR })
    : null;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.topCenter}>
          <View style={styles.plateBadge}>
            <Text style={styles.plateText}>{os.placa}</Text>
          </View>
          <View style={styles.frotaBadge}>
            <Text style={styles.frotaText}>Frota {os.frota}</Text>
          </View>
        </View>
        {currentUser?.perfil === 'gestor' ? (
          <TouchableOpacity
            onPress={() => router.push(`/os/${os.id}/gerenciar`)}
            style={styles.manageBtn}
          >
            <Ionicons name="settings-outline" size={22} color={Colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Status badge */}
        <View style={styles.statusRow}>
          <StatusBadge status={os.status} />
          <Text variant="labelSmall" style={{ color: Colors.textHint }}>{os.id.toUpperCase()}</Text>
        </View>

        {/* Info card */}
        <Surface style={styles.card} elevation={1}>
          <Text variant="titleSmall" style={styles.cardTitle}>Informações gerais</Text>
          <Divider style={{ marginBottom: 10 }} />
          <View style={styles.infoGrid}>
            <InfoRow icon="person-outline" label="Condutor" value={os.condutorNome} />
            <InfoRow icon="build-outline" label="Tipo" value={os.tipo === 'preventiva' ? 'Preventiva' : 'Corretiva'} />
            <InfoRow icon="speedometer-outline" label="Hodômetro" value={`${os.hodometro.toLocaleString('pt-BR')} km`} />
            <InfoRow icon="calendar-outline" label="Abertura" value={criadoEm} />
            {os.cidade && <InfoRow icon="location-outline" label="Cidade" value={os.cidade} />}
            {dataDesejada && <InfoRow icon="calendar-number-outline" label="Data desejada" value={`${dataDesejada}${os.horario ? ' às ' + os.horario : ''}`} />}
          </View>
        </Surface>

        {/* Services */}
        {(os.servicos && os.servicos.length > 0) && (
          <Surface style={styles.card} elevation={1}>
            <Text variant="titleSmall" style={styles.cardTitle}>Serviços solicitados</Text>
            <Divider style={{ marginBottom: 10 }} />
            {os.servicos.map((s, i) => (
              <View key={i} style={styles.serviceRow}>
                <Ionicons name="checkmark-circle-outline" size={15} color={Colors.accent} />
                <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>{s}</Text>
              </View>
            ))}
          </Surface>
        )}

        {/* Description */}
        {os.descricao && (
          <Surface style={styles.card} elevation={1}>
            <Text variant="titleSmall" style={styles.cardTitle}>Descrição do problema</Text>
            <Divider style={{ marginBottom: 10 }} />
            <Text variant="bodySmall" style={{ color: Colors.textSecondary, lineHeight: 20 }}>
              {os.descricao}
            </Text>
          </Surface>
        )}

        {/* Fornecedor */}
        {fornecedor && (
          <Surface style={styles.card} elevation={1}>
            <Text variant="titleSmall" style={styles.cardTitle}>Fornecedor</Text>
            <Divider style={{ marginBottom: 10 }} />
            <InfoRow icon="business-outline" label="Nome" value={fornecedor.nome} />
            <InfoRow icon="location-outline" label="Endereço" value={`${fornecedor.endereco} · ${fornecedor.cidade}`} />
            <InfoRow icon="time-outline" label="Horário" value={fornecedor.horario} />
            <InfoRow icon="person-outline" label="Responsável" value={`${fornecedor.responsavel} · ${fornecedor.telefone}`} />
          </Surface>
        )}

        {/* Timeline */}
        <Surface style={styles.card} elevation={1}>
          <Text variant="titleSmall" style={styles.cardTitle}>Acompanhamento</Text>
          <Divider style={{ marginBottom: 10 }} />
          <Timeline os={os} />
        </Surface>

        {/* Nota interna (gestor only) */}
        {os.notaInterna && currentUser?.perfil === 'gestor' && (
          <Surface style={[styles.card, styles.noteCard]} elevation={0}>
            <View style={styles.noteHeader}>
              <Ionicons name="document-text-outline" size={15} color={Colors.primary} />
              <Text variant="labelMedium" style={{ color: Colors.primary }}>Nota interna</Text>
            </View>
            <Text variant="bodySmall" style={{ color: Colors.textSecondary, lineHeight: 20 }}>
              {os.notaInterna}
            </Text>
          </Surface>
        )}

        {/* Gestor action button */}
        {currentUser?.perfil === 'gestor' && (
          <Button
            mode="contained"
            style={styles.btn}
            contentStyle={styles.btnContent}
            icon="cog"
            onPress={() => router.push(`/os/${os.id}/gerenciar`)}
          >
            Gerenciar OS
          </Button>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  topCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  plateBadge: {
    backgroundColor: Colors.textPrimary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  plateText: { color: '#fff', fontWeight: '700', fontSize: 13, letterSpacing: 1 },
  frotaBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  frotaText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '500' },
  manageBtn: { padding: 2 },
  scroll: { padding: 20, gap: 12 },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  card: { borderRadius: 12, padding: 14, backgroundColor: Colors.card },
  cardTitle: { fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  infoGrid: { gap: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  noteCard: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  btn: { borderRadius: 10 },
  btnContent: { paddingVertical: 4 },
});
