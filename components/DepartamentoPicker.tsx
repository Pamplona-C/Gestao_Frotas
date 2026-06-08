import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from './BottomSheet';
import { getDepartamentos } from '../services/departamentos.service';
import { Colors } from '../constants/colors';

interface Props {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  errorMessage?: string;
  dense?: boolean;
}

export function DepartamentoPicker({
  label = 'Departamento',
  value,
  onChange,
  error,
  errorMessage,
  dense,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState('');
  const [opcoes, setOpcoes] = useState<string[]>([]);

  useEffect(() => {
    getDepartamentos()
      .then(setOpcoes)
      .catch(() => {});
  }, []);

  const filtradas = busca.trim()
    ? opcoes.filter((d) => d.toLowerCase().includes(busca.toLowerCase()))
    : opcoes;

  const onSelect = useCallback(
    (nome: string) => {
      onChange(nome);
      setOpen(false);
      setBusca('');
    },
    [onChange],
  );

  const borderColor = error ? '#DC2626' : Colors.border;
  const labelColor  = error ? '#DC2626' : Colors.textSecondary;

  return (
    <View>
      {/* Campo que abre o picker */}
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        style={[
          styles.field,
          dense && styles.fieldDense,
          { borderColor },
        ]}
      >
        <View style={styles.fieldInner}>
          <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
          <Text
            style={[
              styles.value,
              !value && { color: Colors.textHint },
            ]}
            numberOfLines={1}
          >
            {value || 'Selecionar'}
          </Text>
        </View>
        <Ionicons
          name="chevron-down"
          size={18}
          color={Colors.textSecondary}
          style={styles.chevron}
        />
      </TouchableOpacity>

      {errorMessage ? (
        <Text style={styles.err}>{errorMessage}</Text>
      ) : null}

      {/* Bottom sheet com lista */}
      <BottomSheet
        visible={open}
        onDismiss={() => { setOpen(false); setBusca(''); }}
        maxHeight="60%"
        disableDrag
      >
        <Text variant="titleSmall" style={styles.sheetTitle}>
          {label}
        </Text>

        <TextInput
          mode="outlined"
          placeholder="Buscar departamento…"
          value={busca}
          onChangeText={setBusca}
          dense
          left={<TextInput.Icon icon="magnify" />}
          right={busca ? <TextInput.Icon icon="close" onPress={() => setBusca('')} /> : undefined}
          style={styles.searchInput}
          autoFocus={false}
        />

        <FlatList
          data={filtradas}
          keyExtractor={(item) => item}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.option, item === value && styles.optionSelected]}
              onPress={() => onSelect(item)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.optionText,
                  item === value && { color: Colors.primary, fontWeight: '600' },
                ]}
              >
                {item}
              </Text>
              {item === value && (
                <Ionicons name="checkmark" size={16} color={Colors.primary} />
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {opcoes.length === 0 ? 'Carregando…' : 'Nenhum resultado'}
            </Text>
          }
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 4,
    backgroundColor: Colors.card,
    minHeight: 56,
    paddingHorizontal: 14,
  },
  fieldDense: {
    minHeight: 44,
  },
  fieldInner: {
    flex: 1,
    justifyContent: 'center',
    gap: 1,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
  },
  value: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  chevron: {
    marginLeft: 8,
  },
  err: {
    fontSize: 12,
    color: '#DC2626',
    marginLeft: 4,
    marginTop: 2,
  },
  sheetTitle: {
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: Colors.card,
    marginBottom: 8,
  },
  list: {
    marginTop: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  optionSelected: {
    backgroundColor: '#EDF2FB',
    borderRadius: 6,
    paddingHorizontal: 8,
  },
  optionText: {
    fontSize: 15,
    color: Colors.textPrimary,
  },
  empty: {
    color: Colors.textHint,
    textAlign: 'center',
    paddingVertical: 24,
    fontSize: 14,
  },
});
