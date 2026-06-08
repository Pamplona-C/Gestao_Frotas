import React, { useState, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuthStore } from '../store/auth.store';
import {
  subscribeToNotificacoes,
  markAsRead,
  markAllAsRead,
} from '../services/notificacoes.service';
import { Notificacao } from '../types';
import { Colors } from '../constants/colors';

function groupLabel(isoDate: string): string {
  const d = parseISO(isoDate);
  if (isToday(d)) return 'Hoje';
  if (isYesterday(d)) return 'Ontem';
  return 'Mais antigas';
}

type ListItem = { type: 'header'; label: string } | { type: 'item'; data: Notificacao };

function buildSections(items: Notificacao[]): ListItem[] {
  const result: ListItem[] = [];
  let lastLabel = '';
  for (const n of items) {
    const label = groupLabel(n.createdAt);
    if (label !== lastLabel) {
      result.push({ type: 'header', label });
      lastLabel = label;
    }
    result.push({ type: 'item', data: n });
  }
  return result;
}

export default function NotificacoesScreen() {
  const { currentUser } = useAuthStore();
  const router = useRouter();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!currentUser?.uid) return;
      const unsub = subscribeToNotificacoes(currentUser.uid, setNotificacoes);
      return unsub;
    }, [currentUser?.uid]),
  );

  const unreadIds = notificacoes.filter((n) => !n.read).map((n) => n.id);
  const sections = buildSections(notificacoes);

  const handlePressItem = async (item: Notificacao) => {
    if (!item.read) await markAsRead(item.id);
    router.push(`/os/${item.osId}`);
  };

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      return <Text style={styles.groupLabel}>{item.label}</Text>;
    }
    const n = item.data;
    const unread = !n.read;
    return (
      <Pressable
        style={[styles.card, unread && styles.cardUnread]}
        onPress={() => handlePressItem(n)}
      >
        <View style={[styles.iconWrap, unread ? styles.iconWrapUnread : styles.iconWrapRead]}>
          <Ionicons
            name={
              n.type === 'os_criada' ? 'document-text-outline'
              : n.type === 'lembrete_os' ? 'alarm-outline'
              : 'swap-horizontal-outline'
            }
            size={20}
            color={unread ? Colors.primary : Colors.textHint}
          />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.title, unread && styles.titleUnread]} numberOfLines={1}>
            {n.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>{n.body}</Text>
          <Text style={styles.time}>
            {formatDistanceToNow(parseISO(n.createdAt), { addSuffix: true, locale: ptBR })}
          </Text>
        </View>
        {unread && <View style={styles.dot} />}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text variant="titleLarge" style={styles.pageTitle}>Notificações</Text>
        {unreadIds.length > 0 ? (
          <TouchableOpacity onPress={() => markAllAsRead(unreadIds)}>
            <Text style={styles.markAll}>Marcar todas</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      <FlatList
        data={sections}
        keyExtractor={(item, i) =>
          item.type === 'header' ? `h-${item.label}` : `n-${item.data.id}-${i}`
        }
        renderItem={renderItem}
        contentContainerStyle={notificacoes.length === 0 ? styles.emptyContainer : styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContent}>
            <Ionicons name="notifications-off-outline" size={52} color={Colors.textHint} />
            <Text style={styles.emptyText}>Nenhuma notificação</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pageTitle: { fontWeight: '700', color: Colors.textPrimary },
  markAll: { fontSize: 13, color: Colors.primary, fontWeight: '600', width: 80, textAlign: 'right' },
  list: { paddingVertical: 8, paddingHorizontal: 16, paddingBottom: 40 },
  emptyContainer: { flex: 1 },
  emptyContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 100 },
  emptyText: { color: Colors.textHint, fontSize: 15 },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textHint,
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 6,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardUnread: {
    borderColor: `${Colors.primary}40`,
    backgroundColor: '#EDF2FB',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapUnread: { backgroundColor: '#DDE8F8' },
  iconWrapRead: { backgroundColor: Colors.border },
  title: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  titleUnread: { color: Colors.textPrimary, fontWeight: '700' },
  body: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  time: { fontSize: 11, color: Colors.textHint, marginTop: 2 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 6,
  },
});
