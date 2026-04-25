import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
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
import { getUserById } from '../../../services/auth.service';
import { useAuthStore } from '../../../store/auth.store';
import { OrdemServico, Fornecedor, UserProfile } from '../../../types';
import { Colors } from '../../../constants/colors';

const { width: SCREEN_W } = Dimensions.get('window');

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

function FotoGaleria({ fotos, condutorNome }: { fotos: string[]; condutorNome: string }) {
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);

  return (
    <>
      <Surface style={styles.card} elevation={1}>
        <Text variant="titleSmall" style={styles.cardTitle}>
          Fotos do problema ({fotos.length})
        </Text>
        <Divider style={{ marginBottom: 10 }} />
        <View style={styles.photoGrid}>
          {fotos.map((url, i) => (
            <TouchableOpacity key={i} onPress={() => setFotoAmpliada(url)} activeOpacity={0.85}>
              <Image
                source={{ uri: url }}
                style={styles.photoThumb}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={200}
              />
            </TouchableOpacity>
          ))}
        </View>
      </Surface>

      <Modal visible={!!fotoAmpliada} transparent animationType="fade" onRequestClose={() => setFotoAmpliada(null)}>
        <View style={styles.lightboxBg}>
          <TouchableOpacity style={styles.lightboxClose} onPress={() => setFotoAmpliada(null)}>
            <Ionicons name="close-circle" size={36} color="#fff" />
          </TouchableOpacity>
          {fotoAmpliada && (
            <Image
              source={{ uri: fotoAmpliada }}
              style={styles.lightboxImage}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          )}
          <Text style={styles.lightboxCaption}>{condutorNome}</Text>
        </View>
      </Modal>
    </>
  );
}

export default function OSDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentUser } = useAuthStore();
  const [os, setOS] = useState<OrdemServico | null>(null);
  const [fornecedor, setFornecedor] = useState<Fornecedor | null>(null);
  const [condutorPerfil, setCondutorPerfil] = useState<UserProfile | null>(null);
  const [gestorPerfil, setGestorPerfil] = useState<UserProfile | null>(null);

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
        if (data?.condutorId) {
          getUserById(data.condutorId).then((u) => {
            if (mounted) setCondutorPerfil(u);
          });
        }
        if (data?.gestorId) {
          getUserById(data.gestorId).then((u) => {
            if (mounted) setGestorPerfil(u);
          });
        } else {
          setGestorPerfil(null);
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
    ? format(parseISO(os.dataDesejada), 'dd/MM/yyyy', { locale: ptBR })
    : null;

  const condutorInitials = os.condutorNome
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('');

  const gestorNome = gestorPerfil?.nome ?? os.gestorNome ?? '';
  const gestorInitials = gestorNome
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('');

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

          {/* Condutor com foto */}
          <View style={styles.condutorRow}>
            {condutorPerfil?.photoURL ? (
              <Image
                source={{ uri: condutorPerfil.photoURL }}
                style={styles.condutorAvatar}
                cachePolicy="memory-disk"
                transition={200}
              />
            ) : (
              <View style={styles.condutorAvatarFallback}>
                <Text style={styles.condutorInitials}>{condutorInitials}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text variant="labelSmall" style={{ color: Colors.textHint }}>Condutor</Text>
              <Text variant="bodyMedium" style={{ color: Colors.textPrimary, fontWeight: '500' }}>
                {os.condutorNome}
              </Text>
              {condutorPerfil?.departamento ? (
                <Text variant="labelSmall" style={{ color: Colors.textSecondary }}>
                  {condutorPerfil.departamento}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Gestor responsável */}
          {os.gestorId && (
            <View style={[styles.condutorRow, { marginTop: 2 }]}>
              {gestorPerfil?.photoURL ? (
                <Image
                  source={{ uri: gestorPerfil.photoURL }}
                  style={[styles.condutorAvatar, { borderColor: Colors.accent }]}
                  cachePolicy="memory-disk"
                  transition={200}
                />
              ) : (
                <View style={[styles.condutorAvatarFallback, { backgroundColor: Colors.accent }]}>
                  <Text style={styles.condutorInitials}>{gestorInitials}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text variant="labelSmall" style={{ color: Colors.textHint }}>Responsável pelo atendimento</Text>
                <Text variant="bodyMedium" style={{ color: Colors.textPrimary, fontWeight: '500' }}>
                  {gestorNome}
                </Text>
                {gestorPerfil?.departamento ? (
                  <Text variant="labelSmall" style={{ color: Colors.textSecondary }}>
                    {gestorPerfil.departamento}
                  </Text>
                ) : null}
              </View>
            </View>
          )}

          <View style={styles.infoGrid}>
            <InfoRow icon="build-outline" label="Tipo" value={os.tipo === 'preventiva' ? 'Preventiva' : 'Corretiva'} />
            <InfoRow icon="speedometer-outline" label="Hodômetro" value={`${os.hodometro.toLocaleString('pt-BR')} km`} />
            <InfoRow icon="calendar-outline" label="Abertura" value={criadoEm} />
            {os.cidade && <InfoRow icon="location-outline" label="Cidade" value={os.cidade} />}
            {dataDesejada && (
              <InfoRow
                icon="calendar-number-outline"
                label="Data desejada"
                value={`${dataDesejada}${os.horario ? ' às ' + os.horario : ''}`}
              />
            )}
          </View>
        </Surface>

        {/* Serviços */}
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

        {/* Descrição */}
        {os.descricao && (
          <Surface style={styles.card} elevation={1}>
            <Text variant="titleSmall" style={styles.cardTitle}>Descrição do problema</Text>
            <Divider style={{ marginBottom: 10 }} />
            <Text variant="bodySmall" style={{ color: Colors.textSecondary, lineHeight: 20 }}>
              {os.descricao}
            </Text>
          </Surface>
        )}

        {/* Fotos da OS */}
        {os.fotos && os.fotos.length > 0 && (
          <FotoGaleria fotos={os.fotos} condutorNome={os.condutorNome} />
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
            {fornecedor.googleMapsUrl ? (
              <TouchableOpacity
                style={styles.mapsBtn}
                onPress={() => Linking.openURL(fornecedor.googleMapsUrl!)}
                activeOpacity={0.75}
              >
                <Ionicons name="map-outline" size={15} color={Colors.primary} />
                <Text variant="labelMedium" style={{ color: Colors.primary, fontWeight: '600' }}>
                  Ver no Google Maps
                </Text>
              </TouchableOpacity>
            ) : null}
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

const THUMB_SIZE = (SCREEN_W - 40 - 28 - 16) / 3;

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
  condutorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  condutorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  condutorAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  condutorInitials: { color: '#fff', fontWeight: '700', fontSize: 15 },
  infoGrid: { gap: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoThumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 8,
    backgroundColor: Colors.border,
  },
  // Lightbox
  lightboxBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.93)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxClose: {
    position: 'absolute',
    top: 52,
    right: 20,
    zIndex: 10,
  },
  lightboxImage: {
    width: SCREEN_W,
    height: SCREEN_W,
  },
  lightboxCaption: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginTop: 16,
  },
  noteCard: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  btn: { borderRadius: 10 },
  btnContent: { paddingVertical: 4 },
  mapsBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
});
