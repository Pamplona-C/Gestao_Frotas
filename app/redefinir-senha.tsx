import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { Button, Surface, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import { Colors } from '../constants/colors';
import { esqueciSenha, mapAuthError, redefinirSenha } from '../services/auth.service';

const schema = z
  .object({
    email: z.string().email('E-mail inválido'),
    codigo: z
      .string()
      .regex(/^\d{6}$/, 'O código tem 6 dígitos'),
    novaSenha: z.string().min(6, 'A senha precisa ter ao menos 6 caracteres'),
    confirmacao: z.string(),
  })
  .refine((d) => d.novaSenha === d.confirmacao, {
    message: 'As senhas não conferem',
    path: ['confirmacao'],
  });

type FormData = z.infer<typeof schema>;

export default function RedefinirSenhaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [senhaVisivel, setSenhaVisivel] = useState(false);

  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: params.email ?? '', codigo: '', novaSenha: '', confirmacao: '' },
  });

  const onSubmit = async ({ email, codigo, novaSenha }: FormData) => {
    setErro(null);
    setAviso(null);
    try {
      await redefinirSenha(email, codigo, novaSenha);
      router.replace('/login');
    } catch (e) {
      setErro(mapAuthError(e).message);
    }
  };

  const reenviar = async () => {
    setErro(null);
    setAviso(null);
    try {
      await esqueciSenha(getValues('email'));
      // Um pedido novo invalida o código anterior — avisar evita que a pessoa
      // digite o código do primeiro e-mail e leve "código inválido".
      setAviso('Enviamos um novo código. Use o mais recente — o anterior deixou de valer.');
    } catch (e) {
      setErro(mapAuthError(e).message);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Surface style={styles.card} elevation={1}>
            <Text variant="headlineSmall" style={styles.titulo}>
              Nova senha
            </Text>
            <Text variant="bodyMedium" style={styles.subtitulo}>
              Digite o código de 6 dígitos enviado para o seu e-mail e escolha a nova senha.
              O código vale por 15 minutos.
            </Text>
            <Text variant="bodySmall" style={styles.ajuda}>
              Não recebeu? Confira a caixa de spam e se o e-mail está escrito corretamente.
              Se o problema continuar, pode não haver conta cadastrada com esse endereço —
              fale com o seu gestor.
            </Text>

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  label="E-mail"
                  mode="outlined"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  error={!!errors.email}
                  style={styles.input}
                />
              )}
            />
            {errors.email && <Text style={styles.erroCampo}>{errors.email.message}</Text>}

            <Controller
              control={control}
              name="codigo"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  label="Código"
                  mode="outlined"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={value}
                  onBlur={onBlur}
                  onChangeText={(t) => onChange(t.replace(/\D/g, ''))}
                  error={!!errors.codigo}
                  style={[styles.input, styles.codigo]}
                />
              )}
            />
            {errors.codigo && <Text style={styles.erroCampo}>{errors.codigo.message}</Text>}

            <Controller
              control={control}
              name="novaSenha"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  label="Nova senha"
                  mode="outlined"
                  secureTextEntry={!senhaVisivel}
                  autoCapitalize="none"
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  error={!!errors.novaSenha}
                  style={styles.input}
                  right={
                    <TextInput.Icon
                      icon={senhaVisivel ? 'eye-off' : 'eye'}
                      onPress={() => setSenhaVisivel((v) => !v)}
                    />
                  }
                />
              )}
            />
            {errors.novaSenha && <Text style={styles.erroCampo}>{errors.novaSenha.message}</Text>}

            <Controller
              control={control}
              name="confirmacao"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  label="Confirme a nova senha"
                  mode="outlined"
                  secureTextEntry={!senhaVisivel}
                  autoCapitalize="none"
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  error={!!errors.confirmacao}
                  style={styles.input}
                />
              )}
            />
            {errors.confirmacao && (
              <Text style={styles.erroCampo}>{errors.confirmacao.message}</Text>
            )}

            {aviso && <Text style={styles.aviso}>{aviso}</Text>}
            {erro && <Text style={styles.erro}>{erro}</Text>}

            <Button
              mode="contained"
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
              disabled={isSubmitting}
              style={styles.btn}
              contentStyle={styles.btnContent}
            >
              Salvar nova senha
            </Button>

            <Button mode="text" onPress={reenviar} disabled={isSubmitting}>
              Reenviar código
            </Button>
            <Button mode="text" onPress={() => router.replace('/login')} disabled={isSubmitting}>
              Voltar para o login
            </Button>
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: { borderRadius: 16, padding: 24, backgroundColor: Colors.card, gap: 6 },
  titulo: { fontWeight: '700', color: Colors.textPrimary },
  subtitulo: { color: Colors.textSecondary, lineHeight: 20 },
  ajuda: { color: Colors.textHint ?? Colors.textSecondary, lineHeight: 18, marginBottom: 8 },
  input: { backgroundColor: 'transparent' },
  codigo: { letterSpacing: 6 },
  erroCampo: { color: '#DC2626', fontSize: 12 },
  erro: { color: '#DC2626', marginTop: 4 },
  aviso: { color: Colors.textSecondary, marginTop: 4 },
  btn: { borderRadius: 10, marginTop: 12 },
  btnContent: { paddingVertical: 4 },
});
