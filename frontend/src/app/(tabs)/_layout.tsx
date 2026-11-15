import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../lib/AppContext';
import { colors } from '../../ui/theme';

/** Deux onglets persistants : Mon suivi et Mon chat. */
export default function TabLayout() {
  const { session } = useApp();
  const insets = useSafeAreaInsets();
  if (!session) return <Redirect href="/connexion" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.white,
        tabBarInactiveTintColor: '#8FA0BC',
        tabBarLabelStyle: { fontSize: 13, fontWeight: '700', marginTop: 2 },
        tabBarItemStyle: { height: 68, paddingVertical: 8, justifyContent: 'center' },
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: Math.max(insets.bottom, 12),
          height: 68,
          borderRadius: 34,
          backgroundColor: colors.navy,
          borderTopWidth: 0,
          paddingTop: 0,
          paddingBottom: 0,
        },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mon suivi',
          tabBarAccessibilityLabel: 'Mon suivi',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'pulse' : 'pulse-outline'} size={22} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Mon chat',
          tabBarAccessibilityLabel: 'Mon chat',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'paw' : 'paw-outline'} size={22} color={color as string} />,
        }}
      />
    </Tabs>
  );
}
