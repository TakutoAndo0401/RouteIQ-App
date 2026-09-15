import type { Meta, StoryObj } from "@storybook/react-native";
import { RouteCard } from "./RouteCard";

const meta = {
  title: "UI/RouteCard",
  component: RouteCard,
  argTypes: {
    onPress: { action: "pressed" },
    type: {
      control: "select",
      options: ["highway", "general"],
    },
    isRecommended: { control: "boolean" },
    durationMinutes: { control: "number" },
    tollYen: { control: "number" },
    fuelCostYen: { control: "number" },
  },
  args: {
    type: "highway",
    durationMinutes: 79,
    tollYen: 3200,
    fuelCostYen: 1450,
    isRecommended: true,
  },
} satisfies Meta<typeof RouteCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const HighwayRoute: Story = {
  args: {
    type: "highway",
    isRecommended: true,
    durationMinutes: 79,
    tollYen: 3200,
    fuelCostYen: 1450,
    tollBreakdown: [
      { label: "東京IC → 海老名JCT", amount: "¥1,420" },
      { label: "海老名JCT → 厚木IC", amount: "¥1,780" },
    ],
  },
};

export const GeneralRoute: Story = {
  args: {
    type: "general",
    isRecommended: false,
    durationMinutes: 149,
    tollYen: 0,
    fuelCostYen: 1820,
  },
};
