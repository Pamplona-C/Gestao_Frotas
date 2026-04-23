import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  TextInput as RNTextInput,
} from 'react-native';
import { Text, Button, Surface } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { StepperHeader } from '../../components/StepperHeader';
import { useNovaOSStore } from '../../store/novaOS.store';
import { Colors } from '../../constants/colors';

export default function Etapa4() {
  const router = useRouter();
  const {
    dataDesejada: storedData,
    horario: storedHorario,
    observacoes: storedObs,
    setDataDesejada,
    setHorario,
    setObservacoes,
  } = useNovaOSStore();

  const [selectedDate, setSelectedDate] = useState<Date | null>(
    storedData ? new Date(storedData) : null
  );
  const [horario, setHorarioLocal] = useState(storedHorario);
  const [observacoes, setObservacoesLocal] = useState(storedObs);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const dateLabel = selectedDate
    ? format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : 'Selecionar data';

  const onNext = () => {
    setDataDesejada(selectedDate ? selectedDate.toISOString() : '');
    setHorario(horario);
    setObservacoes(observacoes);
    router.push('/nova-os/etapa-5');
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
      <StepperHeader currentStep={4} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text variant="headlineSmall" style={styles.heading}>Agendamento</Text>
        <Text variant="bodyMedium" style={styles.sub}>Escolha a data e horário desejados</Text>

        {/* Date picker */}
        <View style={styles.field}>
          <Text variant="labelLarge" style={styles.label}>Data desejada</Text>
          {Platform.OS === 'web' ? (
            <Surface style={styles.inputSurface} elevation={1}>
              <RNTextInput
                value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''}
                onChangeText={(t) => {
                  if (t) setSelectedDate(new Date(t + 'T00:00:00'));
                }}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={Colors.textHint}
                style={styles.textInput}
                keyboardType="default"
              />
            </Surface>
          ) : (
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
              <Text
                style={[
                  styles.pickerText,
                  !selectedDate && { color: Colors.textHint },
                ]}
              >
                {dateLabel}
              </Text>
            </TouchableOpacity>
          )}

          {showDatePicker && Platform.OS !== 'web' && (
            <DateTimePicker
              value={selectedDate ?? new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={new Date()}
              onChange={(_, date) => {
                setShowDatePicker(false);
                if (date) setSelectedDate(date);
              }}
            />
          )}
        </View>

        {/* Time input */}
        <View style={styles.field}>
          <Text variant="labelLarge" style={styles.label}>Horário preferido</Text>
          {Platform.OS !== 'web' ? (
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowTimePicker(true)}
            >
              <Ionicons name="time-outline" size={20} color={Colors.primary} />
              <Text style={[styles.pickerText, !horario && { color: Colors.textHint }]}>
                {horario || 'Selecionar horário'}
              </Text>
            </TouchableOpacity>
          ) : (
            <Surface style={styles.inputSurface} elevation={1}>
              <RNTextInput
                value={horario}
                onChangeText={setHorarioLocal}
                placeholder="HH:MM"
                placeholderTextColor={Colors.textHint}
                style={styles.textInput}
                keyboardType="default"
              />
            </Surface>
          )}

          {showTimePicker && Platform.OS !== 'web' && (
            <DateTimePicker
              value={selectedDate ?? new Date()}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, date) => {
                setShowTimePicker(false);
                if (date) setHorarioLocal(format(date, 'HH:mm'));
              }}
            />
          )}
        </View>

        {/* Observations */}
        <View style={styles.field}>
          <Text variant="labelLarge" style={styles.label}>Observações (opcional)</Text>
          <Surface style={styles.textAreaSurface} elevation={1}>
            <RNTextInput
              value={observacoes}
              onChangeText={setObservacoesLocal}
              multiline
              placeholder="Alguma observação para o mecânico ou para o agendamento?"
              placeholderTextColor={Colors.textHint}
              style={styles.textAreaInput}
              textAlignVertical="top"
            />
          </Surface>
        </View>

        <Button
          mode="contained"
          style={styles.btn}
          contentStyle={styles.btnContent}
          onPress={onNext}
        >
          Continuar
        </Button>
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
  scroll: { padding: 20 },
  heading: { fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  sub: { color: Colors.textSecondary, marginBottom: 20 },
  field: { marginBottom: 16 },
  label: { color: Colors.textPrimary, marginBottom: 8, fontWeight: '600' },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  pickerText: { fontSize: 15, color: Colors.textPrimary, flex: 1 },
  inputSurface: {
    borderRadius: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  textInput: { fontSize: 15, color: Colors.textPrimary },
  textAreaSurface: {
    borderRadius: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  textAreaInput: {
    fontSize: 15,
    color: Colors.textPrimary,
    minHeight: 100,
    lineHeight: 22,
  },
  btn: { marginTop: 16, borderRadius: 10 },
  btnContent: { paddingVertical: 4 },
});
