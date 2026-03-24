import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { WeeklySeries } from '../../types'

interface CapacityVsDemandChartProps {
  data: WeeklySeries[]
  title?: string
  height?: number
}

function formatWeekLabel(week: string): string {
  if (!week) return ''
  // "hr_15_Mar_2026" -> "15 Mar"
  const match = week.match(/hr_(\d+)_(\w+)_(\d+)/)
  if (match) return `${match[1]} ${match[2]}`
  // ISO date
  if (week.includes('-')) {
    const d = new Date(week)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  return week
}

export default function CapacityVsDemandChart({ data, title, height = 240 }: CapacityVsDemandChartProps) {
  const chartData = data.map((d) => ({
    week: formatWeekLabel(d.week),
    Capacity: d.capacity,
    Demand: d.demand_hours,
    Actuals: d.actual_hours,
    'Util%': d.utilization_pct,
  }))

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      {title && <h3 className="text-sm font-semibold text-[#1B2559] mb-3">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
            angle={-30}
            textAnchor="end"
            height={40}
          />
          <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="right" orientation="right" unit="%" tick={{ fontSize: 11 }} domain={[0, 150]} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            formatter={(value: number, name: string) => [
              name === 'Util%' ? `${value}%` : value.toLocaleString(),
              name,
            ]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="left" dataKey="Capacity" fill="#3B82F6" radius={[3, 3, 0, 0]} />
          <Bar yAxisId="left" dataKey="Demand" fill="#F97316" radius={[3, 3, 0, 0]} />
          <Bar yAxisId="left" dataKey="Actuals" fill="#10B981" radius={[3, 3, 0, 0]} />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="Util%"
            stroke="#EF4444"
            strokeWidth={2.5}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
