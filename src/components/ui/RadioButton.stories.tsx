import type { Meta, StoryObj } from "@storybook/react-native";
import { RadioButton } from "./RadioButton";

const meta = {
  title: "UI/RadioButton",
  component: RadioButton,
  argTypes: {
    onPress: { action: "pressed" },
    selected: { control: "boolean" },
    disabled: { control: "boolean" },
    label: { control: "text" },
  },
  args: {
    label: "高速優先",
    selected: true,
    disabled: false,
  },
} satisfies Meta<typeof RadioButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Selected: Story = {
  args: {
    selected: true,
    label: "高速道路優先",
  },
};

export const Unselected: Story = {
  args: {
    selected: false,
    label: "一般道路優先",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    selected: false,
    label: "選択不可",
  },
};
