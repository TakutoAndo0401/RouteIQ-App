import type { Meta, StoryObj } from "@storybook/react-native";
import { ChipButton } from "./ChipButton";

const meta = {
  title: "UI/ChipButton",
  component: ChipButton,
  argTypes: {
    onPress: { action: "pressed" },
    selected: { control: "boolean" },
    label: { control: "text" },
  },
  args: {
    label: "現在地",
    selected: true,
  },
} satisfies Meta<typeof ChipButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Selected: Story = {
  args: {
    selected: true,
    label: "現在地",
  },
};

export const Unselected: Story = {
  args: {
    selected: false,
    label: "自宅",
  },
};
