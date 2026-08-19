import React from 'react';
import { MoreMenu, type MoreGroup } from '../../src/components/MoreMenu';
import { COLORS } from '../../src/theme/tokens';

const GROUPS: MoreGroup[] = [
  {
    title: 'Society',
    links: [
      {
        label: 'Announcements',
        href: '/(resident)/announcements',
        icon: 'megaphone-outline',
        tint: COLORS.infoTint,
        accent: COLORS.info,
        hint: 'Notices from your committee',
      },
      {
        label: 'Events',
        href: '/(resident)/events',
        icon: 'calendar-outline',
        tint: COLORS.warningTint,
        accent: COLORS.warning,
        hint: 'RSVP to gatherings and meetings',
      },
      {
        label: 'Polls',
        href: '/(resident)/polls',
        icon: 'stats-chart-outline',
        tint: '#ede9fe',
        accent: '#6d28d9',
        hint: 'Have your say on society decisions',
      },
    ],
  },
  {
    title: 'You',
    links: [
      {
        label: 'My profile',
        href: '/(resident)/profile',
        icon: 'person-outline',
        tint: COLORS.successTint,
        accent: COLORS.success,
        hint: 'Contact details, vehicles, emergency contact',
      },
    ],
  },
];

export default function More() {
  return <MoreMenu groups={GROUPS} />;
}
