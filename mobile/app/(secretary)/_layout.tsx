/**
 * Secretary tab bar.
 *
 * The four tabs are the things a secretary does away from a desk: check what is
 * outstanding, look up a resident, glance at tickets, confirm a payment.
 * Composing announcements, running expenses and broadcasting sit under More.
 */

import React from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../src/theme/tokens';

export default function SecretaryLayout() {
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
          title: 'Overview',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="maintenance"
        options={{
          title: 'Dues',
          headerTitle: 'Maintenance',
          tabBarIcon: ({ color, size }) => <Ionicons name="cash-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: 'Tickets',
          headerTitle: 'Service Tickets',
          tabBarIcon: ({ color, size }) => <Ionicons name="construct-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="residents"
        options={{
          title: 'Residents',
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
        }}
      />

      <Tabs.Screen name="verify-payments" options={{ href: null, headerTitle: 'Confirm Payments' }} />
      <Tabs.Screen name="announcements" options={{ href: null, headerTitle: 'Announcements' }} />
      <Tabs.Screen name="new-announcement" options={{ href: null, headerTitle: 'New Announcement' }} />
      <Tabs.Screen name="events" options={{ href: null, headerTitle: 'Events' }} />
      <Tabs.Screen name="polls" options={{ href: null, headerTitle: 'Polls' }} />
      <Tabs.Screen name="broadcast" options={{ href: null, headerTitle: 'Broadcast' }} />
      <Tabs.Screen name="expenses" options={{ href: null, headerTitle: 'Income & Expenses' }} />
      <Tabs.Screen name="ledger" options={{ href: null, headerTitle: 'Ledger Entries' }} />
      <Tabs.Screen name="new-expense" options={{ href: null, headerTitle: 'Expense' }} />
      <Tabs.Screen name="new-income" options={{ href: null, headerTitle: 'Other Income' }} />
      <Tabs.Screen name="annual" options={{ href: null, headerTitle: 'Annual Statement' }} />
      <Tabs.Screen name="profile" options={{ href: null, headerTitle: 'Account' }} />
    </Tabs>
  );
}
