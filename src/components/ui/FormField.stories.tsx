import type { Meta, StoryObj } from "@storybook/react-native";
import { FormField } from "./FormField";

const meta = {
  title: "UI/FormField",
  component: FormField,
  argTypes: {
    onChangeText: { action: "changed" },
    label: { control: "text" },
    value: { control: "text" },
    unit: { control: "text" },
  },
  args: {
    label: "燃費 (km/L)",
    value: "15.0",
    unit: "km/L",
  },
} satisfies Meta<typeof FormField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FuelEfficiency: Story = {
  args: {
    label: "燃費 (km/L)",
    value: "15.0",
    unit: "km/L",
  },
};

export const GasolinePrice: Story = {
  args: {
    label: "ガソリン単価",
    value: "175",
    unit: "円/L",
  },
};

export const TimeValue: Story = {
  args: {
    label: "時間価値",
    value: "3,000",
    unit: "円/時",
  },
};
