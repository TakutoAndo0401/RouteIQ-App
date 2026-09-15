// url=https://www.figma.com/design/179eOKzipgKbiI86TZGAT0/%E5%AE%89%E8%97%A4%E3%81%8A%E8%A9%A6%E3%81%97%E4%BD%9C%E6%A5%AD%E7%94%A8%EF%BC%88%E3%82%B3%E3%83%B3%E3%83%9D%E3%83%BC%E3%83%8D%E3%83%B3%E3%83%88%EF%BC%89?node-id=7-248
// component=RouteCard_Highway

import figma from "figma";

export default {
  id: "RouteCard_Highway",
  imports: ['import { RouteCard } from "./RouteCard";'],
  example: figma.code`<RouteCard
  type="highway"
  title="高速道路ルート"
  durationMinutes={75}
  distanceKm={98.5}
  tollYen={3250}
  fuelCostYen={1100}
  totalCostYen={4350}
  isRecommended={true}
  etaText="14:15着"
  breakdownItems={[
    { label: "首都高速", cost: "¥1,950" },
    { label: "東名高速", cost: "¥1,300" },
  ]}
/>`,
  metadata: { nestable: true },
};
