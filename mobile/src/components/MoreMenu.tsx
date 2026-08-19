/**
 * MoreMenu — the shared "More" tab body.
 *
 * Resident and secretary both overflow past five tabs, and both need the same
 * identity header, link list and sign-out. Only the links differ.
 */

import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenScroll } from './Screen';
import { Avatar, Card, Chevron, Row, SectionTitle } from './ui';
import { useAuth, useSession } from '../lib/auth';
import { API_BASE } from '../lib/api';
import { COLORS, RADIUS, SPACING } from '../theme/tokens';
import { TYPE } from '../theme/type';

export type MoreLink = {
  label: string;
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  accent: string;
  /** Optional one-line explanation under the label. */
  hint?: string;
};

export type MoreGroup = { title: string; links: MoreLink[] };

export function MoreMenu({ groups, subtitle }: { groups: MoreGroup[]; subtitle?: string }) {
  const session = useSession();
  const { signOut } = useAuth();
  const router = useRouter();

  function confirmSignOut() {
    Alert.alert('Sign out?', 'You will need to sign in again to use the app.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <ScreenScroll>
      <Card>
        <View style={s.identity}>
          <Avatar name={session.name ?? session.username} size={52} />
          <View style={s.identityText}>
            <Text style={TYPE.sectionHeader} numberOfLines={1}>
              {session.name ?? session.username ?? 'Signed in'}
            </Text>
            <Text style={TYPE.rowMeta} numberOfLines={1}>
              {subtitle ??
                [session.societyName, session.unitNumber && `Unit ${session.unitNumber}`]
                  .filter(Boolean)
                  .join(' · ')}
            </Text>
          </View>
        </View>
      </Card>

      {groups.map((group) => (
        <View key={group.title}>
          <SectionTitle>{group.title}</SectionTitle>
          <Card padded={false}>
            {group.links.map((link, i, arr) => (
              <Row key={link.href} last={i === arr.length - 1} onPress={() => router.push(link.href as never)}>
                <View style={[s.icon, { backgroundColor: link.tint }]}>
                  <Ionicons name={link.icon} size={18} color={link.accent} />
                </View>
                <View style={s.flex}>
                  <Text style={TYPE.rowTitle}>{link.label}</Text>
                  {link.hint ? <Text style={TYPE.caption}>{link.hint}</Text> : null}
                </View>
                <Chevron />
              </Row>
            ))}
          </Card>
        </View>
      ))}

      <View>
        <SectionTitle>Account</SectionTitle>
        <Card padded={false}>
          <Row last onPress={confirmSignOut}>
            <View style={[s.icon, { backgroundColor: COLORS.dangerTint }]}>
              <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
            </View>
            <Text style={[TYPE.rowTitle, s.flex, { color: COLORS.danger }]}>Sign out</Text>
          </Row>
        </Card>
      </View>

      {/* Which backend this build talks to — the single most useful thing to
          know when someone reports "the app shows no data". */}
      <Text style={[TYPE.caption, s.footer]}>Nexso · {API_BASE.replace(/^https?:\/\//, '')}</Text>
    </ScreenScroll>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  identityText: { flex: 1, gap: 2 },
  icon: { width: 34, height: 34, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  footer: { textAlign: 'center', marginTop: SPACING.sm },
});
