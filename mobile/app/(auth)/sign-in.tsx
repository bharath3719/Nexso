/**
 * Sign-in — the resident path, which is the one almost every install will take.
 *
 * Residents have no password: they enter the mobile number their secretary
 * registered, and the backend WhatsApps a 6-digit code (routes/auth.js
 * otp/request). Secretaries sign in with a username and password instead, via
 * the link at the bottom.
 */

import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenScroll } from '../../src/components/Screen';
import { Button, ErrorNotice, Field } from '../../src/components/ui';
import { useAuth } from '../../src/lib/auth';
import { errorMessage } from '../../src/lib/api';
import { normalizePhone, validatePhone } from '../../src/utils/validation';
import { COLORS, RADIUS, SPACING } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';

export default function SignIn() {
  const router = useRouter();
  const { requestOtp } = useAuth();

  const [phone, setPhone] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleSendCode() {
    const invalid = validatePhone(phone) ?? (phone.trim() ? null : 'Enter your mobile number');
    if (invalid) {
      setFieldError(invalid);
      return;
    }
    setFieldError(null);
    setFormError(null);
    setSending(true);

    const normalized = normalizePhone(phone);
    try {
      const { devOtp } = await requestOtp(normalized);
      // devOtp is only ever present against a backend with no WhatsApp token
      // configured. Passing it through prefills the next screen so the app is
      // usable against a local server; in production it is undefined.
      router.push({ pathname: '/(auth)/verify', params: { phone: normalized, devOtp: devOtp ?? '' } });
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScreenScroll keyboardAware contentStyle={s.content}>
        <View style={s.brand}>
          <Image source={require('../../assets/icon.png')} style={s.logo} resizeMode="contain" />
          <Text style={TYPE.pageTitle}>Welcome to Nexso</Text>
          <Text style={[TYPE.pageSubtitle, s.center]}>
            Your society, in your pocket — dues, visitors, notices and complaints.
          </Text>
        </View>

        <View style={s.form}>
          <Field
            label="Mobile number"
            required
            value={phone}
            onChangeText={(t) => {
              setPhone(t);
              if (fieldError) setFieldError(null);
            }}
            error={fieldError}
            hint="The number registered with your society"
            placeholder="9876543210"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            maxLength={14}
            returnKeyType="go"
            onSubmitEditing={handleSendCode}
            editable={!sending}
          />

          {formError ? <ErrorNotice message={formError} /> : null}

          <Button
            title="Send me a code"
            icon="logo-whatsapp"
            onPress={handleSendCode}
            loading={sending}
            fullWidth
          />

          <View style={s.note}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.textMuted} />
            <Text style={[TYPE.caption, s.noteText]}>
              We will send a 6-digit code to this number on WhatsApp. It expires in 5 minutes.
            </Text>
          </View>
        </View>

        <View style={s.footer}>
          <View style={s.divider} />
          <Link href="/(auth)/staff-sign-in" asChild>
            <Pressable
              accessibilityRole="link"
              style={({ pressed }) => [s.staffLink, pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="briefcase-outline" size={17} color={COLORS.primary} />
              <Text style={s.staffLinkText}>I am a society secretary</Text>
            </Pressable>
          </Link>
        </View>
      </ScreenScroll>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.card },
  content: { backgroundColor: COLORS.card, paddingHorizontal: SPACING.xl, gap: SPACING.xxl, flexGrow: 1 },

  brand: { alignItems: 'center', gap: SPACING.sm, paddingTop: SPACING.xxxl },
  logo: { width: 76, height: 76, borderRadius: RADIUS.xl },
  center: { textAlign: 'center' },

  form: { gap: SPACING.lg },

  note: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  noteText: { flex: 1 },

  footer: { marginTop: 'auto', gap: SPACING.lg },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border },
  staffLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, minHeight: 44 },
  staffLinkText: { ...TYPE.button, color: COLORS.primary },
});
