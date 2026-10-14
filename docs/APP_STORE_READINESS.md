# Arborist Dog release status — October 5, 2026

No production IPA has been built or submitted to TestFlight yet.

## Completed

- Paywall reads localized App Store products and prices from RevenueCat's current offering; handles cancellation, errors, refresh, restore, and subscription management. It includes Apple's standard EULA link and supports a configured Privacy Policy link.
- Purchases use the authenticated Supabase UUID as the RevenueCat App User ID. No client-supplied credit amounts are trusted.
- Deployed `sync-purchases` and updated `lookup-customer` to Supabase project `foxmafqwqinbhemdoirz`. The purchase endpoint rejects unauthenticated requests (verified HTTP 401).
- Applied migration `20261005000000_verified_purchases`: unique purchase ledger, server-only grants, preservation of paid scan balances on monthly resets, and protection of customer identity and benefit fields.
- Native Apple Sign-In uses a random nonce, its SHA-256 hash for Apple, and the original nonce for Supabase. First-authorization names are saved. Relay-email users can continue privately or request verified email change. Profile email is synchronized only after Auth changes its confirmed email.
- Bundle identifier is `com.almstead.arboristdog`; `usesAppleSignIn` remains enabled and generated entitlement is `com.apple.developer.applesignin: [Default]`.
- Production EAS profile uses store distribution, the production environment, and automatic build-number increments. Submission points at Apple app `6795171041`, team `8NH64CG58D`.
- Icon is 1024 × 1024, RGB, without alpha. Splash asset inspected; startup appearance still needs a native production-build check.
- Screenshot copies in `store-assets/drafts/iphone-6.5` are 1284 × 2778. Copies in `store-assets/drafts/iphone-5.5` are 1242 × 2208. Images preserve their proportions with padding. Originals remain intact.

## Verified dashboard state

- RevenueCat project: `ArboristDog` (`d4469f43`). Current/default offering: `default`, with `3_credits` and `$rc_monthly` packages.
- iOS product IDs: `com.almstead.arboristdog.3credits` (consumable) and `com.almstead.arboristdog.monthly` (one month).
- Existing entitlement: `premium_access`. Both scan packs and subscriptions are attached. The app also checks the actual monthly subscription, so the consumable entitlement cannot imply an active subscription. Consider removing scan packs from this entitlement after confirming impact on existing apps.
- RevenueCat's App Store in-app purchase credentials show Valid credentials. After Paid Apps Agreement acceptance, RevenueCat App Store Connect API credentials revalidated successfully: Valid credentials, app-list permissions and subscription-info permissions confirmed.
- Apple app version, credit pack, subscription, and subscription group are Prepare for Submission. Products already have English localization. Product review screenshots are still absent.
- App Store Connect has zero uploaded iPhone screenshots, no selected build, no Privacy Policy URL, and an unfinished App Privacy questionnaire. Support URL is `https://www.almstead.com/contact`; availability of the published page still needs confirmation.
- Apple Developer license agreement acceptance confirmed: the blocking banner is gone and Certificates, Identifiers & Profiles resources are accessible. App Store Connect Business confirms Free Apps Agreement is Active (October 5, 2026 onward), but Paid Apps Agreement has been accepted and now shows Pending User Info: no bank account is configured and U.S. Form W-9 is Active (verified October 5, 2026). Digital Services Act compliance is now Active (verified October 5, 2026). The account holder completed the W-9 and has deferred bank setup. Continue preparation; banking remains a release gate.
- Supabase Apple Auth provider is disabled. Native client ID should be `com.almstead.arboristdog`; enabling it is awaiting the requested approval. Apple Developer App ID capability is confirmed already enabled. Native-only Apple login does not require an OAuth client secret.
- Expo CLI and browser now use `merrickalmstead`. EAS project is now linked: `@merrickalmstead/arborist-dog`, ID `c49be408-323c-4575-b916-01f1efed59c2`; CLI access verified after account switch.

