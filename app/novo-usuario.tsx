import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, TextInput, Button, Surface, Divider, Portal, Snackbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createUserAccount, mapFirebaseError } from '../services/auth.service';
import { UserPerfil } from '../types';
import { Colors } from '../constants/colors';

const schema = z
  .object({
    nome:            z.string().min(2, 'Nome obrigatório'),
    email:           z.string().email('E-mail inválido'),
    departamento:    z.string().min(2, 'Departamento obrigatório'),
    senha:           z.string().min(6, 'Mínimo 6 caracteres'),
    confirmarSenha:  z.string().min(1, 'Confirme a senha'),
  })
  .refine((d) => d.senha === d.confirmarSenha, {
    message: 'As senhas não coincidem',
    path: ['confirmarSenha'],
  });

type FormData = z.infer<typeof schema>;

const PERFIS: { key: UserPerfil; label: string; icon: string; desc: string }[] = [
  {
    key:   'condutor',
    label: 'Condutor',
    icon:  'person-outline',
    desc:  'Abre ordens de serviço e acompanha status',
  },
  {
    key:   'gestor',
    label: 'Gestor',
    icon:  'shield-checkmark-outline',
    desc:  'Gerencia OS, veículos e fornecedores',
  },
];

const PERFIL_COLORS: Record<UserPerfil, { bg: string; text: string; border: string; badgeBg: string }> = {
  condutor: {
    bg:      '#F0FDF4',
    text:    '#15803D',
    border:  '#86EFAC',
    badgeBg: '#DCFCE7',
  },
  gestor: {
    bg:      '#EFF6FF',
    text:    '#2563EB',
    border:  '#93C5FD',
    badgeBg: '#DBEAFE',
  },
};

