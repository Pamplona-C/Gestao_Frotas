import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Surface, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import { Colors } from '../constants/colors';
import { esqueciSenha, mapAuthError } from '../services/auth.service';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
});

type FormData = z.infer<typeof schema>;

export default function EsqueciSenhaScreen() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email }: FormData) => {
    setErro(null);
    try {
      await esqueciSenha(email);
      // O backend responde igual para e-mail cadastrado ou não — de propósito,
      // para não revelar quem tem conta. Por isso seguimos sempre para a tela
      // do código, levando o e-mail digitado.
      router.push({ pathname: '/redefinir-senha', params: { email } });
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
              Esqueci minha senha
            </Text>
            <Text variant="bodyMedium" style={styles.subtitulo}>
              Informe o e-mail da sua conta. <Text style={styles.destaque}>Se houver uma conta
              com esse endereço</Text>, enviaremos um código de 6 dígitos para você criar uma
              senha nova.
            </Text>
            {/* O backend responde igual para e-mail cadastrado ou não, de propósito.
                Sem este aviso, quem digita um e-mail errado fica esperando um código
                que nunca vem, sem entender por quê. */}

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  label="E-mail"
                  mode="outlined"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  error={!!errors.email}
                  style={styles.input}
                />
              )}
            />
            {errors.email && (
              <Text variant="bodySmall" style={styles.erroCampo}>
                {errors.email.message}
              </Text>
            )}

            {erro && (
              <Text variant="bodySmall" style={styles.erro}>
                {erro}
              </Text>
            )}

            <Button
              mode="contained"
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
              disabled={isSubmitting}
              style={styles.btn}
              contentStyle={styles.btnContent}
            >
              Enviar código
            </Button>

            <Button mode="text" onPress={() => router.back()} disabled={isSubmitting}>
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
  card: { borderRadius: 16, padding: 24, backgroundColor: Colors.card, gap: 8 },
  titulo: { fontWeight: '700', color: Colors.textPrimary },
  subtitulo: { color: Colors.textSecondary, lineHeight: 20, marginBottom: 8 },
  destaque: { color: Colors.textPrimary, fontWeight: '600' },
  input: { backgroundColor: 'transparent' },
  erroCampo: { color: '#DC2626' },
  erro: { color: '#DC2626', marginTop: 4 },
  btn: { borderRadius: 10, marginTop: 12 },
  btnContent: { paddingVertical: 4 },
});