## Remaining configuration and review gates

1. Updated Developer Program License Agreement accepted. Still confirm Paid Applications agreement, tax/banking status, and EU trader status where applicable.
2. Approve/enable the Supabase native Apple provider and verify Apple Developer App ID capability once account resources are accessible. Test both shared and private Apple emails and confirmed relinking on device.
3. RevenueCat server configuration is now set: existing public App Store SDK key in `REVENUECAT_API_KEY`, `REVENUECAT_ALLOW_SANDBOX=true`, and entitlement `premium_access`. The customer-info API accepts the public SDK key; no private key was created. Verify authenticated sandbox purchases on device. The function restricts credits to verified App Store products and authenticates every caller.
4. Choose the correct Expo owner, link the existing project (or create one if none exists), and configure production environment variables. At minimum: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` (App Store `appl_` key), `EXPO_PUBLIC_PRIVACY_POLICY_URL`. Optional `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=premium_access`. Production config rejects missing keys/policy URL.
5. Publish an app-specific Privacy Policy and enter its HTTPS URL both in Expo production configuration and App Store Connect. Complete the App Privacy questionnaire using actual photo, location, account, diagnosis, purchase, analytics and service-request data practices. Confirm EULA selection; the app links Apple's standard EULA.
6. Capture clean screenshots from the updated native app. Existing drafts show development warnings and older free-scan copy and must not be uploaded as final screenshots. The app supports iPad, so provide required iPad screenshots too. Add paywall screenshots to both IAP review records.
7. Confirm product benefits: local StoreKit fixture uses $2.99 for 3 scans and $4.99 monthly for 10 scans. Apple's subscription description also promises priority service; verify that operational benefit before submission. Monthly scans are currently granted on each verified active renewal, retained as paid balance, and reconciled when the paywall opens/restores. Background renewal/refund webhook reconciliation is not implemented; confirm whether that behavior matches the intended product policy.
8. Verify in-app account deletion, reviewer account access, free allowance resets,  and analytics disclosures before declaring the app review-ready. Account deletion is not currently implemented and remains an App Review gap. The prepared diagnosis update requires authentication, accepts only the caller’s uploaded image, reserves credits on the server, saves results once, and refunds failed diagnoses. On-device diagnosis testing remains required.
9. Build and submit using `eas build --platform ios --profile production`, then submit the exact successful build using `eas submit --platform ios --profile production --id BUILD_ID`. Complete internal sandbox testing before App Review. Attach first IAPs to the first app-version submission.

## Validation performed

- App TypeScript check passed.
- Expo lint passed with zero errors and six warnings.
- Final iOS Hermes JavaScript bundle exported successfully to `/tmp/arboristdog-final-export` after the latest scan-credit and Settings edits. A signed production native build is still required.
- Six purchase verification tests passed: expiry/refund/store rejection, sandbox opt-in, cancellation/grace period, stable ledger keys/renewal differentiation, invalid consumables, and consumable entitlement isolation. They do not replace on-device StoreKit testing or database concurrency testing.
- Native Expo configuration introspection confirmed bundle identifier, Apple entitlement, and privacy permission strings.
- Supabase migration application and both function deployments completed successfully.

## Reference documentation

- [RevenueCat Expo setup](https://www.revenuecat.com/docs/getting-started/installation/expo)
- [RevenueCat customer info API](https://www.revenuecat.com/docs/api-v1/customer-info-model)
- [Supabase native Apple Auth](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)

## Latest preparation

- Settings links to the configured Privacy Policy and Apple standard EULA.
- Diagnosis model updated from retired Claude 3.5 Sonnet to configurable `ANTHROPIC_MODEL`, default `claude-sonnet-4-6`. No paid model test was run.
- Native screenshot capture is blocked by the missing Simulator application at the configured Xcode installation. Existing resized drafts are not submission-ready.

- Deployment status: `20261005000001_analysis_credit_reservations.sql` passed the remote dry run, but the subsequent database login stalled twice. The migration and updated `analyze-plant` function have not been deployed. Deploy the migration before the function; deploy both before building this client update. Local TypeScript, lint (zero errors, six warnings), six purchase tests, diff checks, and iOS export passed.

- Expo production settings configured successfully for the linked project: Supabase URL, public anon key, and RevenueCat iOS public SDK key. Privacy Policy URL remains missing. No production build started.

- Created and saved GoHighLevel privacy page draft in the existing Arborist Dog website. Page ID `aHu9fS1HJpdIx9YHElPp`, intended URL `https://arboristdog.com/privacy-policy`. Preview verified: `https://link.almstead.com/preview/aHu9fS1HJpdIx9YHElPp?notrack=true`. Publishing awaits approval of privacy commitments; local copy in `docs/PRIVACY_POLICY_DRAFT.html`. Do not configure the production policy URL until publication is verified.

