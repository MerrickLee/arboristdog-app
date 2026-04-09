# 🌳 ArboristDog

**Powered by [Almstead Tree, Shrub & Lawn Care](https://www.almstead.com/)**

ArboristDog is an AI-powered React Native mobile application built to instantly diagnose landscape health issues and seamlessly bridge the gap between concerned property owners and certified arboricultural professionals.

---

## 🎯 Use Case

Property owners frequently notice troubling signs in their trees, shrubs, or lawns—such as discoloration, wilting, or pest activity—but lack the specialized knowledge to identify the problem or know how urgently to act. 

**With ArboristDog:**
1. **Capture:** The user snaps a photo of the affected plant directly in the app.
2. **Contextualize:** The user selects observed symptoms, provides a brief description, and confirms their location.
3. **Analyze:** The app leverages advanced AI (Anthropic Claude Vision) combined with localized weather and hardiness data to instantly generate a diagnosis.
4. **Action:** The user receives a plain-language explanation of the issue, a confidence score, and prioritized next steps.
5. **Connect:** With one tap, the user requests a free consultation, sending a comprehensive lead package directly to a certified Almstead arborist for follow-up.

---

## 🤝 Who it Helps

### 🏡 Property Owners (Residential & Commercial)
- **Instant Clarity:** Transforms anxiety and confusion over dying plants into immediate, understandable, and actionable insights.
- **Convenience:** Replaces the friction of searching the web or calling around with a unified, modern mobile experience.
- **Expert Access:** Offers a direct, low-friction pipeline to professional help (ISA-certified arborists) when physical intervention is necessary.

### 💼 Almstead Arborists & Sales Teams
- **Highly Qualified Leads:** Filters out generic inquiries by delivering detailed lead packages that include photo evidence, symptom history, GPS location, and property type.
- **Pre-Diagnosed Context:** Arborists walk into consultations already knowing the potential issue, regional conditions, and prior AI analysis, making the sales process more efficient.
- **Customer Verification:** Automatically recognizes and rewards existing Almstead clients with an unlimited tier, encouraging brand loyalty and retention.

---

## 🛠 Features

- **Cross-Platform Mobile App:** Built with React Native (Expo) for both iOS and Android.
- **AI Diagnostics:** Integrates with Claude to parse images alongside user-provided symptoms and localized environmental data.
- **Lead Generation Hub:** Fully integrated with Zapier to automatically route consultation requests into Slack, Email, and CRM systems.
- **Credit & Monetization Engine:** Users receive a set number of free scans, with an optimized in-app-purchase (RevenueCat) flow to secure more credits.
- **Premium Design System:** A clean, modern UI featuring micro-animations, vibrant landscape-inspired color palettes, and intuitive walkthrough flows to instill trust and elegance.

---

## 🚀 Getting Started

ArboristDog uses native modules (Google Maps, RevenueCat) and requires a **Development Build** to run on a physical device.

**1. Install Dependencies**
```bash
npm install
```

**2. Configure Environment**
Create a `.env` file in the root and add your `EXPO_PUBLIC_` keys (see `eas_secrets_list.md` for the full list).

**3. Generate Native Projects**
```bash
npx expo prebuild
```

**4. Run on Device**
- **iOS:** Open `ios/arboristdogapp.xcworkspace` in Xcode, set your Signing Team, and hit **Play**.
- **Android:** Run `npx expo run:android`.

---

## ⚙️ Technical Architecture

ArboristDog is built for production scale with a secure, serverless backend.

### 🗄️ Backend (Supabase)
- **Database:** PostgreSQL schema for user profiles, diagnosis history, and scan credits. See [**`supabase_schema.sql`**](file:///Users/merricklee/Documents/Projects/Arborist%20Dog%20-%20App/Untitled/arboristdog-app/supabase_schema.sql).
- **Storage:** Secure bucket for high-res diagnosis photos. See [**`supabase_storage.sql`**](file:///Users/merricklee/Documents/Projects/Arborist%20Dog%20-%20App/Untitled/arboristdog-app/supabase_storage.sql).
- **Edge Functions:** Secure Deno function (`analyze-plant`) handles Claude 3.5 Sonnet Vision calls.

### 💰 Monetization (RevenueCat)
- Handles all In-App Purchases and Entitlements.
- Syncs purchase events directly to the Supabase credit system.

### ⚡ Automation (Zapier)
- Routes high-intent leads to Almstead sales teams.
- Sends detailed structured payloads: User info, Symptoms, AI Analysis, and Supabase Image URLs.

---

*Confidential & Proprietary – ArboristDog Application architecture and design patterns prepared for Almstead Tree, Shrub & Lawn Care.*
