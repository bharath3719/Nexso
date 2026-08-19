/**
 * DateTimeField — a tappable field that opens the platform date/time pickers.
 *
 * The native picker only handles one of date or time per invocation on Android,
 * so picking a moment is a two-step sequence: date dialog, then time dialog.
 * iOS gets a single inline spinner. That difference is contained here so callers
 * just get `value` and `onChange`.
 */

import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING } from '../theme/tokens';
import { TYPE } from '../theme/type';
import { Button } from './ui';
import { formatDateTime } from '../utils/format';

export function DateTimeField({
  label,
  value,
  onChange,
  minimumDate,
  error,
  hint,
  required,
}: {
  label: string;
  value: Date;
  onChange: (next: Date) => void;
  minimumDate?: Date;
  error?: string | null;
  hint?: string;
  required?: boolean;
}) {
  // Android runs date → time in sequence; iOS shows one sheet with both.
  const [androidStage, setAndroidStage] = useState<'date' | 'time' | null>(null);
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  function open() {
    setDraft(value);
    if (Platform.OS === 'android') setAndroidStage('date');
    else setIosOpen(true);
  }

  function handleAndroidChange(event: DateTimePickerEvent, selected?: Date) {
    if (event.type === 'dismissed' || !selected) {
      setAndroidStage(null);
      return;
    }

    if (androidStage === 'date') {
      // Carry the existing time across so choosing a date does not silently
      // reset the clock to midnight.
      const merged = new Date(selected);
      merged.setHours(draft.getHours(), draft.getMinutes(), 0, 0);
      setDraft(merged);
      setAndroidStage('time');
      return;
    }

    const merged = new Date(draft);
    merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    setAndroidStage(null);
    onChange(merged);
  }

  return (
    <View style={s.field}>
      <Text style={TYPE.label}>
        {label}
        {required ? <Text style={{ color: COLORS.danger }}> *</Text> : null}
      </Text>

      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatDateTime(value.toISOString())}. Tap to change.`}
        style={({ pressed }) => [s.control, !!error && s.controlError, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="calendar-outline" size={17} color={COLORS.textSecondary} />
        <Text style={[TYPE.body, s.value]}>{formatDateTime(value.toISOString())}</Text>
        <Ionicons name="chevron-down" size={16} color={COLORS.textMuted} />
      </Pressable>

      {error ? (
        <Text style={[TYPE.caption, { color: COLORS.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={TYPE.caption}>{hint}</Text>
      ) : null}

      {Platform.OS === 'android' && androidStage ? (
        <DateTimePicker
          value={draft}
          mode={androidStage}
          minimumDate={androidStage === 'date' ? minimumDate : undefined}
          onChange={handleAndroidChange}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <Pressable style={s.backdrop} onPress={() => setIosOpen(false)} />
          <View style={s.sheet}>
            <Text style={TYPE.sectionHeader}>{label}</Text>
            <DateTimePicker
              value={draft}
              mode="datetime"
              display="spinner"
              minimumDate={minimumDate}
              onChange={(_e, selected) => selected && setDraft(selected)}
            />
            <View style={s.sheetActions}>
              <Button title="Cancel" variant="secondary" onPress={() => setIosOpen(false)} style={s.flex} />
              <Button
                title="Done"
                onPress={() => {
                  onChange(draft);
                  setIosOpen(false);
                }}
                style={s.flex}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  field: { gap: SPACING.xs },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: 46,
    paddingHorizontal: SPACING.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.borderStrong,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.card,
  },
  controlError: { borderColor: COLORS.danger, backgroundColor: COLORS.dangerTint },
  value: { flex: 1, color: COLORS.textPrimary },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)' },
  sheet: {
    backgroundColor: COLORS.card,
    padding: SPACING.xl,
    paddingBottom: SPACING.xxxl,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    gap: SPACING.md,
  },
  sheetActions: { flexDirection: 'row', gap: SPACING.sm },
});
