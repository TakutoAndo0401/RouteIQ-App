import type { Meta, StoryObj } from "@storybook/react-native";
import { Accordion } from "./Accordion";

const meta = {
  title: "UI/Accordion",
  component: Accordion,
  argTypes: {
    onEditPress: { action: "editPressed" },
    state: {
      control: "select",
      options: ["Open", "Closed"],
    },
    title: { control: "text" },
    showEditButton: { control: "boolean" },
  },
  args: {
    title: "詳細条件（燃費・時間価値など）",
    state: "Open",
    showEditButton: true,
    items: [
      { label: "燃費 (km/L)", value: "15.0 km/L" },
      { label: "ガソリン単価", value: "175 円/L" },
      { label: "時間価値", value: "3,000 円/時" },
      { label: "ETC割引", value: "深夜割引 (30%)" },
    ],
  },
} satisfies Meta<typeof Accordion>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: {
    state: "Open",
  },
};

export const Closed: Story = {
  args: {
    state: "Closed",
  },
};
