import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Clock, TrendingUp, AlertTriangle, BarChart2 } from 'lucide-react'
import clsx from 'clsx'
import { fetchResourceDetail } from '../api/endpoints'
import KPICard from '../components/KPICard'
import CapacityVsDemandChart from '../components/charts/CapacityVsDemandChart'
import DataTable from '../components/DataTable'

export default function ResourceDetail() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()

  const { data, isLoading, error } = useQuery({
    queryKey: ['resource', code],
    queryFn: () => fetchResourceDetail(code!),
    enabled: !!code,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00BCD4]" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-4">
        <div className="bg-red-50 text-red-700 p-4 rounded-xl">
          Resource not found or error loading data.
        </div>
      </div>
    )
  }

  const { resource, summary, weekly_metrics } = data

  // Prepare chart data
  const weeklyChartData = weekly_metrics.map((m: Record<string, unknown>) => ({
    week: m.week_text || m.week,
    week_date: m.week,
    capacity: m.capacity,
    demand_hours: m.demand_hours,
    actual_hours: m.actual_hours,
    utilization_pct: (m.capacity as number) > 0 ? Math.round(((m.demand_hours as number) / (m.capacity as number)) * 100) : 0,
    over_allocated_count: m.over_allocation ? 1 : 0,
  }))

  // Weekly table columns
  const weeklyColumns = [
    { key: 'week_text', header: 'Week', sortable: true },
    { key: 'demand_hours', header: 'Demand Hrs', sortable: true, render: (v: unknown) => <span className="text-orange-600 font-medium">{Number(v)}</span> },
    { key: 'actual_hours', header: 'Actual Hrs', sortable: true, render: (v: unknown) => <span className="text-green-600 font-medium">{Number(v)}</span> },
    { key: 'capacity', header: 'Capacity', sortable: true, render: (v: unknown) => <span className="text-blue-600 font-medium">{Number(v)}</span> },
    { key: 'over_allocated_hours', header: 'Over-Alloc Hrs', sortable: true },
    {
      key: 'over_allocation', header: 'Over-Alloc',
      render: (v: unknown) => v
        ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Yes</span>
        : <span className="text-xs text-gray-300">-</span>,
    },
    { key: 'project_category', header: 'Project', sortable: true },
    { key: 'technology', header: 'Technology', sortable: true },
  ] as const

  return (
    <div className="p-4 space-y-4">
      {/* Back */}
      <button
        onClick={() => navigate('/resources')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#1B2559] transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Resources
      </button>

      {/* Profile Header */}
      <div className="bg-[#1B2559] text-white rounded-xl p-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-xl font-bold">
              {(resource.resource_name || resource.resource_code).charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-bold">{resource.resource_name || resource.resource_code}</h1>
              <p className="text-white/60 text-sm font-mono">{resource.resource_code}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {resource.role && (
              <span className="bg-white/10 text-white/90 text-xs px-2.5 py-1 rounded-full">{resource.role}</span>
            )}
            {resource.primary_skill && (
              <span className="bg-[#00BCD4]/20 text-[#00BCD4] text-xs px-2.5 py-1 rounded-full">{resource.primary_skill}</span>
            )}
            {resource.location && (
              <span className="bg-white/10 text-white/90 text-xs px-2.5 py-1 rounded-full">{resource.location}</span>
            )}
            {resource.resource_vendor && (
              <span className="bg-orange-500/20 text-orange-300 text-xs px-2.5 py-1 rounded-full">{resource.resource_vendor}</span>
            )}
            {resource.resource_status && (
              <span className="bg-green-500/20 text-green-300 text-xs px-2.5 py-1 rounded-full">{resource.resource_status}</span>
            )}
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="text-white/60">Manager</p>
          <p className="font-medium">{resource.resource_manager || '-'}</p>
          <p className="text-white/60 mt-2">Area</p>
          <p className="font-medium">{resource.area || '-'}</p>
          <p className="text-white/60 mt-2">Rate</p>
          <p className="font-medium">${resource.rate || 0}/hr</p>
        </div>
      </div>

      {/* Over-allocation alert */}
      {summary.is_over_allocated && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-3">
          <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">This resource is over-allocated</p>
            <p className="text-xs text-red-600">
              Over-allocated by {summary.total_over_allocated_hours.toLocaleString()} hours
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title="Total Capacity"
          value={summary.total_capacity.toLocaleString()}
          icon={BarChart2}
          color="blue"
          subtitle="Available hours"
        />
        <KPICard
          title="Demand Hours"
          value={summary.total_demand_hours.toLocaleString()}
          icon={Clock}
          color="orange"
          subtitle="Allocated demand"
        />
        <KPICard
          title="Actual Hours"
          value={summary.total_actual_hours.toLocaleString()}
          icon={Clock}
          color="green"
          subtitle="Hours logged"
        />
        <KPICard
          title="Utilization"
          value={`${summary.utilization_pct}%`}
          icon={TrendingUp}
          color={summary.utilization_pct > 100 ? 'red' : summary.utilization_pct > 80 ? 'orange' : 'green'}
          subtitle={summary.is_over_allocated ? 'Over-allocated' : 'Utilization rate'}
        />
      </div>

      {/* Projects */}
      {summary.project_categories.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-[#1B2559] mb-3">Assigned Projects</h3>
          <div className="flex flex-wrap gap-2">
            {summary.project_categories.map((cat: string) => (
              <span key={cat} className="bg-blue-50 text-blue-700 text-xs px-3 py-1 rounded-full font-medium">
                {cat}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Weekly Chart */}
      {weeklyChartData.length > 0 && (
        <CapacityVsDemandChart
          data={weeklyChartData}
          title={`Weekly Capacity vs Demand - ${resource.resource_name || resource.resource_code}`}
          height={280}
        />
      )}

      {/* Weekly Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-[#1B2559] mb-3">Weekly Details</h3>
        <DataTable
          data={weekly_metrics as unknown as Record<string, unknown>[]}
          columns={weeklyColumns as unknown as never}
          pageSize={15}
          downloadFilename={`resource-${code}-weekly`}
          rowClassName={(row) => row.over_allocation ? 'bg-red-50/40' : ''}
        />
      </div>
    </div>
  )
}
