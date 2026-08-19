/**
 * Resident tab bar.
 *
 * Five tabs is the practical ceiling on a phone. The four daily-use destinations
 * get one each; announcements, events, polls and profile live behind "More".
 */

import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../src/theme/tokens';

export default function ResidentLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.card },
        headerTitleStyle: { fontSize: 17, fontWeight: '600', color: COLORS.textPrimary },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: COLORS.screen },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        // The bar sits above the gesture bar / nav buttons rather than under
        // them, so the last tab is not half-covered on a gesture-nav device.
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="billing"
        options={{
          title: 'Billing',
          headerTitle: 'My Payments',
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="visitors"
        options={{
          title: 'Visitors',
          headerTitle: 'Visitor Passes',
          tabBarIcon: ({ color, size }) => <Ionicons name="qr-code-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="complaints"
        options={{
          title: 'Complaints',
          headerTitle: 'My Complaints',
          tabBarIcon: ({ color, size }) => <Ionicons name="construct-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
        }}
      />

      {/* Reachable from Home and More, but not themselves tabs. */}
      <Tabs.Screen name="announcements" options={{ href: null, headerTitle: 'Announcements' }} />
      <Tabs.Screen name="events" options={{ href: null, headerTitle: 'Events' }} />
      <Tabs.Screen name="polls" options={{ href: null, headerTitle: 'Polls' }} />
      <Tabs.Screen name="profile" options={{ href: null, headerTitle: 'My Profile' }} />
      <Tabs.Screen name="new-complaint" options={{ href: null, headerTitle: 'New Complaint' }} />
      <Tabs.Screen name="new-pass" options={{ href: null, headerTitle: 'New Visitor Pass' }} />
    </Tabs>
  );
}
