// url=https://www.figma.com/design/179eOKzipgKbiI86TZGAT0/%E5%AE%89%E8%97%A4%E3%81%8A%E8%A9%A6%E3%81%97%E4%BD%9C%E6%A5%AD%E7%94%A8%EF%BC%88%E3%82%B3%E3%83%B3%E3%83%9D%E3%83%BC%E3%83%8D%E3%83%B3%E3%83%88%EF%BC%89?node-id=1-113
// component=ActionFooter

import figma from "figma";

const state = figma.selectedInstance.getEnum("State", {
  Default: "Default",
  Disabled: "Disabled",
  Loading: "Loading",
});

export default {
  id: "ActionFooter",
  imports: ['import { ActionFooter } from "./ActionFooter";'],
  example: figma.code`<ActionFooter
  label="ルートを比較する"
  ${figma.helpers.react.renderProp("state", state)}
  onPress={() => {}}
/>`,
  metadata: { nestable: true },
};
