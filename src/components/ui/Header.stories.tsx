import React from "react";
import type { Meta, StoryObj } from "@storybook/react-native";
import { Header, BackHeader } from "./Header";

const meta = {
  title: "UI/Header",
  component: Header,
  argTypes: {
    title: { control: "text" },
    tag: { control: "text" },
  },
  args: {
    tag: "ROUTEIQ | CALM UTILITY",
    title: "道路状況チェック",
  },
} satisfies Meta<typeof Header>;

export default meta;

type Story = StoryObj<typeof meta>;

export const BrandHeader: Story = {
  args: {
    tag: "ROUTEIQ | CALM UTILITY",
    title: "道路状況チェック",
  },
};

export const NavigationBackHeader: Story = {
  render: () => <BackHeader title="ルート詳細・比較結果" backLabel="戻る" onBackPress={() => {}} />,
};
