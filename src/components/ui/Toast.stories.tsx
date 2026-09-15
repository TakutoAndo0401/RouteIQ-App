import type { Meta, StoryObj } from "@storybook/react-native";
import { Toast } from "./Toast";

const meta = {
  title: "UI/Toast",
  component: Toast,
  argTypes: {
    variant: {
      control: "select",
      options: ["success", "error"],
    },
    message: { control: "text" },
  },
  args: {
    message: "設定を保存しました",
    variant: "success",
  },
} satisfies Meta<typeof Toast>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Success: Story = {
  args: {
    variant: "success",
    message: "設定を保存しました",
  },
};

export const ErrorState: Story = {
  args: {
    variant: "error",
    message: "エラーが発生しました。再度お試しください",
  },
};
