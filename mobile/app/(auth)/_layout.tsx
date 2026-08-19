import React from 'react';
import { Stack } from 'expo-router';
import { COLORS } from '../../src/theme/tokens';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.card },
        // Sign-in is a linear flow (phone → code); a slide reads as forward
        // progress in a way the default fade does not.
        animation: 'slide_from_right',
      }}
    />
  );
}
