import type { Meta, StoryObj } from "@storybook/react-native";
import { ActionFooter } from "./ActionFooter";

const meta = {
  title: "UI/ActionFooter",
  component: ActionFooter,
  argTypes: {
    onPress: { action: "pressed" },
    state: {
      control: "select",
      options: ["Default", "Disabled", "Loading"],
    },
    label: { control: "text" },
    loadingText: { control: "text" },
  },
  args: {
    label: "ルートを比較する",
    state: "Default",
    loadingText: "最適なルートを計算中...",
  },
} satisfies Meta<typeof ActionFooter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    state: "Default",
    label: "ルートを比較する",
  },
};

export const Disabled: Story = {
  args: {
    state: "Disabled",
    label: "ルートを比較する",
  },
};

export const Loading: Story = {
  args: {
    state: "Loading",
    loadingText: "最適なルートを計算中...",
  },
};
