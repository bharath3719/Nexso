/**
 * Dead end for a valid account whose portal this app does not ship.
 *
 * Vendor, guard and Nexso-admin accounts all authenticate against the shared
 * /api/auth/login, so they will get a token and a session. Dropping them into
 * an empty tab bar would look like a broken app; this says plainly what
 * happened and gets them back out.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button } from '../../src/components/ui';
import { useAuth } from '../../src/lib/auth';
import { COLORS, RADIUS, SPACING } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';

const ROLE_LABEL: Record<string, string> = {
  VENDOR: 'vendor',
  GUARD: 'security guard',
  NEXSO_ADMIN: 'Nexso administrator',
};

export default function UnsupportedRole() {
  const { role, signOut } = useAuth();
  const label = ROLE_LABEL[role ?? ''] ?? 'this';

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <View style={s.icon}>
          <Ionicons name="phone-portrait-outline" size={32} color={COLORS.textMuted} />
        </View>

        <Text style={[TYPE.pageTitle, s.center]}>Not available in the app yet</Text>

        <Text style={[TYPE.body, s.center, { color: COLORS.textSecondary }]}>
          Your account signed in as a {label}. The Nexso app currently supports resident and
          secretary portals only — please use the web portal in your browser for now.
        </Text>

        <Button title="Sign out" variant="secondary" onPress={() => void signOut()} fullWidth />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.card },
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: SPACING.lg,
    paddingHorizontal: SPACING.xl,
  },
  icon: {
    width: 68,
    height: 68,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  center: { textAlign: 'center' },
});
