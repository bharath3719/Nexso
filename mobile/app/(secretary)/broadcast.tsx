/**
 * WhatsApp broadcast.
 *
 * Sends a message to every resident of the chosen audience. Unlike an
 * announcement — which sits in the app until someone opens it — this pushes to
 * people's phones and cannot be recalled, so the recipient count is fetched
 * live and confirmed before sending.
 *
 * Only residents with a phone number on file are counted; the backend filters
 * on `r.phone IS NOT NULL`.
 */

import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenScroll } from '../../src/components/Screen';
import { Banner, Button, Card, ChipGroup, ErrorNotice, Field } from '../../src/components/ui';
import { useApi, useMutation } from '../../src/hooks/useApi';
import { api, errorMessage } from '../../src/lib/api';
import { BROADCAST_TARGETS } from '../../src/constants';
import { COLORS, RADIUS, SPACING } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';

type Tower = { id: number; name: string };
type Target = (typeof BROADCAST_TARGETS)[number]['value'];

export default function Broadcast() {
  const router = useRouter();

  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<Target>('ALL');
  const [towerId, setTowerId] = useState<number | null>(null);
  const [recipients, setRecipients] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const towers = useApi<{ towers: Tower[] }>((signal) => api.secretary.towers(signal), []);
  const { mutate, pending, error } = useMutation(api.secretary.broadcast);

  // Refresh the recipient count whenever the audience changes, so the number on
  // the send button is always the one that will actually be messaged.
  useEffect(() => {
    let cancelled = false;
    if (target === 'TOWER' && !towerId) {
      setRecipients(null);
      return;
    }
    (async () => {
      setPreviewError(null);
      try {
        const res = await api.secretary.broadcastPreview(target, towerId ? String(towerId) : undefined);
        if (!cancelled) setRecipients(Number(res?.count ?? 0));
      } catch (err) {
        if (!cancelled) {
          setRecipients(null);
          setPreviewError(errorMessage(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target, towerId]);

  const needsTower = target === 'TOWER' && !towerId;
  const canSend = message.trim().length >= 5 && !needsTower && recipients !== null && recipients > 0 && !pending;

  function confirmSend() {
    const audience =
      target === 'ALL'
        ? 'every resident'
        : target === 'OVERDUE'
          ? 'every resident with an overdue due'
          : `everyone in ${towers.data?.towers.find((t) => t.id === towerId)?.name ?? 'the selected tower'}`;

    Alert.alert(
      `Send to ${recipients} ${recipients === 1 ? 'person' : 'people'}?`,
      `This WhatsApps ${audience} immediately. It cannot be recalled.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send now',
          onPress: async () => {
            const sent = await mutate({
              message: message.trim(),
              target,
              ...(target === 'TOWER' && towerId ? { tower_id: towerId } : {}),
            });
            if (sent) {
              Alert.alert('Broadcast sent', `Your message went to ${recipients} residents.`, [
                { text: 'Done', onPress: () => router.back() },
              ]);
            }
          },
        },
      ],
    );
  }

  return (
    <ScreenScroll keyboardAware>
      <Banner tone="warning" icon="megaphone-outline">
        This sends a WhatsApp message straight to residents' phones. For something that can wait, post
        an announcement instead.
      </Banner>

      <Card>
        <Text style={TYPE.sectionHeader}>Who should receive it?</Text>
        <ChipGroup options={BROADCAST_TARGETS} value={target} onChange={setTarget} style={s.chips} />

        {target === 'TOWER' ? (
          <View style={s.towers}>
            {towers.loading ? (
              <Text style={TYPE.caption}>Loading towers…</Text>
            ) : (towers.data?.towers ?? []).length === 0 ? (
              <Text style={TYPE.caption}>Your society has no towers configured.</Text>
            ) : (
              (towers.data?.towers ?? []).map((t) => {
                const active = t.id === towerId;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setTowerId(t.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [s.tower, active && s.towerActive, pressed && { opacity: 0.7 }]}
                  >
                    <Ionicons
                      name={active ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={active ? COLORS.primary : COLORS.textDisabled}
                    />
                    <Text style={[TYPE.body, s.flex, active && { fontWeight: '600', color: COLORS.textPrimary }]}>
                      {t.name}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>
        ) : null}

        <View style={s.count}>
          <Ionicons
            name={recipients === 0 ? 'alert-circle-outline' : 'people-outline'}
            size={17}
            color={recipients === 0 ? COLORS.warning : COLORS.textSecondary}
          />
          <Text style={[TYPE.rowMeta, s.flex]}>
            {needsTower
              ? 'Choose a tower to see how many residents that reaches.'
              : previewError
                ? previewError
                : recipients === null
                  ? 'Counting recipients…'
                  : recipients === 0
                    ? 'No residents in this audience have a phone number on file.'
                    : `${recipients} resident${recipients === 1 ? '' : 's'} will receive this.`}
          </Text>
        </View>
      </Card>

      <Card>
        <Field
          label="Message"
          required
          value={message}
          onChangeText={setMessage}
          placeholder="e.g. The water tanker arrives at 4pm today. Please store water in advance."
          multiline
          numberOfLines={6}
          hint={`${message.trim().length} characters`}
          editable={!pending}
        />
      </Card>

      {error ? <ErrorNotice message={error} /> : null}

      <Button
        title={recipients && recipients > 0 ? `Send to ${recipients}` : 'Send broadcast'}
        icon="paper-plane-outline"
        onPress={confirmSend}
        loading={pending}
        disabled={!canSend}
        fullWidth
      />
    </ScreenScroll>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  chips: { marginTop: SPACING.md },

  towers: { marginTop: SPACING.md, gap: SPACING.xs },
  tower: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: 44,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  towerActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryTint },

  count: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.lg },
});
