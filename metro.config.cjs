const { getDefaultConfig } = require("expo/metro-config");
const { withStorybook } = require("@storybook/react-native/metro/withStorybook");

const config = getDefaultConfig(__dirname);
const isStorybookEnabled = process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === "true";

module.exports = withStorybook(config, {
  enabled: isStorybookEnabled,
  configPath: "./.storybook",
});
