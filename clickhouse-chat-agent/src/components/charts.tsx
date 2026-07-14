"use client";

import {
  Area,
  AreaChart as RechartsAreaChart,
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as RechartsLineChart,
  Pie,
  PieChart as RechartsPieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type ChartRow = Record<string, string | number | null>;
type Series = { dataKey: string; label?: string | null };

// Series colors cycle through the shadcn theme's --chart-1..5 variables.
// Colors are applied directly (not via ChartContainer's --color-<key> vars)
// because model-written dataKeys like "avg(fare)" aren't valid CSS var names.
function seriesColor(index: number): string {
  return `var(--chart-${(index % 5) + 1})`;
}

// Config carries labels only. Colors are applied directly on the marks
// (Bar/Line/Cell fills) — keeping model/data-derived keys out of the
// stylesheet that ChartStyle would otherwise inject them into.
function buildConfig(series: Series[]): ChartConfig {
  return Object.fromEntries(series.map((s) => [s.dataKey, { label: s.label ?? s.dataKey }]));
}

function ChartFrame({ title, children }: { title?: string | null; children: React.ReactNode }) {
  return (
    <div className="w-full space-y-2">
      {title && <h4 className="text-sm font-medium text-foreground">{title}</h4>}
      {children}
    </div>
  );
}

const xAxisProps = { tickLine: false, axisLine: false, tickMargin: 8, minTickGap: 24 } as const;
const yAxisProps = { tickLine: false, axisLine: false, width: 48 } as const;

export function BarChartView({
  data,
  xKey,
  series,
  title,
  stacked,
}: {
  data: ChartRow[];
  xKey: string;
  series: Series[];
  title?: string | null;
  stacked?: boolean | null;
}) {
  return (
    <ChartFrame title={title}>
      <ChartContainer config={buildConfig(series)} className="max-h-[320px] w-full">
        <RechartsBarChart data={data}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={xKey} {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
          {series.map((s, i) => (
            <Bar
              key={s.dataKey}
              dataKey={s.dataKey}
              fill={seriesColor(i)}
              radius={4}
              stackId={stacked ? "stack" : undefined}
            />
          ))}
        </RechartsBarChart>
      </ChartContainer>
    </ChartFrame>
  );
}

export function LineChartView({
  data,
  xKey,
  series,
  title,
}: {
  data: ChartRow[];
  xKey: string;
  series: Series[];
  title?: string | null;
}) {
  return (
    <ChartFrame title={title}>
      <ChartContainer config={buildConfig(series)} className="max-h-[320px] w-full">
        <RechartsLineChart data={data}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={xKey} {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
          {series.map((s, i) => (
            <Line
              key={s.dataKey}
              dataKey={s.dataKey}
              type="monotone"
              stroke={seriesColor(i)}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </RechartsLineChart>
      </ChartContainer>
    </ChartFrame>
  );
}

export function AreaChartView({
  data,
  xKey,
  series,
  title,
  stacked,
}: {
  data: ChartRow[];
  xKey: string;
  series: Series[];
  title?: string | null;
  stacked?: boolean | null;
}) {
  return (
    <ChartFrame title={title}>
      <ChartContainer config={buildConfig(series)} className="max-h-[320px] w-full">
        <RechartsAreaChart data={data}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={xKey} {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
          {series.map((s, i) => (
            <Area
              key={s.dataKey}
              dataKey={s.dataKey}
              type="monotone"
              stroke={seriesColor(i)}
              fill={seriesColor(i)}
              fillOpacity={0.25}
              strokeWidth={2}
              stackId={stacked ? "stack" : undefined}
            />
          ))}
        </RechartsAreaChart>
      </ChartContainer>
    </ChartFrame>
  );
}

export function PieChartView({
  data,
  nameKey,
  valueKey,
  title,
}: {
  data: ChartRow[];
  nameKey: string;
  valueKey: string;
  title?: string | null;
}) {
  const config: ChartConfig = Object.fromEntries(
    data.map((row) => [String(row[nameKey]), { label: String(row[nameKey]) }])
  );

  return (
    <ChartFrame title={title}>
      <ChartContainer config={config} className="mx-auto max-h-[320px] w-full">
        <RechartsPieChart>
          <ChartTooltip content={<ChartTooltipContent nameKey={nameKey} />} />
          <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius="45%">
            {data.map((row, i) => (
              <Cell key={String(row[nameKey])} fill={seriesColor(i)} />
            ))}
          </Pie>
          <ChartLegend content={<ChartLegendContent nameKey={nameKey} />} />
        </RechartsPieChart>
      </ChartContainer>
    </ChartFrame>
  );
}

export function StatView({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string | null;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {caption && <div className="mt-1 text-xs text-muted-foreground">{caption}</div>}
    </div>
  );
}
