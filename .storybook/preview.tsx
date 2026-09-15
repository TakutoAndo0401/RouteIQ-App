import type { Preview } from "@storybook/react-native";
import React from "react";
import { View, StyleSheet } from "react-native";
import { colors } from "../src/shared/theme/colors";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    backgrounds: {
      default: "light",
      values: [
        { name: "light", value: colors.neutral[50] },
        { name: "white", value: colors.base.white },
        { name: "dark", value: colors.neutral[900] },
      ],
    },
  },
  decorators: [
    (Story) => (
      <View style={styles.container}>
        <Story />
      </View>
    ),
  ],
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
    backgroundColor: colors.neutral[50],
  },
});

export default preview;