- Approved Privacy Policy published October 5, 2026 at `https://arboristdog.com/privacy-policy`; public page verified without authentication. URL configured in local environment and Expo production environment. Production Expo configuration validation passed. App Store Connect Privacy Policy URL saved and visibly verified; App Privacy questionnaire remains separate and unfinished.

- App Privacy questionnaire completed and saved as a draft: name, email, phone, physical address, precise/coarse location, photos, other user content, user ID, purchase history, product interaction, other diagnostic data. All marked linked to identity and not used for tracking. App functionality for operational data; analytics also for IDs/purchases; product interactions for analytics. Apple final publishing declaration is open, awaiting action-time approval of accuracy, legal compliance, and future updates. Review labels before changing analytics configuration or service-request marketing practices.

- App Privacy answers published by Merrick Lee, verified in App Store Connect October 5, 2026. The page displays the publication timestamp and all twelve completed data types. Privacy Policy and questionnaire setup are complete.

- Native Apple Sign-In enabled and verified in Supabase for `com.almstead.arboristdog`; invalid OAuth secret cleared with explicit user approval.
- Credit-reservation migration `20261005000001_analysis_credit_reservations.sql` successfully applied; updated `analyze-plant` deployed. Anonymous POST verified HTTP 401.
- Production build preparation reached Apple signing login successfully through existing Keychain credentials. Apple requires two-factor authentication; canceled the agent session so the account holder can complete interactive build in their terminal. No cloud build has been queued or submitted. Remote build number initialized and incremented to 2; standard/exempt encryption setting persisted by EAS in app.json.

- Production iOS build 3 (`2b50a48b-330f-4d98-8a5a-d26dd02f7b60`) finished successfully October 5, 2026. Build 4 (`e8c28040-b45f-4b2a-8ac0-0844984b6328`) failed before starting with Expo INTERNAL_SERVER_ERROR/503. Both fingerprints match. Submit exact build 3; no rebuild needed for this failure. Noninteractive submission blocked by missing App Store Connect API credentials; interactive setup required. Submission profile now specifies `mlee@almstead.com` as requested.


## App Store listing asset update — October 6, 2026

Build 3 is uploaded to Apple and selected for version 1.0. Correct included icon verified visually. Two actual iPhone screenshots (1206 × 2622) and two actual iPad screenshots (2064 × 2752) uploaded and verified; see `store-assets/screenshots/README.md`. Listing subtitle, Utilities category, description, promotional text, support link and copyright saved. Diagnosis/history/credits screenshots need a signed-in app session. Age ratings and content rights remain unset in App Information. No review submission initiated. Current local code changes require a newer production build. TypeScript and lint passed (six existing lint warnings); local simulator release build passed.


## Onboarding save delay fixed — October 6, 2026

