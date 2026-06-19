import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  iconName: IconName;
  iconColor: string;
  iconBg: string;
  value: string | number;
  valueSecondary?: string;
  label: string;
  subtitle?: string;
  urgent?: boolean;
}

export function GestorMetricCard({
  iconName,
  iconColor,
  iconBg,
  value,
  valueSecondary,
  label,
  subtitle,
  urgent,
}: Props) {
  const valueColor = urgent ? '#DC2626' : '#0A1F3D';

  return (
    <View style={[styles.card, urgent && styles.cardUrgent]}>
      {urgent && <View style={styles.accentBar} />}
      <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName} size={24} color={iconColor} />
      </View>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
        {valueSecondary ? (
          <Text style={styles.valueSecondary}>{valueSecondary}</Text>
        ) : null}
      </View>
      <Text style={styles.label}>{label}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardUrgent: {
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#DC2626',
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 2,
  },
  value: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  valueSecondary: {
    fontSize: 15,
    fontWeight: '500',
    color: '#4A566A',
    lineHeight: 34,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A1F3D',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#8A96A8',
  },
});
