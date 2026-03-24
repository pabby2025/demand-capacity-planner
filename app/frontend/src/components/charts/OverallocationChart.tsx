import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { UtilizationGroup } from '../../types'

interface OverallocationChartProps {
  data: UtilizationGroup[]
  title?: string
}

export default function OverallocationChart({ data, title }: OverallocationChartProps) {
  const chartData = data
    .filter((d) => d.over_allocated_count > 0)
    .map((d) => ({
      name: d.group_name,
      'Over-allocated': d.over_allocated_count,
      'Total Resources': d.resource_count,
    }))
    .sort((a, b) => b['Over-allocated'] - a['Over-allocated'])

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      {title && <h3 className="text-sm font-semibold text-[#1B2559] mb-3">{title}</h3>}
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Total Resources" fill="#93C5FD" radius={[0, 3, 3, 0]} />
          <Bar dataKey="Over-allocated" fill="#EF4444" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
