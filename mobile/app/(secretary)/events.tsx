/**
 * Secretary events — list with RSVP counts, create and delete.
 *
 * Creating is inline rather than on its own screen: an event is four fields,
 * and a secretary usually adds one right after deciding on it.
 */

import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '../../src/components/Screen';
import { Button, Card, ErrorNotice, Field } from '../../src/components/ui';
import { DateTimeField } from '../../src/components/DateTimeField';
import { useApi, useMutation } from '../../src/hooks/useApi';
import { api, errorMessage } from '../../src/lib/api';
import { COLORS, RADIUS, SPACING } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';
import { formatDateTime } from '../../src/utils/format';

type EventRow = {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  event_date: string;
  rsvp_total: string;
  rsvp_yes: string;
  rsvp_no: string;
  rsvp_maybe: string;
};

export default function SecretaryEvents() {
  const state = useApi<{ events: EventRow[] }>((signal) => api.secretary.events.list(signal), []);
  const [composing, setComposing] = useState(false);

  function confirmDelete(event: EventRow) {
    Alert.alert('Delete this event?', `"${event.title}" and its RSVPs will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.secretary.events.delete(event.id);
            await state.refresh();
          } catch (err) {
            Alert.alert('Could not delete', errorMessage(err));
          }
        },
      },
    ]);
  }

  return (
    <Screen
      state={state}
      isEmpty={(d) => (d.events ?? []).length === 0 && !composing}
      empty={{
        icon: 'calendar-outline',
        title: 'No events scheduled',
        message: 'Add a society meeting, festival or maintenance visit and residents can RSVP.',
        action: <Button title="Add an event" icon="add" onPress={() => setComposing(true)} />,
      }}
      header={
        composing ? (
          <EventForm
            onCancel={() => setComposing(false)}
            onCreated={async () => {
              setComposing(false);
              await state.refresh();
            }}
          />
        ) : (
          <Button title="Add an event" icon="add" onPress={() => setComposing(true)} fullWidth />
        )
      }
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
                      {new Date(event.event_date).toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()}
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

                <View style={s.rsvps}>
                  <RsvpCount label="Going" value={event.rsvp_yes} color={COLORS.success} />
                  <RsvpCount label="Maybe" value={event.rsvp_maybe} color={COLORS.warning} />
                  <RsvpCount label="Not going" value={event.rsvp_no} color={COLORS.textSecondary} />
                </View>

                <Button
                  title="Delete event"
                  icon="trash-outline"
                  variant="secondary"
                  onPress={() => confirmDelete(event)}
                  style={s.deleteAction}
                />
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

function EventForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  // Defaults to 6pm tomorrow — society events are almost always evenings.
  const [when, setWhen] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(18, 0, 0, 0);
    return d;
  });

  const { mutate, pending, error } = useMutation(api.secretary.events.create);

  async function submit() {
    if (!title.trim()) return;
    const created = await mutate({
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      event_date: when.toISOString(),
    });
    if (created) onCreated();
  }

  return (
    <Card>
      <Text style={TYPE.sectionHeader}>New event</Text>
      <View style={s.form}>
        <Field
          label="Title"
          required
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Annual General Meeting"
          editable={!pending}
        />
        <DateTimeField label="Date and time" required value={when} onChange={setWhen} />
        <Field
          label="Location"
          value={location}
          onChangeText={setLocation}
          placeholder="e.g. Clubhouse, Tower A"
          editable={!pending}
        />
        <Field
          label="Details"
          value={description}
          onChangeText={setDescription}
          placeholder="What is on the agenda, what should residents bring?"
          multiline
          numberOfLines={4}
          editable={!pending}
        />

        {error ? <ErrorNotice message={error} /> : null}

        <View style={s.formActions}>
          <Button title="Cancel" variant="secondary" onPress={onCancel} style={s.flex} />
          <Button
            title="Create event"
            onPress={submit}
            loading={pending}
            disabled={!title.trim()}
            style={s.flex}
          />
        </View>
      </View>
    </Card>
  );
}

function RsvpCount({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={s.rsvpCount}>
      <Text style={[s.rsvpValue, { color }]}>{value || 0}</Text>
      <Text style={TYPE.caption}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: SPACING.md },
  pastCard: { opacity: 0.72 },

  form: { gap: SPACING.lg, marginTop: SPACING.md },
  formActions: { flexDirection: 'row', gap: SPACING.sm },

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

  rsvps: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.divider,
  },
  rsvpCount: { flex: 1, alignItems: 'center', gap: 2 },
  rsvpValue: { fontSize: 19, lineHeight: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },

  deleteAction: { marginTop: SPACING.md, alignSelf: 'flex-start' },
});
