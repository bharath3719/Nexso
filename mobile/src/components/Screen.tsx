/**
 * Screen.tsx — page scaffolding.
 *
 * Every list/detail screen in the app is a <Screen>. It owns the four states a
 * remote-data screen can be in — loading, error, empty, loaded — so no screen
 * repeats that ladder, and it wires pull-to-refresh consistently.
 *
 * `ScreenScroll` is the plain version for screens that are not driven by a
 * single request (forms, composed dashboards).
 */

import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../theme/tokens';
import { EmptyState, ErrorNotice, Loading } from './ui';
import type { ApiState } from '../hooks/useApi';

/**
 * Bottom padding so the last row clears the tab bar. The tab bar sits above the
 * home indicator, so its height is a fixed bar plus the bottom inset.
 */
export function useTabBarPadding(): number {
  const insets = useSafeAreaInsets();
  return 56 + insets.bottom + SPACING.lg;
}

export function ScreenScroll({
  children,
  refreshing,
  onRefresh,
  contentStyle,
  keyboardAware = false,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  /** Lifts content above the keyboard. Enable on screens with text inputs. */
  keyboardAware?: boolean;
}) {
  const bottomPad = useTabBarPadding();

  const scroll = (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.content, { paddingBottom: bottomPad }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={Boolean(refreshing)}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );

  if (!keyboardAware) return <View style={s.screen}>{scroll}</View>;

  return (
    <KeyboardAvoidingView
      style={s.screen}
      // Android resizes the window itself (adjustResize); adding padding on top
      // of that double-counts the keyboard and leaves a gap above it.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {scroll}
    </KeyboardAvoidingView>
  );
}

type ScreenProps<T> = {
  state: ApiState<T>;
  /** True when the loaded data has nothing to show. */
  isEmpty?: (data: T) => boolean;
  empty?: React.ComponentProps<typeof EmptyState>;
  children: (data: T) => React.ReactNode;
  /** Rendered above the data, and kept visible in the empty state — filters, headers. */
  header?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen<T>({ state, isEmpty, empty, children, header, contentStyle }: ScreenProps<T>) {
  const { data, loading, refreshing, error, refresh, reload } = state;

  // Only a first load with nothing on screen gets the full-screen spinner. A
  // refresh keeps the existing content and shows the pull-to-refresh indicator.
  if (loading && data === null) {
    return (
      <View style={s.screen}>
        <Loading />
      </View>
    );
  }

  // An error with stale data still on screen is shown as a banner above it —
  // losing a working list because one refresh failed is worse than a warning.
  if (error && data === null) {
    return (
      <View style={s.screen}>
        <ScreenScroll refreshing={refreshing} onRefresh={refresh}>
          <ErrorNotice message={error} onRetry={reload} />
        </ScreenScroll>
      </View>
    );
  }

  const showEmpty = data !== null && isEmpty?.(data);

  return (
    <ScreenScroll refreshing={refreshing} onRefresh={refresh} contentStyle={contentStyle}>
      {error ? <ErrorNotice message={error} onRetry={reload} /> : null}
      {header}
      {showEmpty ? (
        <EmptyState title="Nothing here yet" {...empty} />
      ) : data !== null ? (
        children(data)
      ) : null}
    </ScreenScroll>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.screen },
  flex: { flex: 1, backgroundColor: COLORS.screen },
  content: { padding: SPACING.lg, gap: SPACING.lg },
});
