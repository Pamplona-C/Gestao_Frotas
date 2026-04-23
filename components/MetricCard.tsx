import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Surface, Text } from 'react-native-paper';
import { Colors } from '../constants/colors';

interface Props {
  label: string;
  value: number | string;
  accent?: boolean;
}

export function MetricCard({ label, value, accent }: Props) {
  return (
    <Surface style={styles.card} elevation={1}>
      <Text
        variant="displaySmall"
        style={[styles.value, accent && { color: Colors.primary }]}
      >
        {value}
      </Text>
      <Text variant="labelMedium" style={styles.label}>
        {label}
      </Text>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 88,
  },
  value: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  label: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
});
