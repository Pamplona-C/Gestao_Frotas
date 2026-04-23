import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

interface Props {
  currentStep: number;
  totalSteps?: number;
}

export function StepperHeader({ currentStep, totalSteps = 6 }: Props) {
  return (
    <View style={styles.container}>
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isDone = step < currentStep;
        const isActive = step === currentStep;

        return (
          <React.Fragment key={step}>
            {i > 0 && (
              <View
                style={[styles.line, isDone || isActive ? styles.lineActive : styles.lineInactive]}
              />
            )}
            <View
              style={[
                styles.circle,
                isDone && styles.circleDone,
                isActive && styles.circleActive,
                !isDone && !isActive && styles.circlePending,
              ]}
            >
              {isDone ? (
                <Ionicons name="checkmark" size={13} color="#fff" />
              ) : (
                <Text style={[styles.stepNum, isActive && styles.stepNumActive]}>
                  {step}
                </Text>
              )}
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  line: {
    flex: 1,
    height: 2,
    borderRadius: 1,
  },
  lineActive: { backgroundColor: Colors.primary },
  lineInactive: { backgroundColor: Colors.border },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDone: { backgroundColor: Colors.primary },
  circleActive: { backgroundColor: Colors.primary },
  circlePending: { backgroundColor: Colors.border },
  stepNum: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  stepNumActive: { color: '#fff' },
});
