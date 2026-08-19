/**
 * The "/" route exists only so the router has something to mount on cold start
 * while the root layout's auth gate works out where this user belongs. It never
 * stays on screen.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Loading } from '../src/components/ui';
import { COLORS } from '../src/theme/tokens';

export default function Index() {
  return (
    <View style={s.container}>
      <Loading />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screen, alignItems: 'center', justifyContent: 'center' },
});
