import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { TextInput, Text, Surface } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { MUNICIPIOS_BR } from '../data/municipios';
import { Colors } from '../constants/colors';

interface Props {
  label?: string;
  value: string;
  onChange: (cidade: string) => void;
  error?: boolean;
  errorMessage?: string;
}

const MAX_SUGESTOES = 6;
const NORM_RE = /[̀-ͯ]/g;

// Pré-computado uma vez no carregamento do bundle — nunca recalculado
const MUNICIPIOS_NORM = MUNICIPIOS_BR.map((c) => ({
  original: c,
  norm: c.toLowerCase().normalize('NFD').replace(NORM_RE, ''),
}));

function filtrar(query: string): string[] {
  if (query.length < 2) return [];
  const q = query.toLowerCase().normalize('NFD').replace(NORM_RE, '');
  const result: string[] = [];
  for (const m of MUNICIPIOS_NORM) {
    if (m.norm.includes(q)) {
      result.push(m.original);
      if (result.length === MAX_SUGESTOES) break;
    }
  }
  return result;
}

export function CidadeAutocomplete({ label = 'Cidade', value, onChange, error, errorMessage }: Props) {
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState(value);

  const onChangeText = useCallback((text: string) => {
    setInputValue(text);
    onChange(text);
    setSugestoes(filtrar(text));
  }, [onChange]);

  const onSelect = useCallback((cidade: string) => {
    setInputValue(cidade);
    onChange(cidade);
    setSugestoes([]);
  }, [onChange]);

  return (
    <View>
      <TextInput
        label={label}
        mode="outlined"
        value={inputValue}
        onChangeText={onChangeText}
        error={error}
        placeholder="Digite 2 letras para buscar…"
        left={<TextInput.Icon icon="map-marker-outline" />}
        autoCorrect={false}
      />
      {errorMessage ? (
        <Text style={styles.err}>{errorMessage}</Text>
      ) : null}
      {sugestoes.length > 0 ? (
        <Surface style={styles.dropdown} elevation={4}>
          <FlatList
            data={sugestoes}
            keyExtractor={(c) => c}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={false}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[styles.item, index < sugestoes.length - 1 && styles.itemBorder]}
                onPress={() => onSelect(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
                <Text variant="bodyMedium" style={{ color: Colors.textPrimary }}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </Surface>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  err: { fontSize: 12, color: '#DC2626', marginLeft: 4, marginTop: 2 },
  dropdown: {
    borderRadius: 8,
    marginTop: 4,
    backgroundColor: Colors.card,
    overflow: 'hidden',
    zIndex: 99,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
});
