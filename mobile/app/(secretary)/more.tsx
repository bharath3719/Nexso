import React from 'react';
import { MoreMenu, type MoreGroup } from '../../src/components/MoreMenu';
import { useSession } from '../../src/lib/auth';
import { COLORS } from '../../src/theme/tokens';

const GROUPS: MoreGroup[] = [
  {
    title: 'Communicate',
    links: [
      {
        label: 'Announcements',
        href: '/(secretary)/announcements',
        icon: 'megaphone-outline',
        tint: COLORS.infoTint,
        accent: COLORS.info,
        hint: 'Post notices to every resident',
      },
      {
        label: 'WhatsApp broadcast',
        href: '/(secretary)/broadcast',
        icon: 'paper-plane-outline',
        tint: COLORS.successTint,
        accent: COLORS.success,
        hint: 'Message residents directly on their phone',
      },
    ],
  },
  {
    title: 'Engage',
    links: [
      {
        label: 'Events',
        href: '/(secretary)/events',
        icon: 'calendar-outline',
        tint: COLORS.warningTint,
        accent: COLORS.warning,
        hint: 'Schedule gatherings and track RSVPs',
      },
      {
        label: 'Polls',
        href: '/(secretary)/polls',
        icon: 'stats-chart-outline',
        tint: '#ede9fe',
        accent: '#6d28d9',
        hint: 'Put a decision to a resident vote',
      },
    ],
  },
  {
    title: 'Money',
    links: [
      {
        label: 'Confirm payments',
        href: '/(secretary)/verify-payments',
        icon: 'checkmark-done-outline',
        tint: COLORS.infoTint,
        accent: COLORS.info,
        hint: 'Verify UPI transfers residents have reported',
      },
      {
        label: 'Income and expenses',
        href: '/(secretary)/expenses',
        icon: 'pie-chart-outline',
        tint: COLORS.successTint,
        accent: COLORS.success,
        hint: 'Monthly surplus and where the money went',
      },
    ],
  },
  {
    title: 'Account',
    links: [
      {
        label: 'Society and password',
        href: '/(secretary)/profile',
        icon: 'settings-outline',
        tint: COLORS.cardMuted,
        accent: COLORS.textSecondary,
        hint: 'Society details, payment setup, change password',
      },
    ],
  },
];

export default function SecretaryMore() {
  const session = useSession();
  return <MoreMenu groups={GROUPS} subtitle={`Secretary · ${session.societyName ?? 'your society'}`} />;
}
