import 'dotenv/config';

export default ({ config }) => {
  if (process.env.APP_ENV === 'production') {
    const required = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'EXPO_PUBLIC_PRIVACY_POLICY_URL'];
    const missing = required.filter(key => !process.env[key] || /placeholder|your_.*_here/.test(process.env[key]));
    if (missing.length) throw new Error(`Missing production configuration: ${missing.join(', ')}`);
    if (!process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY.startsWith('appl_')) {
      throw new Error('Production iOS requires an App Store RevenueCat public SDK key (appl_).');
    }
    if (!process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL.startsWith('https://')) {
      throw new Error('Privacy Policy must use a published HTTPS URL.');
    }
  }
  return ({
  ...config,
  ios: {
    ...config.ios,
    config: {
      ...config.ios?.config,
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
    },
  },
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: {
        ...config.android?.config?.googleMaps,
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
    },
  },
  extra: {
    ...config.extra,
  }
});
};
