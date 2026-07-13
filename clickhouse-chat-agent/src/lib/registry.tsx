"use client";

import { defineRegistry } from "@json-render/react";
import { shadcnComponents } from "@json-render/shadcn";
import {
  AreaChartView,
  BarChartView,
  LineChartView,
  PieChartView,
  StatView,
} from "@/components/charts";
import { PointMapView } from "@/components/point-map";
import { catalog } from "./catalog";

export const { registry } = defineRegistry(catalog, {
  components: {
    Card: shadcnComponents.Card,
    Stack: shadcnComponents.Stack,
    Grid: shadcnComponents.Grid,
    Heading: shadcnComponents.Heading,
    Text: shadcnComponents.Text,
    Badge: shadcnComponents.Badge,
    Separator: shadcnComponents.Separator,
    Table: shadcnComponents.Table,
    BarChart: ({ props }) => <BarChartView {...props} />,
    LineChart: ({ props }) => <LineChartView {...props} />,
    AreaChart: ({ props }) => <AreaChartView {...props} />,
    PieChart: ({ props }) => <PieChartView {...props} />,
    Stat: ({ props }) => <StatView {...props} />,
    PointMap: ({ props }) => <PointMapView {...props} />,
  },
});
