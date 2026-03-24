import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { WeeklySeries } from '../../types'

interface DemandTrendChartProps {
  data: WeeklySeries[]
  title?: string
  height?: number
}

function formatWeekLabel(week: string): string {
  if (!week) return ''
  const match = week.match(/hr_(\d+)_(\w+)_(\d+)/)
  if (match) return `${match[1]} ${match[2]}`
  if (week.includes('-')) {
    const d = new Date(week)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  return week
}

export default function DemandTrendChart({ data, title, height = 240 }: DemandTrendChartProps) {
  const chartData = data.map((d) => ({
    week: formatWeekLabel(d.week),
    Capacity: d.capacity,
    Demand: d.demand_hours,
    Actuals: d.actual_hours,
  }))

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      {title && <h3 className="text-sm font-semibold text-[#1B2559] mb-3">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="gradCapacity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradDemand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F97316" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradActuals" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
            angle={-30}
            textAnchor="end"
            height={40}
          />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            formatter={(value: number) => value.toLocaleString()}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="Capacity"
            stroke="#3B82F6"
            strokeWidth={2}
            fill="url(#gradCapacity)"
          />
          <Area
            type="monotone"
            dataKey="Demand"
            stroke="#F97316"
            strokeWidth={2}
            fill="url(#gradDemand)"
          />
          <Area
            type="monotone"
            dataKey="Actuals"
            stroke="#10B981"
            strokeWidth={2}
            fill="url(#gradActuals)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
