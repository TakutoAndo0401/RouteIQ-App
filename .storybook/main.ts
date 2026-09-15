import type { StorybookConfig } from "@storybook/react-native";

const main: StorybookConfig = {
  stories: ["../src/components/ui/**/*.stories.?(ts|tsx)"],
  deviceAddons: ["@storybook/addon-ondevice-controls", "@storybook/addon-ondevice-actions"],
};

export default main;
