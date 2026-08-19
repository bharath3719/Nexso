/**
 * Root layout.
 *
 * Mounts the providers, then acts as the single auth gate for the whole app:
 * one effect decides which route group the user belongs in and redirects if
 * they are somewhere else. Putting the guard here rather than in each group's
 * layout means there is exactly one place where "where should this user be?"
 * is answered.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../src/lib/auth';
import { Loading } from '../src/components/ui';
import { COLORS } from '../src/theme/tokens';

/** Landing route for each portal role the mobile app supports. */
const HOME_FOR_ROLE: Record<string, string> = {
  RESIDENT: '/(resident)',
  SECRETARY: '/(secretary)',
};

function RootNavigator() {
  const { session, restoring, role } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (restoring) return;

    const group = segments[0];
    const inAuthGroup = group === '(auth)';

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/sign-in');
      return;
    }

    // A staff account issued a temporary password must change it before it can
    // reach anything else. The backend keeps returning forcePasswordReset until
    // /api/auth/change-password succeeds, so this cannot be skipped by
    // reinstalling the app.
    if (session.forcePasswordReset) {
      if (group !== 'change-password') router.replace('/change-password');
      return;
    }

    const home = HOME_FOR_ROLE[role ?? ''];

    // Vendor, guard and admin accounts authenticate fine against the shared
    // /api/auth/login, so they have to be turned away explicitly rather than
    // dropped into an empty tab bar.
    if (!home) {
      if (!inAuthGroup) router.replace('/(auth)/unsupported-role');
      return;
    }

    if (inAuthGroup || group === 'change-password' || group === undefined) {
      router.replace(home as never);
    }
  }, [restoring, session, role, segments, router]);

  if (restoring) {
    return (
      <View style={s.splash}>
        <Loading />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.screen } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(resident)" />
      <Stack.Screen name="(secretary)" />
      <Stack.Screen name="change-password" options={{ headerShown: true, title: 'Change Password' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={s.flex}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  splash: { flex: 1, backgroundColor: COLORS.screen, alignItems: 'center', justifyContent: 'center' },
});
