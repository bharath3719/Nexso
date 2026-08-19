/**
 * Resident directory.
 *
 * Primarily a lookup tool: a secretary standing at the gate needs to know who
 * lives in 4B and how to reach them. Tapping a phone number dials it.
 *
 * Search is server-side (?search= matches name, unit or phone) and debounced so
 * typing does not fire a request per keystroke.
 */

import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '../../src/components/Screen';
import { Avatar, Card, Field } from '../../src/components/ui';
import { useApi } from '../../src/hooks/useApi';
import { api } from '../../src/lib/api';
import { COLORS, SPACING } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';
import { formatINRShort } from '../../src/utils/format';

type Resident = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  unit_number: string;
  tower_name: string | null;
  resident_type: string | null;
  maintenance_enabled: boolean | null;
  maintenance_amount: string | null;
};

export default function Residents() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  // 350ms is long enough to skip intermediate keystrokes and short enough that
  // results feel immediate once typing stops.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const state = useApi<{ residents: Resident[] }>(
    (signal) => api.secretary.residents.list(debounced ? { search: debounced } : {}, signal),
    [debounced],
  );

  const residents = state.data?.residents ?? [];

  return (
    <Screen
      state={state}
      isEmpty={(d) => (d.residents ?? []).length === 0}
      empty={{
        icon: 'people-outline',
        title: debounced ? 'No matches' : 'No residents yet',
        message: debounced
          ? `Nothing matches "${debounced}". Try a name, unit number or phone number.`
          : 'Residents are added during society onboarding, or from the admin portal.',
      }}
      header={
        <>
          <Field
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name, unit or phone"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {residents.length > 0 ? (
            <Text style={TYPE.caption}>
              {residents.length} resident{residents.length === 1 ? '' : 's'}
            </Text>
          ) : null}
        </>
      }
    >
      {(data) => (
        <Card padded={false}>
          {(data.residents ?? []).map((r, i, arr) => (
            <View key={r.id} style={[s.row, i < arr.length - 1 && s.divided]}>
              <Avatar name={r.name} size={42} />

              <View style={s.flex}>
                <Text style={TYPE.rowTitle} numberOfLines={1}>
                  {r.name}
                </Text>
                <Text style={TYPE.rowMeta} numberOfLines={1}>
                  {[r.tower_name, r.unit_number].filter(Boolean).join(' · ')}
                  {r.resident_type ? ` · ${r.resident_type}` : ''}
                </Text>
                {r.maintenance_enabled && r.maintenance_amount ? (
                  <Text style={TYPE.caption}>Maintenance {formatINRShort(r.maintenance_amount)}/month</Text>
                ) : null}
              </View>

              {r.phone ? (
                <View style={s.contactActions}>
                  <ContactButton
                    icon="call-outline"
                    label={`Call ${r.name}`}
                    onPress={() => Linking.openURL(`tel:${r.phone}`).catch(() => {})}
                  />
                  <ContactButton
                    icon="logo-whatsapp"
                    label={`WhatsApp ${r.name}`}
                    // The residents table stores a bare 10-digit local number;
                    // wa.me needs the country code, matching toWhatsAppNumber()
                    // in backend/src/routes/auth.js.
                    onPress={() =>
                      Linking.openURL(`https://wa.me/91${String(r.phone).replace(/\D/g, '').slice(-10)}`).catch(
                        () => {},
                      )
                    }
                  />
                </View>
              ) : null}
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

function ContactButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [s.contactButton, pressed && { opacity: 0.6 }]}
    >
      <Ionicons name={icon} size={18} color={COLORS.primary} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  divided: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.divider },

  contactActions: { flexDirection: 'row', gap: SPACING.xs },
  contactButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
