import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Colors } from '../constants/colors';

function useShimmer() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(1,   { duration: 700, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }, []);

  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}

function Bone({ width, height, style }: { width: number | string; height: number; style?: object }) {
  const shimmer = useShimmer();
  return (
    <Animated.View
      style={[{ width: width as any, height, borderRadius: 6, backgroundColor: Colors.border }, shimmer, style]}
    />
  );
}

export function SkeletonVeiculoCard() {
  return (
    <View style={styles.card}>
      {/* Header row: placa badge + frota + tipo + status */}
      <View style={styles.row}>
        <Bone width={72} height={22} />
        <Bone width={60} height={22} />
        <Bone width={24} height={22} />
        <Bone width={40} height={14} style={{ marginLeft: 4 }} />
        <View style={{ flex: 1 }} />
        <Bone width={16} height={16} />
      </View>
      {/* Marca modelo ano */}
      <Bone width="60%" height={14} style={{ marginTop: 8 }} />
      {/* Departamento */}
      <Bone width="40%" height={12} style={{ marginTop: 6 }} />
    </View>
  );
}

export function SkeletonFornecedorCard() {
  return (
    <View style={styles.card}>
      {/* Header: icon circle + nome + cidade + botões */}
      <View style={styles.row}>
        <Bone width={36} height={36} style={{ borderRadius: 18 }} />
        <View style={{ flex: 1, gap: 6 }}>
          <Bone width="55%" height={14} />
          <Bone width="35%" height={12} />
        </View>
        <Bone width={18} height={18} />
        <Bone width={18} height={18} />
      </View>
      {/* Info rows */}
      <Bone width="80%" height={11} style={{ marginTop: 10 }} />
      <Bone width="60%" height={11} style={{ marginTop: 6 }} />
      <Bone width="70%" height={11} style={{ marginTop: 6 }} />
    </View>
  );
}

export function SkeletonList({
  count = 6,
  variant,
}: {
  count?: number;
  variant: 'veiculo' | 'fornecedor';
}) {
  return (
    <View style={{ paddingHorizontal: 20, gap: 8, paddingTop: 4 }}>
      {Array.from({ length: count }).map((_, i) =>
        variant === 'veiculo'
          ? <SkeletonVeiculoCard key={i} />
          : <SkeletonFornecedorCard key={i} />,
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 14,
    backgroundColor: Colors.card,
    gap: 0,
    marginBottom: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
