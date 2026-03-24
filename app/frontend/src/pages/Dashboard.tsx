import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, AlertTriangle, TrendingUp, Clock } from 'lucide-react'
import clsx from 'clsx'

import FilterSidebar from '../components/FilterSidebar'
import KPICard from '../components/KPICard'
import CapacityVsDemandChart from '../components/charts/CapacityVsDemandChart'
import VendorBreakdownChart from '../components/charts/VendorBreakdownChart'
import DemandTrendChart from '../components/charts/DemandTrendChart'
import UtilizationBarChart from '../components/charts/UtilizationBarChart'
import OverallocationChart from '../components/charts/OverallocationChart'
import DonutChart from '../components/charts/DonutChart'
import DataTable from '../components/DataTable'

import {
  fetchDashboardStats,
  fetchCapacityVsDemand,
  fetchUtilization,
  fetchVendorBreakdown,
  fetchFilterOptions,
} from '../api/endpoints'
import type { FilterState, TopResource, TopProject } from '../types'

const defaultFilters: FilterState = {
  weekStart: '', weekEnd: '', manager: '', vendor: '',
  location: '', role: '', skill: '', area: '', year: '',
}

const TABS = ['Overview', 'Resource Viz', 'Capacity Analysis', 'Projects']

export default function Dashboard() {
  const [filters, setFilters] = useState<FilterState>(defaultFilters)
  const [activeTab, setActiveTab] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const { data: filterOptions } = useQuery({
    queryKey: ['filterOptions'],
    queryFn: fetchFilterOptions,
  })

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard', filters],
    queryFn: () => fetchDashboardStats(filters),
  })

  const { data: overallTrend } = useQuery({
    queryKey: ['cvd-overall', filters],
    queryFn: () => fetchCapacityVsDemand({ week_year: filters.year ? Number(filters.year) : undefined }),
  })

  const { data: cvsTrend } = useQuery({
    queryKey: ['cvd-cvs', filters],
    queryFn: () => fetchCapacityVsDemand({ vendor: 'CVS', week_year: filters.year ? Number(filters.year) : undefined }),
  })

  const { data: cognizantTrend } = useQuery({
    queryKey: ['cvd-cognizant', filters],
    queryFn: () => fetchCapacityVsDemand({ vendor: 'Cognizant', week_year: filters.year ? Number(filters.year) : undefined }),
  })

  const { data: tcsTrend } = useQuery({
    queryKey: ['cvd-tcs', filters],
    queryFn: () => fetchCapacityVsDemand({ vendor: 'TCS', week_year: filters.year ? Number(filters.year) : undefined }),
  })

  const { data: cloudTrend } = useQuery({
    queryKey: ['cvd-cloud', filters],
    queryFn: () => fetchCapacityVsDemand({ skill: 'Cloud', week_year: filters.year ? Number(filters.year) : undefined }),
  })

  const { data: javaTrend } = useQuery({
    queryKey: ['cvd-java', filters],
    queryFn: () => fetchCapacityVsDemand({ skill: 'Java', week_year: filters.year ? Number(filters.year) : undefined }),
  })

  const { data: utilizationByVendor } = useQuery({
    queryKey: ['util-vendor', filters],
    queryFn: () => fetchUtilization({ group_by: 'vendor' }),
  })

  const { data: utilizationByRole } = useQuery({
    queryKey: ['util-role', filters],
    queryFn: () => fetchUtilization({ group_by: 'role' }),
  })

  const { data: utilizationBySkill } = useQuery({
    queryKey: ['util-skill', filters],
    queryFn: () => fetchUtilization({ group_by: 'skill' }),
  })

  const { data: vendorBreakdown } = useQuery({
    queryKey: ['vendor-breakdown', filters],
    queryFn: () => fetchVendorBreakdown({ week_year: filters.year ? Number(filters.year) : undefined }),
  })

  const emptyOptions = { roles: [], skills: [], vendors: [], managers: [], locations: [], areas: [], years: [] }
  const opts = filterOptions ?? emptyOptions

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00BCD4]" />
      </div>
    )
  }

  const topResColumns = [
    { key: 'resource_code', header: 'Code', sortable: true },
    { key: 'resource_name', header: 'Name', sortable: true },
    { key: 'role', header: 'Role', sortable: true },
    { key: 'vendor', header: 'Vendor', sortable: true },
    {
      key: 'demand_hours', header: 'Demand Hrs', sortable: true,
      render: (v: unknown) => <span className="text-orange-600 font-medium">{Number(v).toLocaleString()}</span>,
    },
    {
      key: 'utilization_pct', header: 'Util%', sortable: true,
      render: (v: unknown) => {
        const val = Number(v)
        return (
          <span className={clsx('font-medium', val > 100 ? 'text-red-600' : val > 80 ? 'text-orange-500' : 'text-green-600')}>
            {val}%
          </span>
        )
      },
    },
    {
      key: 'is_over_allocated', header: 'Over-Alloc',
      render: (v: unknown) => v ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Yes</span> : <span className="text-xs text-gray-400">No</span>,
    },
  ] as const

  const topProjColumns = [
    { key: 'category', header: 'Project', sortable: true },
    {
      key: 'demand_hours', header: 'Demand Hrs', sortable: true,
      render: (v: unknown) => <span className="text-orange-600 font-medium">{Number(v).toLocaleString()}</span>,
    },
    {
      key: 'actual_hours', header: 'Actual Hrs', sortable: true,
      render: (v: unknown) => <span className="text-green-600 font-medium">{Number(v).toLocaleString()}</span>,
    },
    { key: 'resource_count', header: 'Resources', sortable: true },
  ] as const

  return (
    <div className="flex gap-4 p-4 min-h-full">
      {/* Sidebar */}
      {sidebarOpen && (
        <FilterSidebar
          filters={filters}
          onChange={setFilters}
          options={opts}
          onToggle={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#1B2559]">Resource Capacity & Demand Dashboard</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Real-time visibility into resource allocation, capacity, and project demand
            </p>
          </div>
          {!sidebarOpen && (
            <FilterSidebar
              filters={filters}
              onChange={setFilters}
              options={opts}
              collapsed
              onToggle={() => setSidebarOpen(true)}
            />
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            title="Total Resources"
            value={stats?.total_resources ?? 0}
            icon={Users}
            color="blue"
            subtitle="Active resources"
          />
          <KPICard
            title="Over-Allocated"
            value={`${stats?.over_allocated_count ?? 0} (${stats?.over_allocated_pct ?? 0}%)`}
            icon={AlertTriangle}
            color="red"
            subtitle="Resources over capacity"
          />
          <KPICard
            title="Avg Utilization"
            value={`${stats?.avg_utilization ?? 0}%`}
            icon={TrendingUp}
            color="green"
            subtitle="Across all resources"
          />
          <KPICard
            title="Total Demand Hours"
            value={(stats?.total_demand_hours ?? 0).toLocaleString()}
            icon={Clock}
            color="orange"
            subtitle={`Actual: ${(stats?.total_actual_hours ?? 0).toLocaleString()} hrs`}
          />
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex gap-1">
            {TABS.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                className={clsx(
                  'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                  activeTab === i
                    ? 'border-[#00BCD4] text-[#1B2559]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 0 && (
          <div className="space-y-4">
            {/* Row 1: Utilization Report + Resource Count */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <UtilizationBarChart
                data={utilizationByVendor?.groups ?? []}
                title="Utilization Report by Vendor"
              />
              <VendorBreakdownChart
                data={vendorBreakdown ?? []}
                title="Resource Count by Vendor / Location"
                mode="count"
              />
            </div>

            {/* Overall Capacity vs Demand */}
            <CapacityVsDemandChart
              data={overallTrend?.series ?? []}
              title="Overall Capacity vs Demand (Weekly)"
              height={260}
            />

            {/* Per-Vendor Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <CapacityVsDemandChart data={cvsTrend?.series ?? []} title="CVS - Capacity vs Demand" />
              <CapacityVsDemandChart data={cognizantTrend?.series ?? []} title="Cognizant - Capacity vs Demand" />
              <CapacityVsDemandChart data={tcsTrend?.series ?? []} title="TCS - Capacity vs Demand" />
            </div>

            {/* Demand Trend + CVS Trend */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <DemandTrendChart data={overallTrend?.series ?? []} title="Overall Demand and Utilization Trend" />
              <DemandTrendChart data={cvsTrend?.series ?? []} title="CVS FTE Demand Trend" />
            </div>

            {/* By Skill */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CapacityVsDemandChart data={cloudTrend?.series ?? []} title="Capacity vs Demand - Cloud" />
              <CapacityVsDemandChart data={javaTrend?.series ?? []} title="Capacity vs Demand - Java" />
            </div>

            {/* Top 10 Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <h3 className="text-sm font-semibold text-[#1B2559] mb-3">Top 10 Resources by Demand</h3>
                <DataTable
                  data={(stats?.top_10_resources_by_demand ?? []) as unknown as Record<string, unknown>[]}
                  columns={topResColumns as unknown as never}
                  pageSize={10}
                  showSearch={false}
                  showExport={false}
                />
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <h3 className="text-sm font-semibold text-[#1B2559] mb-3">Top Projects by Demand</h3>
                <DataTable
                  data={(stats?.top_10_projects_by_demand ?? []) as unknown as Record<string, unknown>[]}
                  columns={topProjColumns as unknown as never}
                  pageSize={10}
                  showSearch={false}
                  showExport={false}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <DonutChart
                data={(stats?.vendor_distribution ?? []).map((d) => ({ name: d.vendor, value: d.count }))}
                title="By Vendor"
              />
              <DonutChart
                data={(stats?.location_distribution ?? []).map((d) => ({ name: d.location, value: d.count }))}
                title="By Location"
                colors={['#3B82F6', '#00BCD4']}
              />
              <DonutChart
                data={(stats?.role_distribution ?? []).map((d) => ({ name: d.role, value: d.count }))}
                title="By Role"
              />
              <DonutChart
                data={(stats?.skill_distribution ?? []).map((d) => ({ name: d.skill, value: d.count }))}
                title="By Skill"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <UtilizationBarChart data={utilizationByRole?.groups ?? []} title="Utilization by Role" />
              <UtilizationBarChart data={utilizationBySkill?.groups ?? []} title="Utilization by Skill" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <OverallocationChart
                data={utilizationByVendor?.groups ?? []}
                title="Over-allocation by Vendor"
              />
              <OverallocationChart
                data={utilizationByRole?.groups ?? []}
                title="Over-allocation by Role"
              />
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h3 className="text-sm font-semibold text-[#1B2559] mb-3">Top 10 Resources by Demand</h3>
              <DataTable
                data={(stats?.top_10_resources_by_demand ?? []) as unknown as Record<string, unknown>[]}
                columns={topResColumns as unknown as never}
                pageSize={10}
                downloadFilename="top-resources"
              />
            </div>
          </div>
        )}

        {activeTab === 2 && (
          <div className="space-y-4">
            <CapacityVsDemandChart
              data={overallTrend?.series ?? []}
              title="Overall Capacity vs Demand (Weekly View)"
              height={300}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <DemandTrendChart
                data={overallTrend?.series ?? []}
                title="Demand & Capacity Trend"
                height={260}
              />
              <VendorBreakdownChart
                data={vendorBreakdown ?? []}
                title="Demand by Vendor (Onshore / Offshore)"
                mode="demand"
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <CapacityVsDemandChart data={cvsTrend?.series ?? []} title="CVS" />
              <CapacityVsDemandChart data={cognizantTrend?.series ?? []} title="Cognizant" />
              <CapacityVsDemandChart data={tcsTrend?.series ?? []} title="TCS" />
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h3 className="text-sm font-semibold text-[#1B2559] mb-3">Capacity Analysis by Vendor</h3>
              <DataTable
                data={(utilizationByVendor?.groups ?? []) as unknown as Record<string, unknown>[]}
                columns={[
                  { key: 'group_name', header: 'Vendor', sortable: true },
                  { key: 'resource_count', header: 'Resources', sortable: true },
                  { key: 'capacity', header: 'Capacity Hrs', sortable: true, render: (v: unknown) => Number(v).toLocaleString() },
                  { key: 'demand_hours', header: 'Demand Hrs', sortable: true, render: (v: unknown) => <span className="text-orange-600 font-medium">{Number(v).toLocaleString()}</span> },
                  { key: 'actual_hours', header: 'Actual Hrs', sortable: true, render: (v: unknown) => <span className="text-green-600 font-medium">{Number(v).toLocaleString()}</span> },
                  { key: 'utilization_pct', header: 'Util%', sortable: true, render: (v: unknown) => `${Number(v)}%` },
                  { key: 'over_allocated_count', header: 'Over-Alloc', sortable: true, render: (v: unknown) => <span className="text-red-600 font-medium">{String(v)}</span> },
                ] as unknown as never}
                pageSize={20}
                downloadFilename="capacity-analysis"
                showSearch={false}
              />
            </div>
          </div>
        )}

        {activeTab === 3 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h3 className="text-sm font-semibold text-[#1B2559] mb-3">Projects Demand Summary</h3>
              <DataTable
                data={(stats?.top_10_projects_by_demand ?? []) as unknown as Record<string, unknown>[]}
                columns={[
                  { key: 'category', header: 'Project / Category', sortable: true },
                  { key: 'demand_hours', header: 'Demand Hrs', sortable: true, render: (v: unknown) => <span className="text-orange-600 font-medium">{Number(v).toLocaleString()}</span> },
                  { key: 'actual_hours', header: 'Actual Hrs', sortable: true, render: (v: unknown) => <span className="text-green-600 font-medium">{Number(v).toLocaleString()}</span> },
                  { key: 'resource_count', header: 'Resources', sortable: true },
                ] as unknown as never}
                pageSize={20}
                downloadFilename="projects-demand"
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <DonutChart
                data={(stats?.top_10_projects_by_demand ?? []).map((p: TopProject) => ({ name: p.category, value: p.demand_hours }))}
                title="Demand Distribution by Project"
                colors={['#3B82F6', '#F97316', '#10B981', '#8B5CF6', '#EF4444']}
              />
              <DonutChart
                data={(stats?.top_10_projects_by_demand ?? []).map((p: TopProject) => ({ name: p.category, value: p.resource_count }))}
                title="Resource Count by Project"
                colors={['#00BCD4', '#F59E0B', '#EC4899', '#6366F1', '#14B8A6']}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
