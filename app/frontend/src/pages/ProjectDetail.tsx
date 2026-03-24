import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Users, Clock, TrendingUp, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'
import { fetchProjectDetail } from '../api/endpoints'
import KPICard from '../components/KPICard'
import DemandTrendChart from '../components/charts/DemandTrendChart'
import DataTable from '../components/DataTable'

const CATEGORY_COLORS: Record<string, string> = {
  Regulatory: 'bg-purple-100 text-purple-700',
  Pricing: 'bg-blue-100 text-blue-700',
  Clinical: 'bg-green-100 text-green-700',
  Support: 'bg-orange-100 text-orange-700',
}

export default function ProjectDetail() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()

  const { data, isLoading, error } = useQuery({
    queryKey: ['project', code],
    queryFn: () => fetchProjectDetail(code!),
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
        <div className="bg-red-50 text-red-700 p-4 rounded-xl">Project not found.</div>
      </div>
    )
  }

  const { project, summary, resources, weekly_trend } = data

  // Map weekly trend for chart
  const chartData = weekly_trend.map((w: Record<string, unknown>) => ({
    week: w.week_text || w.week,
    week_date: w.week,
    capacity: w.capacity,
    demand_hours: w.demand_hours,
    actual_hours: w.actual_hours,
    utilization_pct:
      (w.capacity as number) > 0
        ? Math.round(((w.demand_hours as number) / (w.capacity as number)) * 100)
        : 0,
    over_allocated_count: 0,
  }))

  const resourceColumns = [
    { key: 'resource_code', header: 'Code', sortable: true, className: 'font-mono text-[#1B2559] font-medium' },
    { key: 'resource_name', header: 'Name', sortable: true },
    { key: 'role', header: 'Role', sortable: true },
    { key: 'primary_skill', header: 'Skill', sortable: true },
    { key: 'vendor', header: 'Vendor', sortable: true },
    { key: 'location', header: 'Location', sortable: true },
    { key: 'manager', header: 'Manager', sortable: true },
    {
      key: 'demand_hours', header: 'Demand Hrs', sortable: true,
      render: (v: unknown) => <span className="text-orange-600 font-medium">{Number(v).toLocaleString()}</span>,
    },
    {
      key: 'actual_hours', header: 'Actual Hrs', sortable: true,
      render: (v: unknown) => <span className="text-green-600 font-medium">{Number(v).toLocaleString()}</span>,
    },
    {
      key: 'utilization_pct', header: 'Util%', sortable: true,
      render: (v: unknown) => {
        const val = Number(v)
        return (
          <span className={clsx('font-semibold', val > 100 ? 'text-red-600' : val > 80 ? 'text-orange-500' : 'text-green-600')}>
            {val}%
          </span>
        )
      },
    },
    {
      key: 'is_over_allocated', header: 'Over-Alloc',
      render: (v: unknown) => v
        ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Yes</span>
        : <span className="text-xs text-gray-400">No</span>,
    },
  ] as const

  return (
    <div className="p-4 space-y-4">
      <button
        onClick={() => navigate('/projects')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#1B2559] transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Projects
      </button>

      {/* Project Header */}
      <div className="bg-[#1B2559] text-white rounded-xl p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold">{project.project_name}</h1>
            <p className="text-white/60 font-mono text-sm mt-1">{project.project_code}</p>
            <div className="mt-3">
              <span className={clsx(
                'text-xs px-3 py-1 rounded-full font-semibold',
                CATEGORY_COLORS[project.category || ''] || 'bg-white/10 text-white'
              )}>
                {project.category}
              </span>
            </div>
          </div>
          {summary.over_allocated_count > 0 && (
            <div className="flex items-center gap-2 bg-red-500/20 text-red-200 px-3 py-2 rounded-xl text-sm">
              <AlertTriangle size={16} />
              {summary.over_allocated_count} over-allocated resource{summary.over_allocated_count > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title="Total Resources"
          value={summary.total_resources}
          icon={Users}
          color="blue"
        />
        <KPICard
          title="Total Demand Hours"
          value={summary.total_demand_hours.toLocaleString()}
          icon={Clock}
          color="orange"
        />
        <KPICard
          title="Total Actual Hours"
          value={summary.total_actual_hours.toLocaleString()}
          icon={Clock}
          color="green"
        />
        <KPICard
          title="Avg Utilization"
          value={`${summary.avg_utilization}%`}
          icon={TrendingUp}
          color={summary.avg_utilization > 100 ? 'red' : 'teal'}
        />
      </div>

      {/* Demand Trend Chart */}
      {chartData.length > 0 && (
        <DemandTrendChart
          data={chartData}
          title={`Demand Trend - ${project.project_name}`}
          height={280}
        />
      )}

      {/* Resource Assignments Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-[#1B2559] mb-3">
          Resource Assignments ({resources.length})
        </h3>
        <DataTable
          data={resources as unknown as Record<string, unknown>[]}
          columns={resourceColumns as unknown as never}
          pageSize={20}
          downloadFilename={`project-${code}-resources`}
          onRowClick={(row) => navigate(`/resources/${row.resource_code}`)}
          rowClassName={(row) => row.is_over_allocated ? 'bg-red-50/40' : ''}
        />
      </div>
    </div>
  )
}