export default function NovoUsuarioScreen() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<UserPerfil>('condutor');
  const [step, setStep] = useState<'form' | 'resumo'>('form');
  const [pendingData, setPendingData] = useState<FormData | null>(null);
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [confirmarVisivel, setConfirmarVisivel] = useState(false);
  const [snackMsg, setSnackMsg] = useState('');
  const [snackVisible, setSnackVisible] = useState(false);
  const [criando, setCriando] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onRevisar = (data: FormData) => {
    setPendingData(data);
    setStep('resumo');
  };

  const onConfirmar = async () => {
    if (!pendingData) return;
    setCriando(true);
    try {
      await createUserAccount({ ...pendingData, perfil });
      setSnackMsg(`Conta de ${pendingData.nome} criada com sucesso!`);
      setSnackVisible(true);
      reset();
      setPerfil('condutor');
      setStep('form');
      setPendingData(null);
      setTimeout(() => router.back(), 1800);
    } catch (err) {
      setSnackMsg(mapFirebaseError(err).message);
      setSnackVisible(true);
    } finally {
      setCriando(false);
    }
  };

  const perfilInfo = PERFIS.find((p) => p.key === perfil)!;
  const colors = PERFIL_COLORS[perfil];

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => (step === 'resumo' ? setStep('form') : router.back())}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text variant="titleMedium" style={styles.topTitle}>
            {step === 'resumo' ? 'Confirmar criação' : 'Novo usuário'}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {step === 'form' ? (
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text variant="bodyMedium" style={styles.subtitle}>
              Crie as credenciais de acesso. O usuário pode entrar com o e-mail e senha definidos aqui.
            </Text>

            {/* Dados pessoais */}
            <Surface style={styles.card} elevation={1}>
              <Text variant="titleSmall" style={styles.cardTitle}>Dados pessoais</Text>
              <Divider style={styles.divider} />

              <Field error={errors.nome?.message}>
                <Controller
                  control={control}
                  name="nome"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <TextInput
                      label="Nome completo"
                      mode="outlined"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      autoCapitalize="words"
                      error={!!errors.nome}
                      style={styles.input}
                    />
                  )}
                />
              </Field>

              <Field error={errors.email?.message}>
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
                      error={!!errors.email}
                      style={styles.input}
                    />
                  )}
                />
              </Field>

              <Field error={errors.departamento?.message}>
                <Controller
                  control={control}
                  name="departamento"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <TextInput
                      label="Departamento"
                      mode="outlined"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      autoCapitalize="words"
                      error={!!errors.departamento}
                      style={styles.input}
                    />
                  )}
                />
              </Field>
            </Surface>

            {/* Perfil */}
            <Surface style={styles.card} elevation={1}>
              <Text variant="titleSmall" style={styles.cardTitle}>Perfil de acesso</Text>
              <Divider style={styles.divider} />
              <View style={styles.perfilRow}>
                {PERFIS.map((p) => {
                  const active = perfil === p.key;
                  const c = PERFIL_COLORS[p.key];
                  return (
                    <TouchableOpacity
                      key={p.key}
                      style={[
                        styles.perfilOption,
                        active && { borderColor: c.border, backgroundColor: c.bg },
                      ]}
                      onPress={() => setPerfil(p.key)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={p.icon as any}
                        size={22}
                        color={active ? c.text : Colors.textSecondary}
                      />
                      <Text style={[styles.perfilLabel, active && { color: c.text }]}>
                        {p.label}
                      </Text>
                      <Text style={styles.perfilDesc}>{p.desc}</Text>
                      {active && (
                        <View style={styles.perfilCheck}>
                          <Ionicons name="checkmark-circle" size={16} color={c.text} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Surface>

            {/* Senha */}
            <Surface style={styles.card} elevation={1}>
              <Text variant="titleSmall" style={styles.cardTitle}>Senha de acesso</Text>
              <Divider style={styles.divider} />

              <Field error={errors.senha?.message}>
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
              </Field>

              <Field error={errors.confirmarSenha?.message}>
                <Controller
                  control={control}
                  name="confirmarSenha"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <TextInput
                      label="Confirmar senha"
                      mode="outlined"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      secureTextEntry={!confirmarVisivel}
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
              </Field>
            </Surface>

            <Button
              mode="contained"
              onPress={handleSubmit(onRevisar)}
              icon="eye-outline"
              style={styles.btn}
              contentStyle={styles.btnContent}
            >
              Revisar e confirmar
            </Button>
          </ScrollView>
        ) : (
          /* ── Tela de resumo ──────────────────────── */
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Badge de perfil */}
            <View style={[styles.perfilBanner, { backgroundColor: colors.bg, borderColor: colors.border }]}>
              <View style={[styles.perfilBannerIcon, { backgroundColor: colors.badgeBg }]}>
                <Ionicons name={perfilInfo.icon as any} size={36} color={colors.text} />
              </View>
              <Text style={[styles.perfilBannerLabel, { color: colors.text }]}>
                {perfilInfo.label}
              </Text>
              <Text style={[styles.perfilBannerDesc, { color: colors.text }]}>
                {perfilInfo.desc}
              </Text>
            </View>

            {/* Dados do usuário */}
            <Surface style={styles.card} elevation={1}>
              <Text variant="titleSmall" style={styles.cardTitle}>Dados do novo usuário</Text>
              <Divider style={styles.divider} />

              <ResumoRow icon="person-outline" label="Nome" value={pendingData!.nome} />
              <ResumoRow icon="mail-outline" label="E-mail" value={pendingData!.email} />
              <ResumoRow icon="briefcase-outline" label="Departamento" value={pendingData!.departamento} />
              <ResumoRow icon="lock-closed-outline" label="Senha" value={'•'.repeat(pendingData!.senha.length)} />
            </Surface>

            <Text variant="bodySmall" style={styles.avisoTexto}>
              Revise os dados acima antes de confirmar. Após a criação, o usuário poderá acessar o app imediatamente com essas credenciais.
            </Text>

            <Button
              mode="contained"
              onPress={onConfirmar}
              loading={criando}
              disabled={criando}
              icon="account-plus"
              style={[styles.btn, { backgroundColor: colors.text }]}
              contentStyle={styles.btnContent}
            >
              Confirmar e criar usuário
            </Button>

            <Button
              mode="outlined"
              onPress={() => setStep('form')}
              icon="pencil-outline"
              style={styles.btnOutline}
              contentStyle={styles.btnContent}
              textColor={Colors.textSecondary}
            >
              Voltar e editar
            </Button>
          </ScrollView>
        )}
      </KeyboardAvoidingView>

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

function Field({ error, children }: { error?: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldWrap}>
      {children}
      {error && <Text style={styles.err}>{error}</Text>}
    </View>
  );
}

function ResumoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.resumoRow}>
      <Ionicons name={icon as any} size={16} color={Colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text variant="labelSmall" style={styles.resumoLabel}>{label}</Text>
        <Text variant="bodyMedium" style={styles.resumoValue}>{value}</Text>
      </View>
    </View>
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
    paddingBottom: 8,
  },
  topTitle: { fontWeight: '600', color: Colors.textPrimary },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  subtitle: { color: Colors.textSecondary, lineHeight: 20 },

  card: { borderRadius: 14, padding: 16, backgroundColor: Colors.card },
  cardTitle: { fontWeight: '700', color: Colors.textPrimary },
  divider: { marginVertical: 12 },

  fieldWrap: { marginBottom: 8 },
  input: { backgroundColor: Colors.card },
  err: { fontSize: 12, color: '#DC2626', marginLeft: 4, marginTop: 2 },

  // Perfil selector
  perfilRow: { flexDirection: 'row', gap: 10 },
  perfilOption: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    padding: 14,
    gap: 6,
    alignItems: 'center',
    position: 'relative',
  },
  perfilLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  perfilDesc: {
    fontSize: 11,
    color: Colors.textHint,
    textAlign: 'center',
    lineHeight: 15,
  },
  perfilCheck: { position: 'absolute', top: 8, right: 8 },

  // Perfil banner (resumo)
  perfilBanner: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  perfilBannerIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  perfilBannerLabel: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  perfilBannerDesc: {
    fontSize: 13,
    textAlign: 'center',
    opacity: 0.8,
  },

  // Resumo rows
  resumoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 7 },
  resumoLabel: { color: Colors.textHint, marginBottom: 1 },
  resumoValue: { color: Colors.textPrimary, fontWeight: '500' },

  avisoTexto: {
    color: Colors.textHint,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 4,
  },

  btn: { borderRadius: 10 },
  btnOutline: { borderRadius: 10, borderColor: Colors.border },
  btnContent: { paddingVertical: 4 },
  snackbar: { backgroundColor: Colors.primary },
});
