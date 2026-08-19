/**
 * type.ts — the type ramp, ported from frontend/src/styles/typography.js.
 *
 * The web ramp is Fluent 2 on Segoe UI Variable. On mobile we drop the explicit
 * fontFamily and let each platform use its system face (Roboto on Android, SF on
 * iOS) — that is what "native-idiomatic" means here, and a bundled Segoe would
 * look foreign on both. Sizes are nudged up slightly from the web values because
 * 12px caption text is legible on a monitor and marginal on a phone held at arm's
 * length; Android's accessibility guidance puts the floor at 12sp.
 *
 * lineHeight is a unitless NUMBER in React Native, not a "20px" string.
 */

import { Platform, type TextStyle } from 'react-native';
import { COLORS } from './tokens';

/**
 * Weights above 600 need an explicit family on Android — Roboto only resolves
 * '700'/'600' correctly when the numeric weight is passed as a string, and
 * 'bold' silently falls back to 400 for some system fonts. Using the numeric
 * strings uniformly is the portable choice.
 */
const WEIGHT = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const satisfies Record<string, TextStyle['fontWeight']>;

export const TYPE = {
  /** Screen title, sits under the native header. 26/32 bold. */
  pageTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: WEIGHT.bold,
    color: COLORS.textPrimary,
    letterSpacing: -0.4,
  },

  /** One muted line under a page title. 14/20. */
  pageSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: WEIGHT.regular,
    color: COLORS.textSecondary,
  },

  /** Card and section headings. 17/22 semibold. */
  sectionHeader: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: WEIGHT.semibold,
    color: COLORS.textPrimary,
  },

  /** Sub-headings inside a card. 15/20 semibold. */
  subSection: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: WEIGHT.semibold,
    color: COLORS.textBody,
  },

  /** The leading line of a list row. 15/20 semibold. */
  rowTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: WEIGHT.semibold,
    color: COLORS.textPrimary,
  },

  /** The muted second line of a list row. 13/18. */
  rowMeta: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: WEIGHT.regular,
    color: COLORS.textSecondary,
  },

  /** Default body copy. 15/22. */
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: WEIGHT.regular,
    color: COLORS.textBody,
  },

  /** Muted body copy. 15/22. */
  bodyMuted: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: WEIGHT.regular,
    color: COLORS.textSecondary,
  },

  /** Form field labels. 13/18 semibold. */
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: WEIGHT.semibold,
    color: COLORS.textBody,
  },

  /** Helper text, timestamps, footnotes. 12/16 muted. */
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: WEIGHT.regular,
    color: COLORS.textMuted,
  },

  /** Uppercase group label above a section. 11/16 bold, tracked out. */
  overline: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: WEIGHT.bold,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  /** Large numeral on a stat tile. 28/32 bold. */
  statValue: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: WEIGHT.bold,
    color: COLORS.textPrimary,
  },

  /**
   * Currency amounts. Tabular figures keep a column of ₹ values aligned;
   * without this the proportional '1' is narrower than the other digits and
   * a list of amounts visibly ripples.
   */
  amount: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: WEIGHT.bold,
    color: COLORS.textPrimary,
    fontVariant: ['tabular-nums'],
  },

  /** Text inside a status pill. 11/14 bold. */
  pill: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: WEIGHT.bold,
    letterSpacing: 0.2,
  },

  /** Button label. 15/20 semibold. */
  button: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: WEIGHT.semibold,
  },

  /**
   * OTP / pass-code entry. Monospace so the six boxes stay a fixed width as
   * the resident types.
   */
  code: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: WEIGHT.bold,
    color: COLORS.textPrimary,
    letterSpacing: 4,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
} as const satisfies Record<string, TextStyle>;
