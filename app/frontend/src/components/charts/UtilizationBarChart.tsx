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
import type { UtilizationGroup } from '../../types'

interface UtilizationBarChartProps {
  data: UtilizationGroup[]
  title?: string
}

const COLORS = {
  capacity: '#3B82F6',
  demand: '#F97316',
  actual: '#10B981',
  utilization: '#EF4444',
}

export default function UtilizationBarChart({ data, title }: UtilizationBarChartProps) {
  const chartData = data.map((d) => ({
    name: d.group_name,
    Capacity: d.capacity,
    'Demand Hours': d.demand_hours,
    'Actual Hours': d.actual_hours,
    'Util%': d.utilization_pct,
  }))

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      {title && <h3 className="text-sm font-semibold text-[#1B2559] mb-3">{title}</h3>}
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
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
          <Bar yAxisId="left" dataKey="Capacity" fill={COLORS.capacity} radius={[3, 3, 0, 0]} />
          <Bar yAxisId="left" dataKey="Demand Hours" fill={COLORS.demand} radius={[3, 3, 0, 0]} />
          <Bar yAxisId="left" dataKey="Actual Hours" fill={COLORS.actual} radius={[3, 3, 0, 0]} />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="Util%"
            stroke={COLORS.utilization}
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