The customer eligibility lookup no longer blocks navigation after onboarding saves. Email verification, onboarding saves, and profile/location saves now have a 15-second deadline, and profile requests are aborted on timeout. Customer lookup results preserve the current profile and cannot restore a signed-out or different user. Four timeout tests pass; TypeScript passes; lint reports zero errors and six existing warnings. Verified the signed-in iPhone simulator proceeds from Get Started to location setup. Additional actual location, empty scan-history, and how-it-works screenshots are saved under `store-assets/screenshots/iphone-6.3/` but not yet uploaded. This fix is local and must be included in a newer production build; Apple build 3 is unchanged.

With explicit user approval, a built-in non-personal simulator plant sample was selected through the native photo picker (the imported USDA photo was not the selected image) and submitted for one real diagnosis, with no address/GPS supplied. The server returned an assessment and balance 0, and Scan History displayed the saved scan. Actual symptoms, diagnosis and populated-history screenshots are saved as 06–08 in the iPhone directory. The three captures were uploaded after the user enabled Chrome file access; Apple finished processing and displays five iPhone screenshots total. This verifies one successful analysis and credit deduction, not diagnosis accuracy or IAP purchase behavior.

- iPhone Duo gallery: five proportion-preserving formatted copies uploaded at 1398 × 2034; processing complete and count verified. No native Duo simulator testing performed.

## Duo layout audit in progress — October 6, 2026

Added a persistent Expo config plugin for the UIKit scene lifecycle, including window creation, URL/user-activity forwarding, and Expo lifecycle forwarding. Release build with Xcode 27.1 / iOS 27.1 SDK succeeds and launches on Duo. Shared layout no longer caps overall width; sign-in and credits use stack navigation rather than native sheets. All app view files inspected for width, safe-area, scrolling and keyboard layout. Layout tests (4) and TypeScript pass; lint has no errors and six existing warnings. Native welcome and sign-in captures are 2853 × 2007. Welcome/sign-in visually checked in open, closed and partially open poses; right-edge black strip is eliminated. Signed-in view audit and final screenshot replacement await user sign-in. Temporary simulator RevenueCat compiler patch restored after build. This does not update Apple build 3.

### Signed-in Duo checks — October 6, 2026

- User signed into the rebuilt native Duo app. Capture, empty history, settings, credits, symptom selection, location form, and onboarding were visually checked at full open width.
- Credits scrolls to its lower controls. Packages are unavailable in this simulator session; no purchase was attempted.
- Warm URL navigation through the scene delegate successfully opened capture and onboarding.
- This account has no saved diagnoses and 3 free scans. Permission requested to use one free scan on the public plant photo before auditing analyzing/results and taking populated history screenshots.
- Added native symptom and how-it-works screenshots to iphone-duo-native, alongside welcome and sign-in. Gallery replacement is pending the remaining result/history audit.

### Native Duo audit and gallery completed — October 6, 2026

- User authorized one free scan of the public USDA plant photo. Analysis completed successfully, generated a real diagnosis, and saved one history record.
- Visually checked analyzing, results, populated history, the selected-history pane, full diagnosis restoration, expert request form (no request submitted), and onboarding location. Long result, history-detail, credit, and location-form content scrolls; fixed action buttons remain accessible.
- All app routes were reviewed in source; core view layouts were visually audited on the native open Duo. Earlier welcome/sign-in checks included closed and partially open poses. Purchase packages remain unavailable in this simulator, so purchasing was not validated.
- Replaced the five older formatted Duo screenshots in App Store Connect with five actual 2853 × 2007 native screenshots: welcome, sign-in, symptoms, how-it-works, and populated history. Upload processing completed; Save was disabled after completion. Old assets remain recoverable from the Asset Library.
- Automatic upload approval initially rejected the diagnosis image because its support pane displayed a street address. Excluded that image and inspected the history screenshot to confirm it contains no street address or private contact details before uploading the safer set.
- Native diagnosis screenshot retained locally only. No additional scan or consultation was submitted.
- App Store version still selects build 3. The scene lifecycle and full-width changes require a new production build before review.
- Credit display changed from 3 before the scan to 0 afterward; this discrepancy needs investigation before claiming credit accounting is validated.
