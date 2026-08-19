/**
 * Raise a complaint.
 *
 * Creates an OPEN ticket against this resident's unit. Category is a tile grid
 * rather than a dropdown — eight fixed options fit on one screen and pick in one
 * tap, where a Picker on Android costs a modal.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenScroll } from '../../src/components/Screen';
import { Banner, Button, Card, ErrorNotice, Field } from '../../src/components/ui';
import { useMutation } from '../../src/hooks/useApi';
import { api } from '../../src/lib/api';
import { CATEGORY_ICON, COMPLAINT_CATEGORIES, PRIORITIES } from '../../src/constants';
import { COLORS, RADIUS, SPACING } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';

export default function NewComplaint() {
  const router = useRouter();

  const [category, setCategory] = useState<string>(COMPLAINT_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<string>('NORMAL');
  const [touched, setTouched] = useState(false);

  const { mutate, pending, error } = useMutation(api.resident.complaints.create);

  const descriptionError =
    touched && description.trim().length < 10
      ? 'Describe the problem in a little more detail (at least 10 characters)'
      : null;

  const canSubmit = description.trim().length >= 10 && !pending;

  async function handleSubmit() {
    setTouched(true);
    if (description.trim().length < 10) return;

    const created = await mutate({ category, description: description.trim(), priority });
    if (created) router.back();
  }

  return (
    <ScreenScroll keyboardAware>
      <Card>
        <Text style={TYPE.sectionHeader}>What is the problem about?</Text>
        <View style={s.grid}>
          {COMPLAINT_CATEGORIES.map((c) => {
            const active = c === category;
            return (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [s.tile, active && s.tileActive, pressed && { opacity: 0.7 }]}
              >
                <Ionicons
                  name={(CATEGORY_ICON[c] ?? 'help-circle-outline') as never}
                  size={21}
                  color={active ? COLORS.primary : COLORS.textSecondary}
                />
                <Text style={[s.tileLabel, active && s.tileLabelActive]} numberOfLines={2}>
                  {c}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text style={TYPE.sectionHeader}>Tell us what is wrong</Text>
        <View style={s.form}>
          <Field
            value={description}
            onChangeText={setDescription}
            error={descriptionError}
            placeholder="e.g. The kitchen tap has been leaking since Tuesday and the floor stays wet."
            hint="Include where it is and how long it has been happening."
            multiline
            numberOfLines={5}
            editable={!pending}
          />

          <View>
            <Text style={TYPE.label}>How urgent is it?</Text>
            <View style={s.priorityRow}>
              {PRIORITIES.map((p) => {
                const active = p.value === priority;
                const isUrgent = p.value === 'URGENT';
                return (
                  <Pressable
                    key={p.value}
                    onPress={() => setPriority(p.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [
                      s.priority,
                      active && (isUrgent ? s.priorityUrgent : s.priorityNormal),
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Ionicons
                      name={isUrgent ? 'alert-circle-outline' : 'time-outline'}
                      size={17}
                      color={active ? (isUrgent ? COLORS.danger : COLORS.primary) : COLORS.textSecondary}
                    />
                    <Text
                      style={[
                        s.priorityLabel,
                        active && { color: isUrgent ? COLORS.danger : COLORS.primary },
                      ]}
                    >
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {priority === 'URGENT' ? (
            <Banner tone="warning">
              Urgent complaints are escalated to your secretary straight away. Please reserve this for
              safety issues, water or power failures, and lift breakdowns.
            </Banner>
          ) : null}
        </View>
      </Card>

      {error ? <ErrorNotice message={error} /> : null}

      <Button title="Submit complaint" onPress={handleSubmit} loading={pending} disabled={!canSubmit} fullWidth />
    </ScreenScroll>
  );
}

const s = StyleSheet.create({
  form: { gap: SPACING.lg, marginTop: SPACING.md },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md },
  tile: {
    width: '31%',
    minHeight: 78,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardMuted,
  },
  tileActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryTint },
  tileLabel: { fontSize: 11.5, lineHeight: 15, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'center' },
  tileLabelActive: { color: COLORS.primaryDark },

  priorityRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
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
});
