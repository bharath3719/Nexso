/**
 * Resident profile.
 *
 * Name, phone and unit are set by the society during onboarding and are
 * read-only here — a resident renaming themselves would desynchronise the
 * society's own records. Everything else is theirs to edit.
 *
 * PATCH /api/resident/profile also clears force_profile_setup, which is how a
 * first-time resident completes setup.
 */

import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { ScreenScroll } from '../../src/components/Screen';
import { Banner, Button, Card, ErrorNotice, Field, InfoRow, Loading } from '../../src/components/ui';
import { useApi, useMutation } from '../../src/hooks/useApi';
import { api } from '../../src/lib/api';
import { useAuth, useSession } from '../../src/lib/auth';
import { validateEmail } from '../../src/utils/validation';
import { COLORS, SPACING } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';

type Profile = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  preferred_contact: string | null;
  bhk: string | null;
  resident_type: string | null;
  family_members: number | null;
  vehicles: string[] | null;
  emergency_contact: { name?: string; phone?: string } | null;
};

export default function ResidentProfile() {
  const session = useSession();
  const { patchSession } = useAuth();
  const state = useApi<{ profile: Profile }>((signal) => api.resident.profile(signal), []);

  const [email, setEmail] = useState('');
  const [bhk, setBhk] = useState('');
  const [familyMembers, setFamilyMembers] = useState('');
  const [vehicles, setVehicles] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [dirty, setDirty] = useState(false);

  const { mutate, pending, error } = useMutation(api.resident.updateProfile);

  // Seed the form once the profile arrives. Guarded on `dirty` so a background
  // refetch cannot overwrite edits the resident is part-way through.
  useEffect(() => {
    const p = state.data?.profile;
    if (!p || dirty) return;
    setEmail(p.email ?? '');
    setBhk(p.bhk ?? '');
    setFamilyMembers(p.family_members != null ? String(p.family_members) : '');
    setVehicles(Array.isArray(p.vehicles) ? p.vehicles.join(', ') : '');
    setEmergencyName(p.emergency_contact?.name ?? '');
    setEmergencyPhone(p.emergency_contact?.phone ?? '');
  }, [state.data, dirty]);

  const emailError = validateEmail(email);

  function edit<T>(setter: (v: T) => void) {
    return (value: T) => {
      setDirty(true);
      setter(value);
    };
  }

  async function handleSave() {
    if (emailError) return;

    const saved = await mutate({
      email: email.trim() || null,
      bhk: bhk.trim() || null,
      family_members: familyMembers.trim() ? Number(familyMembers) : null,
      // Comma-separated in the UI, an array on the wire — the endpoint rejects
      // anything that is not an array.
      vehicles: vehicles
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
      emergency_contact:
        emergencyName.trim() || emergencyPhone.trim()
          ? { name: emergencyName.trim(), phone: emergencyPhone.trim() }
          : null,
    });

    if (saved) {
      setDirty(false);
      // The PATCH clears force_profile_setup server-side; mirror it locally.
      if (session.forceProfileSetup) await patchSession({ forceProfileSetup: false });
      await state.refresh();
      Alert.alert('Profile saved', 'Your details have been updated.');
    }
  }

  if (state.loading && !state.data) return <Loading />;

  const profile = state.data?.profile;

  return (
    <ScreenScroll keyboardAware refreshing={state.refreshing} onRefresh={state.refresh}>
      {state.error ? <ErrorNotice message={state.error} onRetry={state.reload} /> : null}

      {session.forceProfileSetup ? (
        <Banner tone="info">
          Welcome to Nexso. Fill in a few details so your society can reach you — you only need to do
          this once.
        </Banner>
      ) : null}

      <Card>
        <Text style={TYPE.sectionHeader}>Your society record</Text>
        <Text style={[TYPE.caption, s.readonlyNote]}>
          Set by your society. Contact your secretary if any of it is wrong.
        </Text>
        <View style={s.info}>
          <InfoRow label="Name" value={profile?.name ?? session.name} />
          <InfoRow label="Mobile" value={profile?.phone ?? session.username} />
          <InfoRow label="Society" value={session.societyName} />
          <InfoRow label="Unit" value={session.unitNumber} />
          <InfoRow label="Type" value={profile?.resident_type ?? '—'} />
        </View>
      </Card>

      <Card>
        <Text style={TYPE.sectionHeader}>Your details</Text>
        <View style={s.form}>
          <Field
            label="Email"
            value={email}
            onChangeText={edit(setEmail)}
            error={emailError}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            hint="Used for maintenance bills and receipts"
            editable={!pending}
          />
          <Field
            label="Flat configuration"
            value={bhk}
            onChangeText={edit(setBhk)}
            placeholder="e.g. 2BHK"
            autoCapitalize="characters"
            editable={!pending}
          />
          <Field
            label="Family members"
            value={familyMembers}
            onChangeText={edit((t: string) => setFamilyMembers(t.replace(/\D/g, '')))}
            placeholder="4"
            keyboardType="number-pad"
            maxLength={2}
            editable={!pending}
          />
          <Field
            label="Vehicles"
            value={vehicles}
            onChangeText={edit(setVehicles)}
            placeholder="KA 01 AB 1234, KA 05 XY 9876"
            autoCapitalize="characters"
            hint="Separate multiple vehicles with a comma"
            editable={!pending}
          />
        </View>
      </Card>

      <Card>
        <Text style={TYPE.sectionHeader}>Emergency contact</Text>
        <Text style={[TYPE.caption, s.readonlyNote]}>
          Who your society should call if they cannot reach you.
        </Text>
        <View style={s.form}>
          <Field
            label="Name"
            value={emergencyName}
            onChangeText={edit(setEmergencyName)}
            placeholder="e.g. Priya Sharma"
            autoCapitalize="words"
            editable={!pending}
          />
          <Field
            label="Mobile"
            value={emergencyPhone}
            onChangeText={edit(setEmergencyPhone)}
            placeholder="9876543210"
            keyboardType="phone-pad"
            maxLength={14}
            editable={!pending}
          />
        </View>
      </Card>

      {error ? <ErrorNotice message={error} /> : null}

      <Button
        title={dirty ? 'Save changes' : 'Saved'}
        onPress={handleSave}
        loading={pending}
        disabled={!dirty || !!emailError}
        fullWidth
      />
    </ScreenScroll>
  );
}

const s = StyleSheet.create({
  readonlyNote: { marginTop: SPACING.xs },
  info: { marginTop: SPACING.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.divider },
  form: { gap: SPACING.lg, marginTop: SPACING.md },
});
