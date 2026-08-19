/**
 * Secretary polls — create, view results, delete.
 *
 * Unlike the resident view, the secretary can see the per-option split: it
 * comes from GET /polls/:id/results, one call per poll. Those are fetched
 * alongside the list so a secretary sees the outcome without tapping into each
 * poll — the whole point of opening this screen.
 */

import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '../../src/components/Screen';
import { Button, Card, ErrorNotice, Field, StatusPill } from '../../src/components/ui';
import { DateTimeField } from '../../src/components/DateTimeField';
import { useApi, useMutation } from '../../src/hooks/useApi';
import { api, errorMessage } from '../../src/lib/api';
import { COLORS, RADIUS, SPACING } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';
import { formatDateShort } from '../../src/utils/format';

type Poll = {
  id: number;
  question: string;
  options: string[];
  closes_at: string | null;
  total_votes: string;
};

type ResultOption = { label: string; index: number; votes: number };

export default function SecretaryPolls() {
  const [composing, setComposing] = useState(false);

  const state = useApi<{ polls: Poll[]; results: Record<number, ResultOption[]> }>(async (signal) => {
    const listed = await api.secretary.polls.list(signal);
    const polls = (listed.polls ?? []) as Poll[];

    // One results call per poll. A society has a handful of polls, so the fan-out
    // is small; a failed one degrades that poll to counts-only rather than
    // failing the screen.
    const settled = await Promise.all(
      polls.map((p) =>
        api.secretary.polls
          .results(p.id, signal)
          .then((r) => [p.id, (r.options ?? []) as ResultOption[]] as const)
          .catch(() => [p.id, [] as ResultOption[]] as const),
      ),
    );

    return { polls, results: Object.fromEntries(settled) };
  }, []);

  function confirmDelete(poll: Poll) {
    Alert.alert('Delete this poll?', `"${poll.question}" and every vote cast on it will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.secretary.polls.delete(poll.id);
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
      isEmpty={(d) => (d.polls ?? []).length === 0 && !composing}
      empty={{
        icon: 'stats-chart-outline',
        title: 'No polls yet',
        message: 'Ask residents to vote on a decision and see the result here.',
        action: <Button title="Create a poll" icon="add" onPress={() => setComposing(true)} />,
      }}
      header={
        composing ? (
          <PollForm
            onCancel={() => setComposing(false)}
            onCreated={async () => {
              setComposing(false);
              await state.refresh();
            }}
          />
        ) : (
          <Button title="Create a poll" icon="add" onPress={() => setComposing(true)} fullWidth />
        )
      }
    >
      {(data) => (
        <View style={s.list}>
          {(data.polls ?? []).map((poll) => {
            const isOpen = !poll.closes_at || new Date(poll.closes_at).getTime() > Date.now();
            const total = Number(poll.total_votes || 0);
            const results = data.results[poll.id] ?? [];
            const leader = results.reduce<ResultOption | null>(
              (best, o) => (best === null || o.votes > best.votes ? o : best),
              null,
            );

            return (
              <Card key={poll.id}>
                <View style={s.head}>
                  <Text style={[TYPE.sectionHeader, s.flex]}>{poll.question}</Text>
                  <StatusPill
                    tone={
                      isOpen
                        ? { bg: COLORS.successTint, fg: '#15803d', label: 'Open' }
                        : { bg: COLORS.cardMuted, fg: COLORS.textSecondary, label: 'Closed' }
                    }
                  />
                </View>

                <Text style={[TYPE.caption, s.meta]}>
                  {total} {total === 1 ? 'vote' : 'votes'}
                  {poll.closes_at ? ` · ${isOpen ? 'closes' : 'closed'} ${formatDateShort(poll.closes_at)}` : ''}
                </Text>

                <View style={s.options}>
                  {(results.length ? results : (poll.options ?? []).map((label, index) => ({ label, index, votes: 0 }))).map(
                    (opt) => {
                      const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
                      const winning = leader !== null && leader.votes > 0 && opt.index === leader.index;
                      return (
                        <View key={opt.index} style={s.option}>
                          <View style={[s.bar, { width: `${pct}%` }, winning && s.barWinning]} />
                          <Text style={[TYPE.body, s.flex, winning && s.optionWinning]} numberOfLines={2}>
                            {opt.label}
                          </Text>
                          <Text style={s.votes}>
                            {opt.votes} · {pct}%
                          </Text>
                        </View>
                      );
                    },
                  )}
                </View>

                <Button
                  title="Delete poll"
                  icon="trash-outline"
                  variant="secondary"
                  onPress={() => confirmDelete(poll)}
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

function PollForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [question, setQuestion] = useState('');
  // Two options is the server-enforced minimum, so the form starts at two.
  const [options, setOptions] = useState(['', '']);
  const [hasDeadline, setHasDeadline] = useState(false);
  const [closesAt, setClosesAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(23, 59, 0, 0);
    return d;
  });

  const { mutate, pending, error } = useMutation(api.secretary.polls.create);

  const filled = options.map((o) => o.trim()).filter(Boolean);
  const canSubmit = question.trim().length > 0 && filled.length >= 2 && !pending;

  function setOption(index: number, value: string) {
    setOptions((current) => current.map((o, i) => (i === index ? value : o)));
  }

  async function submit() {
    if (!canSubmit) return;
    const created = await mutate({
      question: question.trim(),
      options: filled,
      closes_at: hasDeadline ? closesAt.toISOString() : null,
    });
    if (created) onCreated();
  }

  return (
    <Card>
      <Text style={TYPE.sectionHeader}>New poll</Text>
      <View style={s.form}>
        <Field
          label="Question"
          required
          value={question}
          onChangeText={setQuestion}
          placeholder="e.g. Should we repaint the exterior this year?"
          editable={!pending}
        />

        <View style={s.optionFields}>
          <Text style={TYPE.label}>
            Options<Text style={{ color: COLORS.danger }}> *</Text>
          </Text>
          {options.map((option, i) => (
            <View key={i} style={s.optionFieldRow}>
              <Field
                value={option}
                onChangeText={(t) => setOption(i, t)}
                placeholder={`Option ${i + 1}`}
                containerStyle={s.flex}
                editable={!pending}
              />
              {options.length > 2 ? (
                <Pressable
                  onPress={() => setOptions((c) => c.filter((_, idx) => idx !== i))}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove option ${i + 1}`}
                  hitSlop={8}
                  style={s.removeOption}
                >
                  <Ionicons name="close-circle" size={22} color={COLORS.textDisabled} />
                </Pressable>
              ) : null}
            </View>
          ))}

          <Button
            title="Add another option"
            icon="add"
            variant="ghost"
            onPress={() => setOptions((c) => [...c, ''])}
          />
        </View>

        <Pressable
          onPress={() => setHasDeadline((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: hasDeadline }}
          style={({ pressed }) => [s.deadlineRow, pressed && { opacity: 0.7 }]}
        >
          <Ionicons
            name={hasDeadline ? 'checkbox' : 'square-outline'}
            size={21}
            color={hasDeadline ? COLORS.primary : COLORS.textDisabled}
          />
          <View style={s.flex}>
            <Text style={TYPE.rowTitle}>Close voting on a date</Text>
            <Text style={TYPE.caption}>Leave off to keep the poll open indefinitely.</Text>
          </View>
        </Pressable>

        {hasDeadline ? (
          <DateTimeField label="Closes at" value={closesAt} onChange={setClosesAt} minimumDate={new Date()} />
        ) : null}

        {error ? <ErrorNotice message={error} /> : null}

        <View style={s.formActions}>
          <Button title="Cancel" variant="secondary" onPress={onCancel} style={s.flex} />
          <Button title="Create poll" onPress={submit} loading={pending} disabled={!canSubmit} style={s.flex} />
        </View>
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: SPACING.md },

  form: { gap: SPACING.lg, marginTop: SPACING.md },
  formActions: { flexDirection: 'row', gap: SPACING.sm },
  optionFields: { gap: SPACING.sm },
  optionFieldRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  removeOption: { padding: SPACING.xs },
  deadlineRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },

  head: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  meta: { marginTop: SPACING.xs },

  options: { gap: SPACING.sm, marginTop: SPACING.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: 44,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  // Sits behind the label rather than beside it, so a long option keeps the
  // full width instead of being squeezed by its own bar.
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: COLORS.cardMuted },
  barWinning: { backgroundColor: COLORS.primaryTint },
  optionWinning: { fontWeight: '600', color: COLORS.textPrimary },
  votes: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, fontVariant: ['tabular-nums'] },

  deleteAction: { marginTop: SPACING.md, alignSelf: 'flex-start' },
});
