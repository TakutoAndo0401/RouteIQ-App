// url=https://www.figma.com/design/179eOKzipgKbiI86TZGAT0/%E5%AE%89%E8%97%A4%E3%81%8A%E8%A9%A6%E3%81%97%E4%BD%9C%E6%A5%AD%E7%94%A8%EF%BC%88%E3%82%B3%E3%83%B3%E3%83%9D%E3%83%BC%E3%83%8D%E3%83%B3%E3%83%88%EF%BC%89?node-id=7-200
// component=BackHeader

import figma from "figma";

export default {
  id: "BackHeader",
  imports: ['import { BackHeader } from "./Header";'],
  example: figma.code`<BackHeader
  title="比較結果"
  backLabel="戻る"
  onBackPress={() => {}}
/>`,
  metadata: { nestable: true },
};
