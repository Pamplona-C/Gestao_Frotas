import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/auth.store';
import { subscribeToNotificacoes } from '../services/notificacoes.service';
import { Colors } from '../constants/colors';

export function NotificationBell() {
  const router = useRouter();
  const { currentUser } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = subscribeToNotificacoes(currentUser.uid, (items) => {
      setUnreadCount(items.filter((n) => !n.read).length);
    });
    return unsub;
  }, [currentUser?.uid]);

  return (
    <Pressable
      onPress={() => router.push('/notificacoes' as any)}
      hitSlop={8}
      style={styles.container}
    >
      <Ionicons name="notifications-outline" size={26} color={Colors.textPrimary} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative', padding: 4 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: Colors.background,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700', lineHeight: 13 },
});
