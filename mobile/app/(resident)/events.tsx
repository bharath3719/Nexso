/**
 * Society events with RSVP.
 *
 * RSVPs are optimistic: the row updates on tap and rolls back if the request
 * fails. Waiting for a round trip before a chip highlights makes the tap feel
 * broken on a slow connection.
 */

import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/ui';
import { useApi } from '../../src/hooks/useApi';
import { api, errorMessage } from '../../src/lib/api';
import { RSVP_OPTIONS } from '../../src/constants';
import { COLORS, RADIUS, SPACING } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';
import { formatDateTime } from '../../src/utils/format';

type EventRow = {
  id: number;
  title: string;
  description: string | null;
  /** society_events.location — the column is `location`, not `venue`. */
  location: string | null;
  event_date: string;
  my_response: string | null;
  rsvp_yes: string;
  rsvp_no: string;
  rsvp_maybe: string;
};

export default function Events() {
  const state = useApi<{ events: EventRow[] }>((signal) => api.resident.events.list(signal), []);
  const [saving, setSaving] = useState<number | null>(null);

  async function handleRsvp(event: EventRow, response: string) {
    const previous = event.my_response;
    setSaving(event.id);

    // Optimistic: patch the row in place, keeping the aggregate counts honest
    // by moving this resident's vote between buckets.
    state.setData((current) => {
      if (!current) return current;
      return {
        events: current.events.map((e) =>
          e.id === event.id ? { ...e, ...shiftCounts(e, previous, response) } : e,
        ),
      };
    });

    try {
      await api.resident.events.rsvp(event.id, response);
    } catch (err) {
      state.setData((current) => {
        if (!current) return current;
        return {
          events: current.events.map((e) =>
            e.id === event.id ? { ...e, ...shiftCounts(e, response, previous) } : e,
          ),
        };
      });
      Alert.alert('Could not save your RSVP', errorMessage(err));
    } finally {
      setSaving(null);
    }
  }

  return (
    <Screen
      state={state}
      isEmpty={(d) => (d.events ?? []).length === 0}
      empty={{
        icon: 'calendar-outline',
        title: 'No events scheduled',
        message: 'Society gatherings, meetings and festivals will show up here.',
      }}
    >
      {(data) => (
        <View style={s.list}>
          {(data.events ?? []).map((event) => {
            const isPast = new Date(event.event_date).getTime() < Date.now();
            return (
              <Card key={event.id} style={isPast ? s.pastCard : undefined}>
                <View style={s.head}>
                  <View style={[s.dateChip, isPast && s.dateChipPast]}>
                    <Text style={s.dateDay}>{new Date(event.event_date).getDate()}</Text>
                    <Text style={s.dateMonth}>
                      {new Date(event.event_date)
                        .toLocaleDateString('en-IN', { month: 'short' })
                        .toUpperCase()}
                    </Text>
                  </View>
                  <View style={s.flex}>
                    <Text style={TYPE.sectionHeader} numberOfLines={2}>
                      {event.title}
                    </Text>
                    <Text style={TYPE.rowMeta}>{formatDateTime(event.event_date)}</Text>
                    {event.location ? (
                      <View style={s.venue}>
                        <Ionicons name="location-outline" size={14} color={COLORS.textMuted} />
                        <Text style={[TYPE.caption, s.flex]} numberOfLines={1}>
                          {event.location}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {event.description ? (
                  <Text style={[TYPE.body, s.description]}>{event.description}</Text>
                ) : null}

                <View style={s.counts}>
                  <Text style={TYPE.caption}>
                    {event.rsvp_yes || 0} going · {event.rsvp_maybe || 0} maybe · {event.rsvp_no || 0} not going
                  </Text>
                </View>

                {isPast ? (
                  <Text style={[TYPE.caption, s.pastNote]}>This event has already taken place.</Text>
                ) : (
                  <View style={s.rsvpRow}>
                    {RSVP_OPTIONS.map((opt) => {
                      const active = event.my_response === opt.value;
                      return (
                        <Pressable
                          key={opt.value}
                          onPress={() => handleRsvp(event, opt.value)}
                          disabled={saving === event.id}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: active }}
                          style={({ pressed }) => [
                            s.rsvp,
                            active && s.rsvpActive,
                            pressed && { opacity: 0.7 },
                            saving === event.id && { opacity: 0.5 },
                          ]}
                        >
                          <Ionicons
                            name={opt.icon as never}
                            size={16}
                            color={active ? COLORS.primary : COLORS.textMuted}
                          />
                          <Text style={[s.rsvpLabel, active && { color: COLORS.primaryDark }]}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

/**
 * Moves this resident's vote from one bucket to another so the displayed totals
 * stay correct between the optimistic update and the next refetch.
 */
function shiftCounts(event: EventRow, from: string | null, to: string | null): Partial<EventRow> {
  const key = (r: string | null) =>
    r === 'YES' ? 'rsvp_yes' : r === 'NO' ? 'rsvp_no' : r === 'MAYBE' ? 'rsvp_maybe' : null;

  const patch: Partial<EventRow> = { my_response: to };
  const fromKey = key(from);
  const toKey = key(to);
  if (fromKey === toKey) return patch;

  if (fromKey) patch[fromKey] = String(Math.max(0, Number(event[fromKey] || 0) - 1));
  if (toKey) patch[toKey] = String(Number(event[toKey] || 0) + 1);
  return patch;
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: SPACING.md },
  pastCard: { opacity: 0.72 },

  head: { flexDirection: 'row', gap: SPACING.md },
  dateChip: {
    width: 52,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryTint,
    alignItems: 'center',
  },
  dateChipPast: { backgroundColor: COLORS.cardMuted },
  dateDay: { fontSize: 20, lineHeight: 24, fontWeight: '700', color: COLORS.primaryDark },
  dateMonth: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 0.6 },

  venue: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: 2 },
  description: { marginTop: SPACING.md },
  counts: { marginTop: SPACING.md },
  pastNote: { marginTop: SPACING.md },

  rsvpRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  rsvp: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    minHeight: 42,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  rsvpActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryTint },
  rsvpLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
});
