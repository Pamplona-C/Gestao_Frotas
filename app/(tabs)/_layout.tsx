import React from 'react';
import { View } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth.store';
import { Colors } from '../../constants/colors';
import { HapticTab } from '../../components/haptic-tab';

export default function TabLayout() {
  const { currentUser } = useAuthStore();

  // Guard: redirect to login if not authenticated
  if (!currentUser) return <Redirect href="/login" />;

  const isGestor = currentUser.perfil === 'gestor';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textHint,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: 'absolute',
          bottom: 28,
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
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
