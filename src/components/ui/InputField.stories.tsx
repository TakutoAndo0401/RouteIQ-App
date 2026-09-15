import type { Meta, StoryObj } from "@storybook/react-native";
import { InputField } from "./InputField";

const meta = {
  title: "UI/InputField",
  component: InputField,
  argTypes: {
    onChangeText: { action: "changed" },
    onCurrentLocationPress: { action: "currentLocationPressed" },
    onMapSelectPress: { action: "mapSelectPressed" },
    state: {
      control: "select",
      options: ["現在地ボタンあり", "現在地ボタンなし", "取得中"],
    },
    label: { control: "text" },
    placeholder: { control: "text" },
    value: { control: "text" },
  },
  args: {
    label: "出発地",
    placeholder: "IC名や地名を入力",
    value: "東京IC",
    state: "現在地ボタンあり",
  },
} satisfies Meta<typeof InputField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithCurrentLocation: Story = {
  args: {
    label: "出発地",
    value: "渋谷駅",
    state: "現在地ボタンあり",
  },
};

export const WithoutCurrentLocation: Story = {
  args: {
    label: "目的地",
    value: "名古屋IC",
    state: "現在地ボタンなし",
  },
};

export const FetchingLocation: Story = {
  args: {
    label: "出発地",
    state: "取得中",
  },
};
