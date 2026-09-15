import React from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { HarnessProvider } from "../src/harness/HarnessContext";
import { colors } from "../src/shared/theme";

function StorybookScreen() {
  const StorybookUIRoot = require("../.storybook").default;
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <StorybookUIRoot />
    </SafeAreaProvider>
  );
}

function MainApp() {
  return (
    <SafeAreaProvider>
      <HarnessProvider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: colors.neutral[50],
            },
          }}
        />
      </HarnessProvider>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  if (process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === "true") {
    return <StorybookScreen />;
  }
  return <MainApp />;
}
