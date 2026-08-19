# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

Things SDK 57 changed that older tutorials and model priors still get wrong — each of
these was hit while building this app:

- **`expo-file-system` is a class API.** `import { File, Directory, Paths }`. The old
  `FileSystem.downloadAsync` / `documentDirectory` API now lives behind
  `expo-file-system/legacy`. See `downloadAndShare()` in `src/lib/api.ts`.
- **`newArchEnabled` and `android.edgeToEdgeEnabled` are gone from app.json.** Both
  behaviours are now unconditional, and leaving the keys in fails config validation.
- **`@expo/vector-icons` needs `expo-font` installed explicitly.** It is a peer
  dependency, and without it a production build crashes even though Expo Go is fine.

## Before you commit

```bash
npm run typecheck   # tsc --noEmit
npm run doctor      # npx expo-doctor — must be 21/21
npx expo export --platform android --output-dir /tmp/x   # proves it actually bundles
```

`typecheck` passing does not mean the app runs — it will not catch a missing native
module, a bad route tree, or a removed config key. Run all three.

## Conventions

- Import icons as `import Ionicons from '@expo/vector-icons/Ionicons'`. The barrel
  import drags all thirteen icon fonts into the APK.
- Reads go through `useApi`, writes through `useMutation` (`src/hooks/useApi.ts`).
  Do not hand-roll `useState` + `useEffect` + `fetch` in a screen.
- List screens render inside `<Screen>` (`src/components/Screen.tsx`), which already
  handles loading, error, empty and pull-to-refresh.
- Colours and text styles come from `src/theme/`. No raw hex in a screen.
- Auth routing belongs in `app/_layout.tsx` and nowhere else.
