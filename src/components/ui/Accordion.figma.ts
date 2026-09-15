// url=https://www.figma.com/design/179eOKzipgKbiI86TZGAT0/%E5%AE%89%E8%97%A4%E3%81%8A%E8%A9%A6%E3%81%97%E4%BD%9C%E6%A5%AD%E7%94%A8%EF%BC%88%E3%82%B3%E3%83%B3%E3%83%9D%E3%83%BC%E3%83%8D%E3%83%B3%E3%83%88%EF%BC%89?node-id=1-155
// component=Accordion

import figma from "figma";

const state = figma.selectedInstance.getEnum("State", {
  Open: "Open",
  Closed: "Closed",
});

export default {
  id: "Accordion",
  imports: ['import { Accordion } from "./Accordion";'],
  example: figma.code`<Accordion
  title="詳細条件（燃費・時間価値など）"
  ${figma.helpers.react.renderProp("state", state)}
  onEditPress={() => {}}
>
  {/* 詳細コンテンツ */}
</Accordion>`,
  metadata: { nestable: true },
};
