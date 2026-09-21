"use client"

import { TrendingUp } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

type Point = { month: string; price: number }

const chartConfig = {
  price: {
    label: "USD",
    color: "var(--primary)",
  },
} satisfies ChartConfig

function monthLabel(value: string) {
  const [year, month] = value.split("-")
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const index = Number(month) - 1
  return `${names[index] ?? month} ${year.slice(2)}`
}

export function PriceHistoryChart({
  title,
  description,
  source,
  data,
}: {
  title: string
  description: string
  source?: string
  data: Point[]
}) {
  const first = data[0]?.price
  const last = data.at(-1)?.price
  const change =
    first && last ? (((last - first) / first) * 100).toFixed(1) : null
  const up = Number(change) >= 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <AreaChart
            accessibilityLayer
            data={data}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={monthLabel}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Area
              dataKey="price"
              type="natural"
              fill="var(--color-price)"
              fillOpacity={0.4}
              stroke="var(--color-price)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      {change ? (
        <CardFooter>
          <div className="flex w-full items-start gap-2 text-sm">
            <div className="grid gap-2">
              <div className="flex items-center gap-2 leading-none font-medium">
                {up ? "Up" : "Down"} {Math.abs(Number(change))}% this year{" "}
                <TrendingUp className={`h-4 w-4 ${up ? "" : "rotate-180"}`} />
              </div>
              <div className="flex items-center gap-2 leading-none text-muted-foreground">
                Monthly close from {source ?? "CoinGecko"}
              </div>
            </div>
          </div>
        </CardFooter>
      ) : null}
    </Card>
  )
}
