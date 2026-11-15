import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider, useApp } from '../lib/AppContext';
import { colors } from '../ui/theme';

function Navigation() {
  const { ready } = useApp();
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.navy} />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="connexion" />
      <Stack.Screen name="programme" options={{ presentation: 'modal' }} />
      <Stack.Screen name="signalement" options={{ presentation: 'modal' }} />
      <Stack.Screen name="console" options={{ presentation: 'modal' }} />
      <Stack.Screen name="jeu/[id]" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <Navigation />
      </AppProvider>
    </SafeAreaProvider>
  );
}
