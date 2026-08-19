/**
 * Secretary announcements — list, pin/unpin and delete.
 *
 * Composing is a separate screen; pinning is inline because it is a one-field
 * PATCH a secretary does often.
 */

import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '../../src/components/Screen';
import { Button, Card, StatusPill } from '../../src/components/ui';
import { useApi } from '../../src/hooks/useApi';
import { api, errorMessage } from '../../src/lib/api';
import { COLORS, PRIORITY, SPACING } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';
import { formatRelative } from '../../src/utils/format';

type Announcement = {
  id: number;
  title: string;
  body: string;
  category: string | null;
  priority: string;
  pinned: boolean;
  created_at: string;
  created_by_username: string | null;
};

export default function SecretaryAnnouncements() {
  const router = useRouter();
  const state = useApi<{ announcements: Announcement[] }>(
    (signal) => api.secretary.announcements.list(signal),
    [],
  );
  const [busy, setBusy] = useState<number | null>(null);

  async function togglePin(a: Announcement) {
    setBusy(a.id);
    try {
      await api.secretary.announcements.update(a.id, { pinned: !a.pinned });
      await state.refresh();
    } catch (err) {
      Alert.alert('Could not update', errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  function confirmDelete(a: Announcement) {
    Alert.alert('Delete this announcement?', `"${a.title}" will be removed for every resident.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(a.id);
          try {
            await api.secretary.announcements.delete(a.id);
            await state.refresh();
          } catch (err) {
            Alert.alert('Could not delete', errorMessage(err));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  return (
    <Screen
      state={state}
      isEmpty={(d) => (d.announcements ?? []).length === 0}
      empty={{
        icon: 'megaphone-outline',
        title: 'No announcements yet',
        message: 'Post a notice and every resident sees it in their app.',
        action: (
          <Button title="Post an announcement" icon="add" onPress={() => router.push('/(secretary)/new-announcement')} />
        ),
      }}
      header={
        <Button
          title="Post an announcement"
          icon="add"
          onPress={() => router.push('/(secretary)/new-announcement')}
          fullWidth
        />
      }
    >
      {(data) => (
        <View style={s.list}>
          {(data.announcements ?? []).map((a) => (
            <Card key={a.id}>
              <View style={s.tags}>
                {a.pinned ? <StatusPill tone={{ bg: '#fef3c7', fg: '#92400e', label: 'Pinned' }} /> : null}
                {a.priority === 'URGENT' ? <StatusPill status="URGENT" map={PRIORITY} /> : null}
                {a.category ? (
                  <StatusPill tone={{ bg: COLORS.cardMuted, fg: COLORS.textSecondary, label: a.category }} />
                ) : null}
                <View style={s.flex} />
                <Text style={TYPE.caption}>{formatRelative(a.created_at)}</Text>
              </View>

              <Text style={[TYPE.sectionHeader, s.title]}>{a.title}</Text>
              <Text style={TYPE.body}>{a.body}</Text>

              <View style={s.actions}>
                <Button
                  title={a.pinned ? 'Unpin' : 'Pin to top'}
                  icon={a.pinned ? 'bookmark' : 'bookmark-outline'}
                  variant="secondary"
                  loading={busy === a.id}
                  onPress={() => togglePin(a)}
                  style={s.flex}
                />
                <Button title="" icon="trash-outline" variant="secondary" onPress={() => confirmDelete(a)} />
              </View>

              {a.created_by_username ? (
                <View style={s.byline}>
                  <Ionicons name="person-outline" size={13} color={COLORS.textMuted} />
                  <Text style={TYPE.caption}>Posted by {a.created_by_username}</Text>
                </View>
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: SPACING.md },
  tags: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SPACING.xs },
  title: { marginTop: SPACING.sm, marginBottom: SPACING.xs },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  byline: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.md },
});
