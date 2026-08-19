/**
 * Society polls.
 *
 * Results are only revealed once this resident has voted, or once the poll has
 * closed — showing the running tally to someone who has not voted yet nudges
 * their answer.
 */

import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Card, StatusPill } from '../../src/components/ui';
import { useApi } from '../../src/hooks/useApi';
import { api, errorMessage } from '../../src/lib/api';
import { COLORS, RADIUS, SPACING } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';
import { formatDateShort } from '../../src/utils/format';

type Poll = {
  id: number;
  question: string;
  options: string[];
  closes_at: string | null;
  is_open: boolean;
  total_votes: string;
  my_vote: number | null;
  /** Per-option tallies, present only on some responses — treated as optional. */
  results?: number[] | null;
};

export default function Polls() {
  const state = useApi<{ polls: Poll[] }>((signal) => api.resident.polls.list(signal), []);
  const [saving, setSaving] = useState<number | null>(null);

  async function handleVote(poll: Poll, index: number) {
    if (!poll.is_open || saving !== null) return;

    const previous = poll.my_vote;
    setSaving(poll.id);

    state.setData((current) =>
      current
        ? {
            polls: current.polls.map((p) =>
              p.id === poll.id
                ? {
                    ...p,
                    my_vote: index,
                    // A first vote grows the total; changing an existing vote does not.
                    total_votes: String(Number(p.total_votes || 0) + (previous === null ? 1 : 0)),
                  }
                : p,
            ),
          }
        : current,
    );

    try {
      await api.resident.polls.vote(poll.id, index);
      // Re-read so the per-option tallies reflect the new vote.
      await state.refresh();
    } catch (err) {
      state.setData((current) =>
        current
          ? {
              polls: current.polls.map((p) =>
                p.id === poll.id
                  ? {
                      ...p,
                      my_vote: previous,
                      total_votes: String(Math.max(0, Number(p.total_votes || 0) - (previous === null ? 1 : 0))),
                    }
                  : p,
              ),
            }
          : current,
      );
      Alert.alert('Could not record your vote', errorMessage(err));
    } finally {
      setSaving(null);
    }
  }

  return (
    <Screen
      state={state}
      isEmpty={(d) => (d.polls ?? []).length === 0}
      empty={{
        icon: 'stats-chart-outline',
        title: 'No polls right now',
        message: 'When your committee asks residents to vote on something, it will appear here.',
      }}
    >
      {(data) => (
        <View style={s.list}>
          {(data.polls ?? []).map((poll) => {
            const hasVoted = poll.my_vote !== null && poll.my_vote !== undefined;
            const showResults = hasVoted || !poll.is_open;
            const total = Number(poll.total_votes || 0);
            const options = Array.isArray(poll.options) ? poll.options : [];

            return (
              <Card key={poll.id}>
                <View style={s.head}>
                  <Text style={[TYPE.sectionHeader, s.flex]}>{poll.question}</Text>
                  <StatusPill
                    tone={
                      poll.is_open
                        ? { bg: COLORS.successTint, fg: '#15803d', label: 'Open' }
                        : { bg: COLORS.cardMuted, fg: COLORS.textSecondary, label: 'Closed' }
                    }
                  />
                </View>

                <Text style={[TYPE.caption, s.meta]}>
                  {total} {total === 1 ? 'vote' : 'votes'}
                  {poll.closes_at
                    ? ` · ${poll.is_open ? 'closes' : 'closed'} ${formatDateShort(poll.closes_at)}`
                    : ''}
                </Text>

                <View style={s.options}>
                  {options.map((option, index) => {
                    const chosen = poll.my_vote === index;
                    const count = poll.results?.[index];
                    const pct = showResults && total > 0 && count != null ? Math.round((count / total) * 100) : null;

                    return (
                      <Pressable
                        key={`${poll.id}-${index}`}
                        onPress={() => handleVote(poll, index)}
                        disabled={!poll.is_open || saving === poll.id}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: chosen, disabled: !poll.is_open }}
                        style={({ pressed }) => [
                          s.option,
                          chosen && s.optionChosen,
                          pressed && poll.is_open && { opacity: 0.7 },
                        ]}
                      >
                        {/* Result bar sits behind the label rather than beside it,
                            so a long option is not squeezed into half the width. */}
                        {pct !== null ? <View style={[s.bar, { width: `${pct}%` }]} /> : null}

                        <Ionicons
                          name={chosen ? 'radio-button-on' : 'radio-button-off'}
                          size={18}
                          color={chosen ? COLORS.primary : COLORS.textDisabled}
                        />
                        <Text style={[TYPE.body, s.flex, chosen && s.optionLabelChosen]}>{option}</Text>
                        {pct !== null ? <Text style={s.pct}>{pct}%</Text> : null}
                      </Pressable>
                    );
                  })}
                </View>

                {!poll.is_open ? (
                  <Text style={[TYPE.caption, s.foot]}>Voting has closed on this poll.</Text>
                ) : hasVoted ? (
                  <Text style={[TYPE.caption, s.foot]}>Your vote is recorded. Tap another option to change it.</Text>
                ) : (
                  <Text style={[TYPE.caption, s.foot]}>Tap an option to vote. Results appear once you do.</Text>
                )}
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: SPACING.md },

  head: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  meta: { marginTop: SPACING.xs },

  options: { gap: SPACING.sm, marginTop: SPACING.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: 46,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    overflow: 'hidden',
  },
  optionChosen: { borderColor: COLORS.primary },
  optionLabelChosen: { fontWeight: '600', color: COLORS.textPrimary },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: COLORS.primaryTint },
  pct: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, fontVariant: ['tabular-nums'] },

  foot: { marginTop: SPACING.md },
});
