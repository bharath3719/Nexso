/**
 * OTP verification — step 2 of resident sign-in.
 *
 * On success the root layout's auth gate sees a session appear and redirects
 * into the resident tabs, so this screen does not navigate itself.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenScroll } from '../../src/components/Screen';
import { Banner, Button, ErrorNotice } from '../../src/components/ui';
import { useAuth } from '../../src/lib/auth';
import { errorMessage } from '../../src/lib/api';
import { COLORS, RADIUS, SPACING } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';

const OTP_LENGTH = 6;
/** Matches OTP_TTL_SECONDS' default in backend/src/routes/auth.js. */
const RESEND_COOLDOWN_SECONDS = 60;

export default function Verify() {
  const router = useRouter();
  const { verifyOtp, requestOtp } = useAuth();
  const params = useLocalSearchParams<{ phone: string; devOtp?: string }>();
  const phone = String(params.phone ?? '');

  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState(String(params.devOtp ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Autofocus so the keyboard is already up — one less tap in the flow.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  const submit = React.useCallback(
    async (value: string) => {
      if (value.length !== OTP_LENGTH || verifying) return;
      setVerifying(true);
      setError(null);
      try {
        await verifyOtp(phone, value);
        // Deliberately no navigate() — the root auth gate redirects once the
        // session lands. Navigating here too would race it.
      } catch (err) {
        setError(errorMessage(err));
        setCode('');
        inputRef.current?.focus();
      } finally {
        setVerifying(false);
      }
    },
    [phone, verifyOtp, verifying],
  );

  // Auto-submit on the sixth digit. A "Verify" button is still rendered for
  // anyone whose keyboard paste lands all six at once with the field blurred.
  function handleChange(next: string) {
    const digits = next.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(digits);
    if (error) setError(null);
    if (digits.length === OTP_LENGTH) void submit(digits);
  }

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    try {
      const { devOtp } = await requestOtp(phone);
      setCode(devOtp ?? '');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setResending(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScreenScroll keyboardAware contentStyle={s.content}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          style={s.back}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </Pressable>

        <View style={s.header}>
          <Text style={TYPE.pageTitle}>Enter your code</Text>
          <Text style={TYPE.pageSubtitle}>
            We sent a {OTP_LENGTH}-digit code on WhatsApp to{' '}
            <Text style={s.phone}>+91 {phone}</Text>
          </Text>
        </View>

        {params.devOtp ? (
          <Banner tone="warning" icon="construct-outline">
            Development server — the code was returned in the response and filled in for you.
          </Banner>
        ) : null}

        {/* One hidden input behind six boxes: the OS autofill/SMS-suggestion
            path only works against a real single field, and six separate inputs
            break paste. */}
        <Pressable onPress={() => inputRef.current?.focus()} style={s.boxes}>
          {Array.from({ length: OTP_LENGTH }).map((_, i) => {
            const char = code[i];
            const isCursor = i === code.length;
            return (
              <View key={i} style={[s.box, char ? s.boxFilled : null, isCursor ? s.boxActive : null]}>
                <Text style={TYPE.code}>{char ?? ''}</Text>
              </View>
            );
          })}
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={handleChange}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={OTP_LENGTH}
            editable={!verifying}
            style={s.hiddenInput}
          />
        </Pressable>

        {error ? <ErrorNotice message={error} /> : null}

        <Button
          title="Verify and sign in"
          onPress={() => submit(code)}
          loading={verifying}
          disabled={code.length !== OTP_LENGTH}
          fullWidth
        />

        <Pressable
          onPress={handleResend}
          disabled={cooldown > 0 || resending}
          accessibilityRole="button"
          style={({ pressed }) => [s.resend, pressed && cooldown === 0 && { opacity: 0.6 }]}
        >
          <Text style={[TYPE.body, { color: cooldown > 0 ? COLORS.textMuted : COLORS.primary }]}>
            {resending
              ? 'Sending…'
              : cooldown > 0
                ? `Resend code in ${cooldown}s`
                : 'Did not get it? Resend code'}
          </Text>
        </Pressable>
      </ScreenScroll>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.card },
  content: { backgroundColor: COLORS.card, paddingHorizontal: SPACING.xl, gap: SPACING.xl },

  back: { width: 40, height: 40, justifyContent: 'center' },
  header: { gap: SPACING.xs },
  phone: { fontWeight: '700', color: COLORS.textPrimary },

  boxes: { flexDirection: 'row', gap: SPACING.sm, justifyContent: 'space-between' },
  box: {
    flex: 1,
    aspectRatio: 0.82,
    maxWidth: 54,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: { borderColor: COLORS.borderStrong, backgroundColor: COLORS.card },
  boxActive: { borderColor: COLORS.primary, backgroundColor: COLORS.card },

  // Kept in the tree and focusable — `display: none` or zero opacity stops
  // some Android keyboards from delivering the SMS autofill suggestion.
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0.01,
    color: 'transparent',
  },

  resend: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
