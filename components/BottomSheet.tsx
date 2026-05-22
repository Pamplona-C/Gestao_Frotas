import React, { type ReactNode, useCallback, useEffect } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';

type BottomSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  children: ReactNode;
  maxHeight?: ViewStyle['maxHeight'];
  keyboardAvoiding?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  disableDrag?: boolean;
};

const DISMISS_DISTANCE = 80;
const DISMISS_VELOCITY = 900;
const DISMISS_TRANSLATE_Y = 520;

export function BottomSheet({
  visible,
  onDismiss,
  children,
  maxHeight,
  keyboardAvoiding = false,
  contentStyle,
  disableDrag = false,
}: BottomSheetProps) {
  const { bottom } = useSafeAreaInsets();
  const translateY = useSharedValue(DISMISS_TRANSLATE_Y);
  const keyboardBehavior = !keyboardAvoiding
    ? undefined
    : Platform.OS === 'ios'
      ? 'padding'
      : 'height';

  const dismissWithAnimation = useCallback(() => {
    translateY.value = withTiming(DISMISS_TRANSLATE_Y, { duration: 180 }, (finished) => {
      if (finished) {
        runOnJS(onDismiss)();
      }
    });
  }, [onDismiss, translateY]);

  useEffect(() => {
    if (visible) {
      translateY.value = DISMISS_TRANSLATE_Y;
      translateY.value = withTiming(0, { duration: 220 });
    }
  }, [translateY, visible]);

  const panGesture = Gesture.Pan()
    .enabled(!disableDrag)
    .onUpdate((event) => {
      translateY.value = Math.max(event.translationY, 0);
    })
    .onEnd((event) => {
      const shouldDismiss =
        event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY;

      if (shouldDismiss) {
        translateY.value = withTiming(DISMISS_TRANSLATE_Y, { duration: 180 }, (finished) => {
          if (finished) {
            runOnJS(onDismiss)();
          }
        });
        return;
      }

      translateY.value = withSpring(0, {
        damping: 18,
        stiffness: 180,
      });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handle = (
    <Animated.View style={styles.handleArea}>
      <Animated.View style={styles.handle} />
    </Animated.View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismissWithAnimation}
    >
      <KeyboardAvoidingView
        enabled={keyboardAvoiding}
        behavior={keyboardBehavior}
        style={styles.container}
      >
        <TouchableOpacity
          style={[StyleSheet.absoluteFillObject, styles.overlay]}
          activeOpacity={1}
          onPress={dismissWithAnimation}
        />

        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: bottom + 16, maxHeight },
            contentStyle,
            animatedStyle,
          ]}
        >
          {disableDrag ? handle : <GestureDetector gesture={panGesture}>{handle}</GestureDetector>}
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default BottomSheet;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  handleArea: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 6,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
});
