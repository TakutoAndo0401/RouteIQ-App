import type { Meta, StoryObj } from "@storybook/react-native";
import { Button } from "./Button";

const meta = {
  title: "UI/Button",
  component: Button,
  argTypes: {
    onPress: { action: "pressed" },
    state: {
      control: "select",
      options: ["Default", "Hover", "Pressed", "Disabled", "Focus", "Compact", "Compact Outline"],
    },
    disabled: { control: "boolean" },
    loading: { control: "boolean" },
  },
  args: {
    label: "ルートを比較する",
    state: "Default",
    disabled: false,
    loading: false,
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    state: "Default",
  },
};

export const Hover: Story = {
  args: {
    state: "Hover",
  },
};

export const Pressed: Story = {
  args: {
    state: "Pressed",
  },
};

export const Disabled: Story = {
  args: {
    state: "Disabled",
    disabled: true,
  },
};

export const Focus: Story = {
  args: {
    state: "Focus",
  },
};

export const Compact: Story = {
  args: {
    state: "Compact",
    label: "決定",
  },
};

export const CompactOutline: Story = {
  args: {
    state: "Compact Outline",
    label: "キャンセル",
  },
};

export const Loading: Story = {
  args: {
    loading: true,
  },
};
