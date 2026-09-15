import type { Meta, StoryObj } from "@storybook/react-native";
import { AlertBanner } from "./AlertBanner";

const meta = {
  title: "UI/AlertBanner",
  component: AlertBanner,
  argTypes: {
    type: {
      control: "select",
      options: ["Recommendation", "Warning", "Traffic"],
    },
    title: { control: "text" },
    description: { control: "text" },
  },
  args: {
    title: "高速道路ルートがおすすめ",
    description: "所要時間を1時間10分短縮できます。時間価値を考慮すると高速道路がお得です。",
    type: "Recommendation",
  },
} satisfies Meta<typeof AlertBanner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Recommendation: Story = {
  args: {
    type: "Recommendation",
    title: "高速道路ルートがおすすめ",
    description: "所要時間を1時間10分短縮できます。時間価値を考慮すると高速道路がお得です。",
  },
};

export const Warning: Story = {
  args: {
    type: "Warning",
    title: "一般道路が混雑しています",
    description: "事故による渋滞が発生しており、通常より30分以上遅れる見込みです。",
  },
};

export const Traffic: Story = {
  args: {
    type: "Traffic",
    title: "交通情報",
    description: "東名高速道路 集中工事による車線規制があります。",
  },
};
