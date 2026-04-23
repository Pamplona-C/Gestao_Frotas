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

export default function NovoUsuarioScreen() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<UserPerfil>('condutor');
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [confirmarVisivel, setConfirmarVisivel] = useState(false);
  const [snackMsg, setSnackMsg] = useState('');
  const [snackVisible, setSnackVisible] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSalvar = async (data: FormData) => {
    try {
      await createUserAccount({ ...data, perfil });
      setSnackMsg(`Conta de ${data.nome} criada com sucesso!`);
      setSnackVisible(true);
      reset();
      setPerfil('condutor');
      setTimeout(() => router.back(), 1800);
    } catch (err) {
      setSnackMsg(mapFirebaseError(err).message);
      setSnackVisible(true);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text variant="titleMedium" style={styles.topTitle}>Novo usuário</Text>
          <View style={{ width: 24 }} />
        </View>

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

            <Field label="Nome completo" icon="person-outline" error={errors.nome?.message}>
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

            <Field label="E-mail" icon="mail-outline" error={errors.email?.message}>
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

            <Field label="Departamento" icon="briefcase-outline" error={errors.departamento?.message}>
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
                return (
                  <TouchableOpacity
                    key={p.key}
                    style={[styles.perfilOption, active && styles.perfilOptionActive]}
                    onPress={() => setPerfil(p.key)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={p.icon as any}
                      size={22}
                      color={active ? Colors.primary : Colors.textSecondary}
                    />
                    <Text style={[styles.perfilLabel, active && styles.perfilLabelActive]}>
                      {p.label}
                    </Text>
                    <Text style={styles.perfilDesc}>{p.desc}</Text>
                    {active && (
                      <View style={styles.perfilCheck}>
                        <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
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

            <Field label="Senha" icon="lock-outline" error={errors.senha?.message}>
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

            <Field label="Confirmar senha" icon="lock-check-outline" error={errors.confirmarSenha?.message}>
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
            onPress={handleSubmit(onSalvar)}
            loading={isSubmitting}
            icon="account-plus"
            style={styles.btn}
            contentStyle={styles.btnContent}
          >
            Criar usuário
          </Button>
        </ScrollView>
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

function Field({
  error,
  children,
}: {
  label: string;
  icon: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.fieldWrap}>
      {children}
      {error && <Text style={styles.err}>{error}</Text>}
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
  perfilOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: '#F0FDF4',
  },
  perfilLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  perfilLabelActive: { color: Colors.primary },
  perfilDesc: {
    fontSize: 11,
    color: Colors.textHint,
    textAlign: 'center',
    lineHeight: 15,
  },
  perfilCheck: { position: 'absolute', top: 8, right: 8 },

  btn: { borderRadius: 10 },
  btnContent: { paddingVertical: 4 },
  snackbar: { backgroundColor: Colors.primary },
});
