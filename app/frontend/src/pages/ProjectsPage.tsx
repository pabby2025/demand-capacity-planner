import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import clsx from 'clsx'
import { fetchProjects } from '../api/endpoints'
import DataTable, { Column } from '../components/DataTable'

const CATEGORY_COLORS: Record<string, string> = {
  Regulatory: 'bg-purple-100 text-purple-700',
  Pricing: 'bg-blue-100 text-blue-700',
  Clinical: 'bg-green-100 text-green-700',
  Support: 'bg-orange-100 text-orange-700',
}

export default function ProjectsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects', search, category],
    queryFn: () => fetchProjects({ search, category }),
  })

  const categories = [...new Set((projects ?? []).map((p) => p.category).filter(Boolean))]

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: 'project_code', header: 'Project Code', sortable: true,
      className: 'font-mono text-[#1B2559] font-medium',
    },
    { key: 'project_name', header: 'Project Name', sortable: true },
    {
      key: 'category', header: 'Category', sortable: true,
      render: (v: unknown) => {
        const cat = String(v || '')
        return (
          <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', CATEGORY_COLORS[cat] || 'bg-gray-100 text-gray-600')}>
            {cat}
          </span>
        )
      },
    },
    { key: 'total_resources', header: 'Resources', sortable: true },
    {
      key: 'total_demand_hours', header: 'Demand Hrs', sortable: true,
      render: (v: unknown) => <span className="text-orange-600 font-medium">{Number(v).toLocaleString()}</span>,
    },
    {
      key: 'total_actual_hours', header: 'Actual Hrs', sortable: true,
      render: (v: unknown) => <span className="text-green-600 font-medium">{Number(v).toLocaleString()}</span>,
    },
    {
      key: 'avg_utilization', header: 'Avg Util%', sortable: true,
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
      key: 'over_allocated_count', header: 'Over-Alloc', sortable: true,
      render: (v: unknown) => {
        const n = Number(v)
        return n > 0
          ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{n}</span>
          : <span className="text-xs text-gray-400">0</span>
      },
    },
  ]

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#1B2559]">Projects</h1>
        <p className="text-xs text-gray-500 mt-0.5">Project demand, resource assignments, and utilization</p>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00BCD4] w-56"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c as string}>{c as string}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Project cards summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {(projects ?? []).map((p) => (
          <div
            key={p.project_code}
            onClick={() => navigate(`/projects/${p.project_code}`)}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md hover:border-[#00BCD4] transition-all"
          >
            <div className="flex items-start justify-between mb-2">
              <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', CATEGORY_COLORS[p.category || ''] || 'bg-gray-100 text-gray-600')}>
                {p.category}
              </span>
            </div>
            <p className="text-sm font-semibold text-[#1B2559] line-clamp-2 min-h-[2.5rem]">{p.project_name}</p>
            <p className="text-xs text-gray-400 font-mono mt-1">{p.project_code}</p>
            <div className="mt-3 grid grid-cols-2 gap-1 text-xs">
              <div>
                <p className="text-gray-400">Resources</p>
                <p className="font-semibold text-gray-700">{p.total_resources}</p>
              </div>
              <div>
                <p className="text-gray-400">Demand</p>
                <p className="font-semibold text-orange-600">{(p.total_demand_hours || 0).toLocaleString()}</p>
              </div>
            </div>
            {p.over_allocated_count > 0 && (
              <div className="mt-2 text-xs text-red-600 font-medium">
                {p.over_allocated_count} over-allocated
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00BCD4]" />
          </div>
        ) : (
          <DataTable
            data={(projects ?? []) as unknown as Record<string, unknown>[]}
            columns={columns}
            pageSize={10}
            downloadFilename="projects"
            onRowClick={(row) => navigate(`/projects/${row.project_code}`)}
            showSearch={false}
          />
        )}
      </div>
    </div>
  )
}
