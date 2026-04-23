import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Button, Divider, Surface, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import { Colors } from '../constants/colors';
import { useAuthStore } from '../store/auth.store';

WebBrowser.maybeCompleteAuthSession();

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(1, 'Informe a senha'),
});

type FormData = z.infer<typeof schema>;

// Google credentials — all three must be set AND app must not be running in Expo Go
const GOOGLE_WEB = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
const GOOGLE_IOS = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const GOOGLE_ANDROID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';
const isExpoGo = Constants.appOwnership === 'expo';
const googleEnabled = !!(GOOGLE_WEB && GOOGLE_IOS && GOOGLE_ANDROID) && !isExpoGo;

/**
 * Isolated component so the Google hook only mounts when credentials are set.
 * expo-auth-session throws immediately if the platform client ID is undefined.
 */
function GoogleSignInButton({ onSuccess }: { onSuccess: () => void }) {
  const { loginWithGoogle, clearError } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const [, , promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB,
    iosClientId: GOOGLE_IOS,
    androidClientId: GOOGLE_ANDROID,
  });

  const handlePress = async () => {
    clearError();
    setLoading(true);
    try {
      const result = await promptAsync();
      if (result?.type === 'success' && result.authentication?.idToken) {
        const ok = await loginWithGoogle(result.authentication.idToken);
        if (ok) onSuccess();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Divider style={styles.divider} />
      <Button
        mode="outlined"
        onPress={handlePress}
        loading={loading}
        icon="google"
        style={styles.googleBtn}
        contentStyle={styles.btnContent}
      >
        Entrar com Google
      </Button>
    </>
  );
}

export default function LoginScreen() {
  const { login, error, clearError } = useAuthStore();
  const router = useRouter();
  const [senhaVisivel, setSenhaVisivel] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    clearError();
    const ok = await login(data.email, data.senha);
    if (ok) router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Branding */}
          <View style={styles.brand}>
            <View style={styles.logoIcon}>
              <Ionicons name="car" size={36} color="#fff" />
            </View>
            <Text variant="headlineMedium" style={styles.appName}>FrotaAtiva</Text>
            <Text variant="bodyMedium" style={styles.appSub}>
              Gestão de manutenção de frotas
            </Text>
          </View>

          {/* Form */}
          <Surface style={styles.card} elevation={1}>
            <Text variant="titleMedium" style={styles.formTitle}>Entrar na sua conta</Text>

            <Controller
              control={control}
              name="email"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextInput
                  label="E-mail"
                  mode="outlined"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  left={<TextInput.Icon icon="email-outline" />}
                  error={!!errors.email}
                  style={styles.input}
                />
              )}
            />
            {errors.email && (
              <Text style={styles.errorText}>{errors.email.message}</Text>
            )}

            <Controller
              control={control}
              name="senha"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextInput
                  label="Senha"
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
                  error={!!errors.senha}
                  style={styles.input}
                />
              )}
            />
            {errors.senha && (
              <Text style={styles.errorText}>{errors.senha.message}</Text>
            )}

            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}

            <Button
              mode="contained"
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
              style={styles.btn}
              contentStyle={styles.btnContent}
            >
              Entrar
            </Button>

            {googleEnabled ? (
              <GoogleSignInButton onSuccess={() => router.replace('/(tabs)')} />
            ) : isExpoGo ? (
              <>
                <Divider style={styles.divider} />
                <View style={styles.expoGoNote}>
                  <Ionicons name="information-circle-outline" size={15} color={Colors.textSecondary} />
                  <Text style={styles.expoGoNoteText}>
                    Google Sign-In não está disponível no Expo Go. Use email e senha ou crie um Development Build.
                  </Text>
                </View>
              </>
            ) : null}
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center', gap: 24 },
  brand: { alignItems: 'center', gap: 8, marginBottom: 8 },
  logoIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: { fontWeight: '700', color: Colors.textPrimary },
  appSub: { color: Colors.textSecondary },
  card: { borderRadius: 16, padding: 20, backgroundColor: Colors.card, gap: 4 },
  formTitle: { fontWeight: '600', color: Colors.textPrimary, marginBottom: 8 },
  input: { marginTop: 6, backgroundColor: Colors.card },
  errorText: { fontSize: 12, color: '#DC2626', marginLeft: 4, marginTop: 2 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  errorBannerText: { color: '#DC2626', fontSize: 13, flex: 1 },
  btn: { marginTop: 12, borderRadius: 10 },
  btnContent: { paddingVertical: 4 },
  divider: { marginVertical: 16 },
  googleBtn: { borderRadius: 10, borderColor: Colors.border },
  expoGoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  expoGoNoteText: { color: Colors.textSecondary, fontSize: 12, flex: 1, lineHeight: 17 },
});
