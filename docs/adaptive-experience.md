# Adaptive iPhone experience

ArboristDog now keeps its compact phone flow and expands to two panes when there is enough room. This implements the approved folding iPhone concept using available window space; it does not assume a particular device model, hinge position, or future Apple API.

- At 720 points of usable width, the expanded layout reserves 43% for supporting content and 57% for the active screen. The total experience is capped at 1,200 points.
- Larger accessibility text raises the expansion threshold. Narrow windows retain a single pane.
- The expanded header uses the existing tree-ring paw logo and full Almstead attribution. Welcome, sign-in, onboarding, credits, and settings use the brand panel. Property setup uses location guidance. The scan flow shows the real photo, symptoms, notes, and property location.
- Capture owns a live camera pane and a separate controls pane. The camera and routed screen keep the same React parent structure while resizing. Forms and analysis are not restarted by a layout change.
- History selection previews a saved assessment beside the list without overwriting the current scan. Opening its full diagnosis restores that record's image, symptoms, notes, and location together.
- Safe-area spacing and scrollable content keep actions usable on compact and short landscape windows. The app's existing authentication, purchase verification, and backend services remain in use.

Orientation is now `default` in `app.json`. Existing development builds need a native rebuild to pick up orientation settings. The local iOS plist has also been updated to allow landscape.

## Validation

Run from the app folder. These commands use the project's installed tools and do not download packages:

```sh
cd "/Users/merricklee/Documents/Projects/Arborist Dog - App/Untitled/arboristdog-app"
node --test tests/adaptive-experience.test.cjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js app components hooks stores utils tests
node node_modules/expo/bin/cli export --platform ios --output-dir /tmp/arboristdog-ios-check
```

The source screens were additionally checked in an isolated React Native web preview with fixture services at 320 × 700, 736 × 900, and 844 × 390. The preview does not ship with the app. Resizing was checked for signup input, symptom notes, camera mounting, and single analysis invocation. History selection and opening the corresponding assessment were checked as well.

Before release, test on a native iPhone/iPad or simulator: rotate with the camera open, rotate with the keyboard open, deny camera access and choose a gallery image, resize during analysis, open a past scan, complete a consultation, and verify purchases. No physical folding iPhone hardware was available for testing.

The project's pre-existing static web export currently fails because Supabase's AsyncStorage setup accesses `window` during server rendering. That web-hosting issue is separate from the native layout change; the iOS bundle builds successfully.
