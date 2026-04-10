const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// In Expo Go, native modules like @contentsquare/react-native-bridge
// are not available. Redirect them to a no-op stub so the app doesn't crash.
const isExpoGo = process.env.EXPO_PUBLIC_APP_VARIANT !== "production";

config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    if (moduleName === "@contentsquare/react-native-bridge") {
      return {
        filePath: path.resolve(__dirname, "stubs/contentsquare-stub.js"),
        type: "sourceFile",
      };
    }
    // Fall back to default resolution
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
