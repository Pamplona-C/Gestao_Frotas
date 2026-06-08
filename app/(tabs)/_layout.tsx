import React, { useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Tabs, Redirect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/auth.store';
import { Colors } from '../../constants/colors';
import { HapticTab } from '../../components/haptic-tab';
import { CenterTabButton } from '../../components/CenterTabButton';

export default function TabLayout() {
  const { currentUser } = useAuthStore();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const router = useRouter();

  const [menuOpen, setMenuOpen] = useState(false);
  const animY1   = useRef(new Animated.Value(30)).current;
  const animY2   = useRef(new Animated.Value(30)).current;
  const animFade = useRef(new Animated.Value(0)).current;

  if (!currentUser) return <Redirect href="/login" />;

  const isGestor = currentUser.perfil === 'gestor';

  const openMenu = () => {
    animY1.setValue(30);
    animY2.setValue(30);
    animFade.setValue(0);
    setMenuOpen(true);
    Animated.parallel([
      Animated.timing(animFade, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(animY1, { toValue: 0, tension: 65, friction: 8, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(55),
        Animated.spring(animY2, { toValue: 0, tension: 65, friction: 8, useNativeDriver: true }),
      ]),
    ]).start();
  };

  const closeMenu = (callback?: () => void) => {
    Animated.timing(animFade, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setMenuOpen(false);
      callback?.();
    });
  };

  const toggle = () => (menuOpen ? closeMenu() : openMenu());

  const navigate = (href: string) => closeMenu(() => router.push(href as any));

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.textHint,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            position: 'absolute',
            bottom: bottomInset + 12,
            left: 0,
            right: 0,
            marginHorizontal: 48,
            borderTopWidth: 0,
            height: 56,
            paddingBottom: 6,
            paddingTop: 4,
            backgroundColor: 'transparent',
            elevation: 0,
          },
          tabBarBackground: () => (
            <View style={{
              flex: 1,
              borderRadius: 20,
              backgroundColor: Colors.card,
              borderWidth: 1,
              borderColor: 'rgba(0,0,0,0.07)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.12,
              shadowRadius: 12,
              elevation: 10,
            }} />
          ),
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: isGestor ? 'Painel' : 'Início',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name={isGestor ? 'grid-outline' : 'home-outline'} size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="nova-acao"
          options={isGestor
            ? { title: '', href: null }
            : { title: '', tabBarButton: () => <CenterTabButton isOpen={menuOpen} onToggle={toggle} /> }
          }
        />
        <Tabs.Screen
          name="veiculos"
          options={{
            title: 'Veículos',
            href: isGestor ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="car-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="fornecedores"
          options={{
            title: 'Fornecedores',
            href: isGestor ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="business-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="configuracoes"
          options={{
            title: 'Configurações',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen name="profile" options={{ href: null }} />
      </Tabs>

      {/* Backdrop */}
      {menuOpen && (
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={toggle}
        />
      )}

      {/* Speed dial — dois botões empilhados acima do botão central */}
      {menuOpen && (
        <Animated.View
          style={[styles.speedDial, { bottom: bottomInset + 88, opacity: animFade }]}
        >
          {/* Abastecimento — aparece segundo (mais alto) */}
          <Animated.View style={[styles.actionRow, { transform: [{ translateY: animY2 }] }]}>
            <Text style={styles.actionLabel}>Abastecimento</Text>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigate('/novo-abastecimento')}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="gas-station-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </Animated.View>

          {/* Criar OS — aparece primeiro (mais baixo) */}
          <Animated.View style={[styles.actionRow, { transform: [{ translateY: animY1 }] }]}>
            <Text style={styles.actionLabel}>Criar OS</Text>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigate('/nova-os/etapa-1')}
              activeOpacity={0.85}
            >
              <Ionicons name="construct-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 10,
  },
  speedDial: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 14,
    zIndex: 20,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    width: 210,
  },
  actionBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 8,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    backgroundColor: 'rgba(10,31,61,0.82)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
