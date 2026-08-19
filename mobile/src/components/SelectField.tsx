/**
 * SelectField — a tappable field that opens a bottom sheet of options.
 *
 * The web renders these as <select>. React Native has no equivalent: the
 * community Picker is a wheel on iOS and an alien dropdown on Android, and
 * ChipGroup (src/components/ui.tsx) stops working once the list is longer than
 * a few short labels — "Advertisement / Tower / Hoarding Rental" is not a chip.
 * So anything with more than a handful of options, or with long labels, comes
 * through here instead.
 *
 * Deliberately not searchable: the longest list this opens is ten items.
 */

import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING } from '../theme/tokens';
import { TYPE } from '../theme/type';

export type SelectOption = { value: string; label: string };

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  required,
  error,
  hint,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<SelectOption>;
  placeholder?: string;
  required?: boolean;
  error?: string | null;
  hint?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const selected = options.find((o) => o.value === value);
  // An empty option list means the parent choice has no children (a category
  // with no sub-categories). Showing an openable field that reveals nothing is
  // worse than showing a disabled one.
  const isDisabled = disabled || options.length === 0;

  return (
    <View style={s.field}>
      <Text style={TYPE.label}>
        {label}
        {required ? <Text style={{ color: COLORS.danger }}> *</Text> : null}
      </Text>

      <Pressable
        onPress={() => !isDisabled && setOpen(true)}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, expanded: open }}
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}. Tap to change.`}
        style={({ pressed }) => [
          s.control,
          !!error && s.controlError,
          isDisabled && s.controlDisabled,
          pressed && !isDisabled && { opacity: 0.7 },
        ]}
      >
        <Text style={[TYPE.body, selected ? s.value : s.placeholder]} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={COLORS.textMuted} />
      </Pressable>

      {error ? (
        <Text style={[TYPE.caption, { color: COLORS.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={TYPE.caption}>{hint}</Text>
      ) : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + SPACING.lg }]}>
          <View style={s.sheetHead}>
            <Text style={TYPE.sectionHeader}>{label}</Text>
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={s.list} bounces={false}>
            {options.map((opt, i) => {
              const active = opt.value === value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    s.option,
                    i < options.length - 1 && s.optionDivided,
                    pressed && { backgroundColor: COLORS.cardMuted },
                  ]}
                >
                  <Text style={[TYPE.body, s.optionLabel, active && s.optionLabelActive]}>{opt.label}</Text>
                  {active ? <Ionicons name="checkmark" size={19} color={COLORS.primary} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
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
  controlDisabled: { backgroundColor: COLORS.cardMuted },
  value: { flex: 1, color: COLORS.textPrimary },
  placeholder: { flex: 1, color: COLORS.textDisabled },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)' },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    // Caps the sheet so a ten-item list cannot push the handle off screen.
    maxHeight: '70%',
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.divider,
  },
  list: { flexGrow: 0 },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    minHeight: 50,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  optionDivided: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.divider },
  optionLabel: { flex: 1, color: COLORS.textBody },
  optionLabelActive: { color: COLORS.primary, fontWeight: '600' },
});
