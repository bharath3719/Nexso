/**
 * Post an announcement.
 *
 * priority is constrained by a DB CHECK to NORMAL | URGENT, so those are the
 * only two offered.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenScroll } from '../../src/components/Screen';
import { Banner, Button, Card, ChipGroup, ErrorNotice, Field } from '../../src/components/ui';
import { useMutation } from '../../src/hooks/useApi';
import { api } from '../../src/lib/api';
import { COLORS, RADIUS, SPACING } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';

/** announcements.category defaults to 'GENERAL' server-side. */
const CATEGORIES = [
  { value: 'GENERAL', label: 'General' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'EVENT', label: 'Event' },
] as const;

export default function NewAnnouncement() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<string>('GENERAL');
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [pinned, setPinned] = useState(false);
  const [touched, setTouched] = useState(false);

  const { mutate, pending, error } = useMutation(api.secretary.announcements.create);

  const titleError = touched && !title.trim() ? 'Give the announcement a title' : null;
  const bodyError = touched && body.trim().length < 10 ? 'Write at least a sentence' : null;
  const canSubmit = title.trim().length > 0 && body.trim().length >= 10 && !pending;

  async function handleSubmit() {
    setTouched(true);
    if (!title.trim() || body.trim().length < 10) return;

    const created = await mutate({
      title: title.trim(),
      body: body.trim(),
      category,
      priority,
      pinned,
    });
    if (created) router.back();
  }

  return (
    <ScreenScroll keyboardAware>
      <Card>
        <View style={s.form}>
          <Field
            label="Title"
            required
            value={title}
            onChangeText={setTitle}
            error={titleError}
            placeholder="e.g. Water supply interrupted on Thursday"
            editable={!pending}
          />
          <Field
            label="Message"
            required
            value={body}
            onChangeText={setBody}
            error={bodyError}
            placeholder="Tell residents what is happening, when, and what they should do."
            multiline
            numberOfLines={6}
            editable={!pending}
          />
        </View>
      </Card>

      <Card>
        <Text style={TYPE.sectionHeader}>Category</Text>
        <ChipGroup options={CATEGORIES} value={category} onChange={setCategory} style={s.chips} />
      </Card>

      <Card>
        <Text style={TYPE.sectionHeader}>Priority</Text>
        <View style={s.priorityRow}>
          {(['NORMAL', 'URGENT'] as const).map((p) => {
            const active = priority === p;
            const isUrgent = p === 'URGENT';
            return (
              <Pressable
                key={p}
                onPress={() => setPriority(p)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  s.priority,
                  active && (isUrgent ? s.priorityUrgent : s.priorityNormal),
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons
                  name={isUrgent ? 'alert-circle-outline' : 'information-circle-outline'}
                  size={17}
                  color={active ? (isUrgent ? COLORS.danger : COLORS.primary) : COLORS.textSecondary}
                />
                <Text style={[s.priorityLabel, active && { color: isUrgent ? COLORS.danger : COLORS.primary }]}>
                  {isUrgent ? 'Urgent' : 'Normal'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => setPinned((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: pinned }}
          style={({ pressed }) => [s.pinRow, pressed && { opacity: 0.7 }]}
        >
          <Ionicons
            name={pinned ? 'checkbox' : 'square-outline'}
            size={21}
            color={pinned ? COLORS.primary : COLORS.textDisabled}
          />
          <View style={s.flex}>
            <Text style={TYPE.rowTitle}>Pin to the top</Text>
            <Text style={TYPE.caption}>Keeps it above other notices until you unpin it.</Text>
          </View>
        </Pressable>
      </Card>

      {priority === 'URGENT' ? (
        <Banner tone="warning">
          Urgent notices are highlighted in every resident's app. Reserve them for things that need
          attention today.
        </Banner>
      ) : null}

      {error ? <ErrorNotice message={error} /> : null}

      <Button title="Post announcement" onPress={handleSubmit} loading={pending} disabled={!canSubmit} fullWidth />
    </ScreenScroll>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  form: { gap: SPACING.lg },
  chips: { marginTop: SPACING.md },

  priorityRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  priority: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    minHeight: 46,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  priorityNormal: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryTint },
  priorityUrgent: { borderColor: COLORS.danger, backgroundColor: COLORS.dangerTint },
  priorityLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },

  pinRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginTop: SPACING.lg },
});
