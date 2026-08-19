/**
 * ui.tsx — the shared primitives every Nexso screen is built from.
 *
 * Deliberately small. Anything that appears on three or more screens lives here;
 * anything screen-specific stays with its screen. The web portal's equivalent of
 * this file is spread across components/shared/ plus a pile of inline styles —
 * keeping it in one place is what lets the mobile screens stay short.
 */

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, RADIUS, SHADOW, SPACING, toneFor, type Tone } from '../theme/tokens';
import { TYPE } from '../theme/type';
import { avatarColor, initials } from '../utils/format';

// ─── Card ─────────────────────────────────────────────────────────────────────

export function Card({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  return <View style={[s.card, padded && s.cardPadded, style]}>{children}</View>;
}

export function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={s.cardHeader}>
      <Text style={TYPE.sectionHeader}>{title}</Text>
      {action}
    </View>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <View style={s.sectionTitle}>
      <Text style={TYPE.overline}>{children}</Text>
      {action}
    </View>
  );
}

// ─── Status pill ──────────────────────────────────────────────────────────────

/**
 * Renders a status as a coloured pill. Pass the tone map for the domain
 * (TICKET_STATUS, DUE_STATUS, …) — toneFor guarantees a sane fallback so an
 * unrecognised status can never blank the row or crash it.
 */
