import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '../constants/colors';

interface Props {
  label: string;
  subitens: string[];
  selected: string[];
  onToggle: (item: string) => void;
}

export function AccordionItem({ label, subitens, selected, onToggle }: Props) {
  const [open, setOpen] = useState(false);
  const [contentH, setContentH] = useState(0);
  const progress = useSharedValue(0);

  const hasSubitens = subitens.length > 0;

  const toggleOpen = () => {
    if (!hasSubitens) {
      onToggle(label);
      return;
    }
    const next = !open;
    setOpen(next);
    progress.value = withTiming(next ? 1 : 0, { duration: 220 });
  };

  const onMeasure = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && contentH === 0) setContentH(h);
  };

  const animStyle = useAnimatedStyle(() => ({
    height: progress.value * contentH,
    overflow: 'hidden' as const,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  const isChecked = !hasSubitens && selected.includes(label);

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity style={styles.header} onPress={toggleOpen} activeOpacity={0.7}>
        {!hasSubitens ? (
          <View style={[styles.checkbox, isChecked && styles.checkboxOn]}>
            {isChecked && <Ionicons name="checkmark" size={13} color="#fff" />}
          </View>
        ) : (
          <View style={styles.checkboxPlaceholder} />
        )}
        <Text variant="bodyMedium" style={styles.label}>{label}</Text>
        {hasSubitens && (
          <Animated.View style={chevronStyle}>
            <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
          </Animated.View>
        )}
      </TouchableOpacity>

      {hasSubitens && (
        <Animated.View style={animStyle}>
          <View onLayout={onMeasure} style={styles.sublist}>
            {subitens.map((sub) => {
              const key = `${label} › ${sub}`;
              const checked = selected.includes(key);
              return (
                <TouchableOpacity
                  key={sub}
                  style={styles.subRow}
                  onPress={() => onToggle(key)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                    {checked && <Ionicons name="checkmark" size={13} color="#fff" />}
                  </View>
                  <Text variant="bodySmall" style={styles.subLabel}>{sub}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxPlaceholder: { width: 20 },
  label: {
    flex: 1,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  sublist: {
    paddingBottom: 4,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingLeft: 48,
    paddingRight: 16,
    gap: 12,
  },
  subLabel: { color: Colors.textSecondary, flex: 1 },
});
