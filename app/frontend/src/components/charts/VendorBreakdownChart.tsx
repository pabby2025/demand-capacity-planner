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
import type { VendorBreakdownEntry } from '../../types'

interface VendorBreakdownChartProps {
  data: VendorBreakdownEntry[]
  title?: string
  mode?: 'count' | 'demand'
}

export default function VendorBreakdownChart({ data, title, mode = 'count' }: VendorBreakdownChartProps) {
  const chartData = data.map((d) => ({
    vendor: d.vendor,
    Onshore: mode === 'count' ? d.onshore_count : Math.round(d.onshore_demand),
    Offshore: mode === 'count' ? d.offshore_count : Math.round(d.offshore_demand),
    Total: mode === 'count' ? d.total_count : Math.round(d.total_demand),
  }))

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      {title && <h3 className="text-sm font-semibold text-[#1B2559] mb-3">{title}</h3>}
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="vendor" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            formatter={(value: number) => value.toLocaleString()}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Onshore" stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Offshore" stackId="a" fill="#00BCD4" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
