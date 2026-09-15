import type { Meta, StoryObj } from "@storybook/react-native";
import { HistoryItem } from "./HistoryItem";

const meta = {
  title: "UI/HistoryItem",
  component: HistoryItem,
  argTypes: {
    onPress: { action: "pressed" },
    onDeletePress: { action: "deletePressed" },
    routeText: { control: "text" },
    metaText: { control: "text" },
  },
  args: {
    routeText: "東京IC → 海老名JCT",
    metaText: "1時間19分 • ¥3,200",
  },
} satisfies Meta<typeof HistoryItem>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    routeText: "東京IC → 海老名JCT",
    metaText: "1時間19分 • ¥3,200",
  },
};

export const LongRoute: Story = {
  args: {
    routeText: "東名高速 東京料金所 → 名神高速 京都東IC",
    metaText: "4時間30分 • ¥8,450",
  },
};
