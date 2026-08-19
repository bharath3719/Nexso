/**
 * Create a visitor pass.
 *
 * Most passes are for "someone coming today", so the validity window defaults to
 * now → +8 hours and offers one-tap presets. The pickers are there for the rest.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenScroll } from '../../src/components/Screen';
import { Button, Card, ChipGroup, ErrorNotice, Field } from '../../src/components/ui';
import { DateTimeField } from '../../src/components/DateTimeField';
import { useMutation } from '../../src/hooks/useApi';
import { api } from '../../src/lib/api';
import { validatePhone } from '../../src/utils/validation';
import { SPACING } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';

const HOUR_MS = 60 * 60 * 1000;

/** Common windows, so the usual case needs no picker at all. */
const PRESETS = [
  { value: '8h', label: 'Next 8 hours', hours: 8 },
  { value: '24h', label: 'Next 24 hours', hours: 24 },
  { value: '3d', label: 'Next 3 days', hours: 72 },
  { value: 'custom', label: 'Custom', hours: 0 },
] as const;

export default function NewPass() {
  const router = useRouter();

  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [purpose, setPurpose] = useState('');
  const [vehicle, setVehicle] = useState('');

  const [preset, setPreset] = useState<(typeof PRESETS)[number]['value']>('8h');
  const [validFrom, setValidFrom] = useState(() => new Date());
  const [validUntil, setValidUntil] = useState(() => new Date(Date.now() + 8 * HOUR_MS));

  const [touched, setTouched] = useState(false);
  const { mutate, pending, error } = useMutation(api.resident.visitorPasses.create);

  function applyPreset(next: (typeof PRESETS)[number]['value']) {
    setPreset(next);
    const chosen = PRESETS.find((p) => p.value === next);
    if (!chosen || chosen.value === 'custom') return;
    const from = new Date();
    setValidFrom(from);
    setValidUntil(new Date(from.getTime() + chosen.hours * HOUR_MS));
  }

  const nameError = touched && !visitorName.trim() ? "Enter the visitor's name" : null;
  const phoneError = touched ? validatePhone(visitorPhone) : null;
  // Mirrors the backend's own guard in routes/resident.js, so an impossible
  // window is caught before the round trip rather than as a raw 400.
  const windowError = validUntil <= validFrom ? 'The end time must be after the start time' : null;

  const canSubmit = visitorName.trim().length > 0 && !phoneError && !windowError && !pending;

  async function handleSubmit() {
    setTouched(true);
    if (!visitorName.trim() || validatePhone(visitorPhone) || windowError) return;

    const created = await mutate({
      visitor_name: visitorName.trim(),
      visitor_phone: visitorPhone.trim() || null,
      purpose: purpose.trim() || null,
      vehicle: vehicle.trim() || null,
      valid_from: validFrom.toISOString(),
      valid_until: validUntil.toISOString(),
    });

    // The visitors list refetches on focus, so going back is enough to show it.
    if (created) router.back();
  }

  return (
    <ScreenScroll keyboardAware>
      <Card>
        <Text style={TYPE.sectionHeader}>Who is visiting?</Text>
        <View style={s.form}>
          <Field
            label="Visitor name"
            required
            value={visitorName}
            onChangeText={setVisitorName}
            error={nameError}
            placeholder="e.g. Ramesh Kumar"
            autoCapitalize="words"
            editable={!pending}
          />
          <Field
            label="Mobile number"
            value={visitorPhone}
            onChangeText={setVisitorPhone}
            error={phoneError}
            placeholder="9876543210"
            keyboardType="phone-pad"
            maxLength={14}
            hint="Optional — helps the guard reach them"
            editable={!pending}
          />
          <Field
            label="Purpose"
            value={purpose}
            onChangeText={setPurpose}
            placeholder="e.g. Family visit, delivery, plumber"
            editable={!pending}
          />
          <Field
            label="Vehicle number"
            value={vehicle}
            onChangeText={setVehicle}
            placeholder="e.g. KA 01 AB 1234"
            autoCapitalize="characters"
            hint="Optional — for gate parking records"
            editable={!pending}
          />
        </View>
      </Card>

      <Card>
        <Text style={TYPE.sectionHeader}>When are they coming?</Text>
        <View style={s.form}>
          <ChipGroup options={PRESETS} value={preset} onChange={applyPreset} />

          <DateTimeField
            label="Valid from"
            required
            value={validFrom}
            onChange={(d) => {
              setValidFrom(d);
              setPreset('custom');
            }}
          />
          <DateTimeField
            label="Valid until"
            required
            value={validUntil}
            minimumDate={validFrom}
            error={windowError}
            onChange={(d) => {
              setValidUntil(d);
              setPreset('custom');
            }}
          />
        </View>
      </Card>

      {error ? <ErrorNotice message={error} /> : null}

      <Button title="Create pass" onPress={handleSubmit} loading={pending} disabled={!canSubmit} fullWidth />
    </ScreenScroll>
  );
}

const s = StyleSheet.create({
  form: { gap: SPACING.lg, marginTop: SPACING.md },
});
