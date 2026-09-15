// url=https://www.figma.com/design/179eOKzipgKbiI86TZGAT0/%E5%AE%89%E8%97%A4%E3%81%8A%E8%A9%A6%E3%81%97%E4%BD%9C%E6%A5%AD%E7%94%A8%EF%BC%88%E3%82%B3%E3%83%B3%E3%83%9D%E3%83%BC%E3%83%8D%E3%83%B3%E3%83%88%EF%BC%89?node-id=1-226
// component=Toast

import figma from "figma";

const type = figma.selectedInstance.getEnum("Type", {
  Success: "Success",
  Error: "Error",
});

export default {
  id: "Toast",
  imports: ['import { Toast } from "./Toast";'],
  example: figma.code`<Toast
  message="ルート検索が完了しました"
  ${figma.helpers.react.renderProp("type", type)}
/>`,
  metadata: { nestable: true },
};
