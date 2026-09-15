// url=https://www.figma.com/design/179eOKzipgKbiI86TZGAT0/%E5%AE%89%E8%97%A4%E3%81%8A%E8%A9%A6%E3%81%97%E4%BD%9C%E6%A5%AD%E7%94%A8%EF%BC%88%E3%82%B3%E3%83%B3%E3%83%9D%E3%83%BC%E3%83%8D%E3%83%B3%E3%83%88%EF%BC%89?node-id=1-472
// component=input-field

import figma from "figma";

const state = figma.selectedInstance.getEnum("状態", {
  現在地ボタンあり: "現在地ボタンあり",
  現在地ボタンなし: "現在地ボタンなし",
  取得中: "取得中",
});

export default {
  id: "input-field",
  imports: ['import { InputField } from "./InputField";'],
  example: figma.code`<InputField
  label="出発地"
  placeholder="出発地を入力（例: 東京駅）"
  ${figma.helpers.react.renderProp("state", state)}
/>`,
  metadata: { nestable: true },
};
