import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { ActivityIndicator, Button, Divider, Portal, Snackbar, Surface, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import { Colors } from '../../constants/colors';
import { changePassword, mapFirebaseError } from '../../services/auth.service';
import { useAuthStore } from '../../store/auth.store';

const senhaSchema = z
  .object({
    senhaAtual: z.string().min(1, 'Informe a senha atual'),
    novaSenha: z.string().min(6, 'Mínimo 6 caracteres'),
    confirmarSenha: z.string().min(1, 'Confirme a nova senha'),
  })
  .refine((d) => d.novaSenha === d.confirmarSenha, {
    message: 'As senhas não coincidem',
    path: ['confirmarSenha'],
  });

type SenhaForm = z.infer<typeof senhaSchema>;

const PERFIL_LABELS: Record<string, string> = {
  condutor: 'Condutor',
  gestor: 'Gestor de Frotas',
};

export default function ProfileScreen() {
  const { currentUser, updatePhoto, logout } = useAuthStore();
  const router = useRouter();

  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [novaSenhaVisivel, setNovaSenhaVisivel] = useState(false);
  const [confirmarVisivel, setConfirmarVisivel] = useState(false);
  const [snackMsg, setSnackMsg] = useState('');
  const [snackVisible, setSnackVisible] = useState(false);
  const [senhaExpandida, setSenhaExpandida] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SenhaForm>({ resolver: zodResolver(senhaSchema) });

  const initials =
    currentUser?.nome
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('') ?? '';

  const showSnack = (msg: string) => {
    setSnackMsg(msg);
    setSnackVisible(true);
  };

  const photoURL = currentUser?.photoURL ?? null;

  // ── Photo picker ────────────────────────────────
  const handlePickPhoto = async () => {
    if (Platform.OS === 'web') {
      try {
        await updatePhoto('https://placehold.co/200x200/1A5C2A/ffffff?text=' + initials);
        showSnack('Foto atualizada com sucesso!');
      } catch {
        showSnack('Erro ao atualizar foto.');
      }
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Permita o acesso à galeria para trocar a foto.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        setUploadProgress(0);
        await updatePhoto(result.assets[0].uri, (pct) => setUploadProgress(pct));
        showSnack('Foto atualizada com sucesso!');
      } catch {
        showSnack('Erro ao salvar foto.');
      } finally {
        setUploadProgress(null);
      }
    }
  };

  const handleRemovePhoto = async () => {
    try {
      await updatePhoto(null);
      showSnack('Foto removida.');
    } catch {
      showSnack('Erro ao remover foto.');
    }
  };

  // ── Password change ─────────────────────────────
  const onSalvarSenha = async (data: SenhaForm) => {
    try {
      await changePassword(data.senhaAtual, data.novaSenha);
      reset();
      setSenhaExpandida(false);
      showSnack('Senha alterada com sucesso!');
    } catch (err) {
      showSnack(mapFirebaseError(err).message);
    }
  };

  // ── Logout ──────────────────────────────────────
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
        <Text variant="titleLarge" style={styles.pageTitle}>Meu Perfil</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Avatar ──────────────────────────────── */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarWrapper}
            onPress={handlePickPhoto}
            activeOpacity={0.85}
            disabled={uploadProgress !== null}
          >
            {photoURL ? (
              <Image
                source={{ uri: photoURL }}
                style={styles.avatarImage}
                cachePolicy="memory-disk"
                transition={200}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            {uploadProgress !== null ? (
              <View style={styles.uploadOverlay}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.uploadPct}>{uploadProgress}%</Text>
              </View>
            ) : (
              <View style={styles.cameraOverlay}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          <Text variant="titleLarge" style={styles.userName}>{currentUser?.nome}</Text>
          <View style={styles.perfilBadge}>
            <Ionicons
              name={currentUser?.perfil === 'gestor' ? 'shield-checkmark' : 'person'}
              size={13}
              color={Colors.primary}
            />
            <Text style={styles.perfilLabel}>
              {PERFIL_LABELS[currentUser?.perfil ?? ''] ?? currentUser?.perfil}
            </Text>
          </View>

          {photoURL && (
            <TouchableOpacity onPress={handleRemovePhoto} style={styles.removePhotoBtn}>
              <Ionicons name="trash-outline" size={13} color="#DC2626" />
              <Text style={styles.removePhotoText}>Remover foto</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Informações ─────────────────────────── */}
        <Surface style={styles.card} elevation={1}>
          <Text variant="titleSmall" style={styles.cardTitle}>Informações da conta</Text>
          <Divider style={styles.divider} />

          <InfoRow icon="mail-outline" label="E-mail" value={currentUser?.email ?? ''} />
          <InfoRow icon="briefcase-outline" label="Departamento" value={currentUser?.departamento ?? ''} />
          <InfoRow
            icon="finger-print-outline"
            label="ID do usuário"
            value={currentUser?.uid.toUpperCase() ?? ''}
          />
        </Surface>

        {/* ── Alterar senha ────────────────────────── */}
        <Surface style={styles.card} elevation={1}>
          <TouchableOpacity
            style={styles.cardTitleRow}
            onPress={() => setSenhaExpandida((v) => !v)}
            activeOpacity={0.8}
          >
            <View style={styles.cardTitleLeft}>
              <View style={styles.cardIconCircle}>
                <Ionicons name="lock-closed-outline" size={16} color={Colors.primary} />
              </View>
              <Text variant="titleSmall" style={styles.cardTitle}>Alterar senha</Text>
            </View>
            <Ionicons
              name={senhaExpandida ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>

          {senhaExpandida && (
            <>
              <Divider style={styles.divider} />

              <Controller
                control={control}
                name="senhaAtual"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    label="Senha atual"
                    mode="outlined"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry={!senhaVisivel}
                    left={<TextInput.Icon icon="lock-outline" />}
                    right={
                      <TextInput.Icon
                        icon={senhaVisivel ? 'eye-off-outline' : 'eye-outline'}
                        onPress={() => setSenhaVisivel((v) => !v)}
                      />
                    }
                    error={!!errors.senhaAtual}
                    style={styles.input}
                  />
                )}
              />
              {errors.senhaAtual && <Text style={styles.err}>{errors.senhaAtual.message}</Text>}

              <Controller
                control={control}
                name="novaSenha"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    label="Nova senha"
                    mode="outlined"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry={!novaSenhaVisivel}
                    left={<TextInput.Icon icon="lock-reset" />}
                    right={
                      <TextInput.Icon
                        icon={novaSenhaVisivel ? 'eye-off-outline' : 'eye-outline'}
                        onPress={() => setNovaSenhaVisivel((v) => !v)}
                      />
                    }
                    error={!!errors.novaSenha}
                    style={styles.input}
                  />
                )}
              />
              {errors.novaSenha && <Text style={styles.err}>{errors.novaSenha.message}</Text>}

              <Controller
                control={control}
                name="confirmarSenha"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    label="Confirmar nova senha"
                    mode="outlined"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry={!confirmarVisivel}
                    left={<TextInput.Icon icon="lock-check-outline" />}
                    right={
                      <TextInput.Icon
                        icon={confirmarVisivel ? 'eye-off-outline' : 'eye-outline'}
                        onPress={() => setConfirmarVisivel((v) => !v)}
                      />
                    }
                    error={!!errors.confirmarSenha}
                    style={styles.input}
                  />
                )}
              />
              {errors.confirmarSenha && (
                <Text style={styles.err}>{errors.confirmarSenha.message}</Text>
              )}

              <Button
                mode="contained"
                onPress={handleSubmit(onSalvarSenha)}
                style={styles.saveBtn}
                icon="content-save"
              >
                Salvar nova senha
              </Button>
            </>
          )}
        </Surface>

        {/* ── Criar usuário (gestor only) ──────────── */}
        {currentUser?.perfil === 'gestor' && (
          <Surface style={styles.card} elevation={1}>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => router.push('/novo-usuario')}
              activeOpacity={0.8}
            >
              <View style={styles.actionIcon}>
                <Ionicons name="person-add-outline" size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium" style={styles.actionLabel}>Criar usuário</Text>
                <Text variant="labelSmall" style={styles.actionSub}>
                  Cadastre condutores e gestores no sistema
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </Surface>
        )}

        {/* ── Sair ─────────────────────────────────── */}
        <Surface style={[styles.card, styles.logoutCard]} elevation={1}>
          <TouchableOpacity style={styles.logoutRow} onPress={handleLogout} activeOpacity={0.8}>
            <View style={styles.logoutIcon}>
              <Ionicons name="log-out-outline" size={20} color="#DC2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium" style={styles.logoutLabel}>Sair do aplicativo</Text>
              <Text variant="labelSmall" style={styles.logoutSub}>
                Você será redirecionado para a tela de login
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#DC2626" />
          </TouchableOpacity>
        </Surface>

        {/* App version */}
        <Text variant="labelSmall" style={styles.version}>FrotaAtiva v1.0.0 · Protótipo</Text>
      </ScrollView>

      <Portal>
        <Snackbar
          visible={snackVisible}
          onDismiss={() => setSnackVisible(false)}
          duration={3000}
          style={styles.snackbar}
        >
          {snackMsg}
        </Snackbar>
      </Portal>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={16} color={Colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text variant="labelSmall" style={styles.infoLabel}>{label}</Text>
        <Text variant="bodyMedium" style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  topBar: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  pageTitle: { fontWeight: '700', color: Colors.textPrimary },

  scroll: { padding: 20, gap: 16, paddingBottom: 110 },

  // Avatar
  avatarSection: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  avatarWrapper: { position: 'relative', marginBottom: 4 },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  avatarInitials: { color: '#fff', fontSize: 32, fontWeight: '700' },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  uploadOverlay: {
    position: 'absolute',
    inset: 0,
    borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  uploadPct: { color: '#fff', fontSize: 11, fontWeight: '700' },
  userName: { fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  perfilBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  perfilLabel: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  removePhotoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  removePhotoText: { color: '#DC2626', fontSize: 12 },

  // Card
  card: { borderRadius: 14, padding: 16, backgroundColor: Colors.card, gap: 4 },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontWeight: '700', color: Colors.textPrimary },
  divider: { marginVertical: 12 },

  // Info rows
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 6 },
  infoLabel: { color: Colors.textHint, marginBottom: 1 },
  infoValue: { color: Colors.textPrimary, fontWeight: '500' },

  // Password form
  input: { backgroundColor: Colors.card, marginTop: 4 },
  err: { fontSize: 12, color: '#DC2626', marginLeft: 4 },
  saveBtn: { marginTop: 12, borderRadius: 10 },

  // Action row (criar usuário)
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { color: Colors.textPrimary, fontWeight: '600' },
  actionSub: { color: Colors.textSecondary, marginTop: 1 },

  // Logout
  logoutCard: { borderWidth: 1, borderColor: '#FEE2E2', backgroundColor: '#FFF5F5' },
  logoutRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoutIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutLabel: { color: '#DC2626', fontWeight: '600' },
  logoutSub: { color: '#EF4444', marginTop: 1 },

  version: { textAlign: 'center', color: Colors.textHint, marginTop: 8 },

  snackbar: { backgroundColor: Colors.primary },
});
