import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Surface, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../store/auth.store';

const PERFIL_LABELS: Record<string, string> = {
  condutor: 'Condutor',
  gestor: 'Gestor de Frotas',
};

export default function ConfiguracoesScreen() {
  const { currentUser, logout } = useAuthStore();
  const router = useRouter();

  const initials =
    currentUser?.nome
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('') ?? '';

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      logout().then(() => router.replace('/login'));
      return;
    }
    Alert.alert(
      'Sair do aplicativo',
      'Tem certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: () => logout().then(() => router.replace('/login')),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Text variant="titleLarge" style={styles.pageTitle}>Configurações</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Perfil (banner informativo) ───────────── */}
        <View style={styles.profileBanner}>
          <View style={styles.bannerLeft}>
            {currentUser?.photoURL ? (
              <Image
                source={{ uri: currentUser.photoURL }}
                style={styles.bannerAvatar}
                cachePolicy="memory-disk"
                transition={200}
              />
            ) : (
              <View style={styles.bannerAvatarFallback}>
                <Text style={styles.bannerInitials}>{initials}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text variant="titleMedium" style={styles.bannerName} numberOfLines={1}>
                {currentUser?.nome}
              </Text>
              <Text variant="labelSmall" style={styles.bannerRole}>
                {PERFIL_LABELS[currentUser?.perfil ?? ''] ?? currentUser?.perfil}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Conta ────────────────────────────────── */}
        <Text variant="labelSmall" style={styles.sectionLabel}>CONTA</Text>
        <Surface style={styles.card} elevation={1}>
          <OptionRow
            icon="person-outline"
            label="Meu Perfil"
            sub="Foto, nome, senha"
            onPress={() => router.push('/perfil')}
          />
        </Surface>

        {/* ── Gestão (gestor only) ──────────────────── */}
        {currentUser?.perfil === 'gestor' && (
          <>
            <Text variant="labelSmall" style={styles.sectionLabel}>GESTÃO</Text>
            <Surface style={styles.card} elevation={1}>
              <OptionRow
                icon="person-add-outline"
                label="Criar usuário"
                sub="Cadastre condutores e gestores"
                onPress={() => router.push('/novo-usuario')}
              />
            </Surface>
          </>
        )}

        {/* ── Sessão ───────────────────────────────── */}
        <Text variant="labelSmall" style={styles.sectionLabel}>SESSÃO</Text>
        <Surface style={[styles.card, styles.logoutCard]} elevation={1}>
          <TouchableOpacity style={styles.optionRow} onPress={handleLogout} activeOpacity={0.8}>
            <View style={[styles.optionIcon, styles.logoutIcon]}>
              <Ionicons name="log-out-outline" size={20} color="#DC2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium" style={styles.logoutLabel}>Sair do aplicativo</Text>
              <Text variant="labelSmall" style={styles.logoutSub}>
                Você será redirecionado para o login
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#DC2626" />
          </TouchableOpacity>
        </Surface>

        <Text variant="labelSmall" style={styles.version}>FrotaAtiva v1.0.0 · Protótipo</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function OptionRow({
  icon,
  label,
  sub,
  onPress,
}: {
  icon: string;
  label: string;
  sub?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.optionRow} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.optionIcon}>
        <Ionicons name={icon as any} size={20} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium" style={styles.optionLabel}>{label}</Text>
        {sub && <Text variant="labelSmall" style={styles.optionSub}>{sub}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  topBar: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  pageTitle: { fontWeight: '700', color: Colors.textPrimary },

  scroll: { padding: 20, gap: 8, paddingBottom: 110 },

  // Profile banner
  profileBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  bannerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  bannerAvatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerInitials: { color: '#fff', fontSize: 20, fontWeight: '700' },
  bannerName: { fontWeight: '700', color: Colors.textPrimary },
  bannerRole: { color: Colors.primary, marginTop: 2 },

  // Section label
  sectionLabel: {
    color: Colors.textHint,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: 4,
    marginTop: 8,
    marginBottom: 4,
  },

  // Card & rows
  card: { borderRadius: 14, backgroundColor: Colors.card, overflow: 'hidden' },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: { color: Colors.textPrimary, fontWeight: '600' },
  optionSub: { color: Colors.textSecondary, marginTop: 1 },

  // Logout
  logoutCard: { borderWidth: 1, borderColor: '#FEE2E2', backgroundColor: '#FFF5F5' },
  logoutIcon: { backgroundColor: '#FEE2E2' },
  logoutLabel: { color: '#DC2626', fontWeight: '600' },
  logoutSub: { color: '#EF4444', marginTop: 1 },

  version: { textAlign: 'center', color: Colors.textHint, marginTop: 8 },
});