export function StatusPill({
  status,
  map,
  tone,
  style,
}: {
  status?: string | null;
  map?: Record<string, Tone>;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
}) {
  const resolved = tone ?? toneFor(map ?? {}, status);
  return (
    <View style={[s.pill, { backgroundColor: resolved.bg }, style]}>
      <Text style={[TYPE.pill, { color: resolved.fg }]} numberOfLines={1}>
        {resolved.label.toUpperCase()}
      </Text>
    </View>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

export function Avatar({ name, size = 40 }: { name?: string | null; size?: number }) {
  return (
    <View
      style={[
        s.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(name) },
      ]}
    >
      <Text style={{ fontSize: size * 0.38, fontWeight: '700', color: COLORS.textPrimary }}>
        {initials(name)}
      </Text>
    </View>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
  fullWidth = false,
}: {
  title: string;
  onPress?: PressableProps['onPress'];
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
}) {
  const isOff = disabled || loading;
  const palette = BUTTON_PALETTE[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isOff}
      accessibilityRole="button"
      accessibilityState={{ disabled: isOff, busy: loading }}
      // The pressed style is applied via the function form rather than a
      // hover-style handler — React Native has no hover, and Android's ripple
      // alone is invisible on a coloured button.
      style={({ pressed }) => [
        s.button,
        { backgroundColor: palette.bg, borderColor: palette.border },
        fullWidth && s.buttonFull,
        pressed && !isOff && s.buttonPressed,
        isOff && s.buttonDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={17} color={palette.fg} style={s.buttonIcon} /> : null}
          <Text style={[TYPE.button, { color: palette.fg }]} numberOfLines={1}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const BUTTON_PALETTE: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: COLORS.primary, fg: COLORS.textOnAccent, border: COLORS.primary },
  secondary: { bg: COLORS.card, fg: COLORS.textPrimary, border: COLORS.border },
  ghost: { bg: 'transparent', fg: COLORS.primary, border: 'transparent' },
  danger: { bg: COLORS.danger, fg: COLORS.textOnAccent, border: COLORS.danger },
};

// ─── Text field ───────────────────────────────────────────────────────────────

export function Field({
  label,
  error,
  hint,
  required: isRequired,
  containerStyle,
  style: inputStyle,
  ...inputProps
}: TextInputProps & {
  label?: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  /** Wraps the label + input + hint. The `style` prop still targets the input itself. */
  containerStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.field, containerStyle]}>
      {label ? (
        <Text style={TYPE.label}>
          {label}
          {isRequired ? <Text style={{ color: COLORS.danger }}> *</Text> : null}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={COLORS.textDisabled}
        {...inputProps}
        style={[
          s.input,
          inputProps.multiline && s.inputMultiline,
          !!error && s.inputError,
          inputProps.editable === false && s.inputDisabled,
          inputStyle as StyleProp<TextStyle>,
        ]}
      />
      {error ? (
        <Text style={[TYPE.caption, { color: COLORS.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={TYPE.caption}>{hint}</Text>
      ) : null}
    </View>
  );
}

// ─── Segmented filter ─────────────────────────────────────────────────────────

/**
 * A horizontal row of mutually exclusive chips. Used for the status/month
 * filters that the web renders as dropdowns — a Picker on Android opens a modal
 * for what is usually a three-way choice, which is a lot of ceremony.
 */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.chipGroup, style]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [s.chip, active && s.chipActive, pressed && s.buttonPressed]}
          >
            <Text style={[s.chipLabel, active && s.chipLabelActive]} numberOfLines={1}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Key/value row ────────────────────────────────────────────────────────────

export function InfoRow({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value?: React.ReactNode;
  valueStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View style={s.infoRow}>
      <Text style={[TYPE.caption, s.infoLabel]}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number' || value == null ? (
        <Text style={[TYPE.body, s.infoValue, valueStyle]}>{value ?? '—'}</Text>
      ) : (
        <View style={s.infoValue}>{value}</View>
      )}
    </View>
  );
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

export function StatTile({
  label,
  value,
  icon,
  tint,
  accent,
  onPress,
}: {
  label: string;
  value: React.ReactNode;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  accent: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [s.statTile, pressed && onPress && s.buttonPressed]}
    >
      <View style={[s.statIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <Text style={TYPE.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      <Text style={[TYPE.caption, { color: COLORS.textSecondary }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── States ───────────────────────────────────────────────────────────────────

export function Loading({ label }: { label?: string }) {
  return (
    <View style={s.centered}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      {label ? <Text style={[TYPE.bodyMuted, { marginTop: SPACING.md }]}>{label}</Text> : null}
    </View>
  );
}

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  message,
  action,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={s.centered}>
      <View style={s.emptyIcon}>
        <Ionicons name={icon} size={30} color={COLORS.textMuted} />
      </View>
      <Text style={[TYPE.sectionHeader, { textAlign: 'center' }]}>{title}</Text>
      {message ? (
        <Text style={[TYPE.bodyMuted, { textAlign: 'center', marginTop: SPACING.xs }]}>{message}</Text>
      ) : null}
      {action ? <View style={{ marginTop: SPACING.lg }}>{action}</View> : null}
    </View>
  );
}

export function ErrorNotice({
  message,
  onRetry,
  style,
}: {
  message: string;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.errorNotice, style]}>
      <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
      <Text style={[TYPE.body, { color: '#991b1b', flex: 1 }]}>{message}</Text>
      {onRetry ? <Button title="Retry" variant="ghost" onPress={onRetry} /> : null}
    </View>
  );
}

export function Banner({
  tone = 'info',
  icon,
  children,
}: {
  tone?: 'info' | 'warning' | 'success' | 'danger';
  icon?: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  const palette = {
    info: { bg: COLORS.infoTint, fg: '#1e40af', icon: 'information-circle' },
    warning: { bg: COLORS.warningTint, fg: '#92400e', icon: 'warning' },
    success: { bg: COLORS.successTint, fg: '#166534', icon: 'checkmark-circle' },
    danger: { bg: COLORS.dangerTint, fg: '#991b1b', icon: 'alert-circle' },
  }[tone];

  return (
    <View style={[s.banner, { backgroundColor: palette.bg }]}>
      <Ionicons name={(icon ?? palette.icon) as keyof typeof Ionicons.glyphMap} size={18} color={palette.fg} />
      <Text style={[TYPE.body, { color: palette.fg, flex: 1 }]}>{children}</Text>
    </View>
  );
}

// ─── Pressable list row ───────────────────────────────────────────────────────

export function Row({
  children,
  onPress,
  style,
  last = false,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Suppresses the divider on the final row of a card. */
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [s.row, !last && s.rowDivided, pressed && onPress && s.rowPressed, style]}
    >
      {children}
    </Pressable>
  );
}

export function Chevron() {
  return <Ionicons name="chevron-forward" size={18} color={COLORS.textDisabled} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    overflow: 'hidden',
    ...SHADOW.card,
  },
  cardPadded: { padding: SPACING.lg },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.divider,
  },

  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },

  pill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
  },

  avatar: { alignItems: 'center', justifyContent: 'center' },

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    // 44 is the minimum comfortable touch target on both platforms.
    minHeight: 44,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  buttonFull: { alignSelf: 'stretch' },
  buttonPressed: { opacity: 0.65 },
  buttonDisabled: { opacity: 0.45 },
  buttonIcon: { marginRight: 2 },

  field: { gap: SPACING.xs },
  input: {
    minHeight: 46,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.borderStrong,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.card,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top', paddingTop: SPACING.md },
  inputError: { borderColor: COLORS.danger, backgroundColor: COLORS.dangerTint },
  inputDisabled: { backgroundColor: COLORS.cardMuted, color: COLORS.textSecondary },

  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  chipLabelActive: { color: COLORS.textOnAccent },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, paddingVertical: SPACING.sm },
  infoLabel: { width: 118, paddingTop: 3 },
  infoValue: { flex: 1 },

  statTile: {
    flex: 1,
    minWidth: 104,
    gap: SPACING.xs,
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    ...SHADOW.card,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },

  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xxxl * 1.5, paddingHorizontal: SPACING.xl },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },

  errorNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.dangerTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#fecaca',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.card,
  },
  rowDivided: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.divider },
  rowPressed: { backgroundColor: COLORS.cardMuted },
});
