// url=https://www.figma.com/design/179eOKzipgKbiI86TZGAT0/%E5%AE%89%E8%97%A4%E3%81%8A%E8%A9%A6%E3%81%97%E4%BD%9C%E6%A5%AD%E7%94%A8%EF%BC%88%E3%82%B3%E3%83%B3%E3%83%9D%E3%83%BC%E3%83%8D%E3%83%B3%E3%83%88%EF%BC%89?node-id=7-250
// component=HistoryItem

import figma from "figma";

export default {
  id: "HistoryItem",
  imports: ['import { HistoryItem } from "./HistoryItem";'],
  example: figma.code`<HistoryItem
  routeText="用賀IC → 御殿場IC"
  metaText="普通車 • 8/9"
  onPress={() => {}}
  onDeletePress={() => {}}
/>`,
  metadata: { nestable: true },
};
