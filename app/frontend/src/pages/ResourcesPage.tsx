import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import clsx from 'clsx'
import { fetchResources, fetchFilterOptions } from '../api/endpoints'
import DataTable, { Column } from '../components/DataTable'
import type { ResourceWithMetrics } from '../types'

export default function ResourcesPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [skill, setSkill] = useState('')
  const [vendor, setVendor] = useState('')
  const [manager, setManager] = useState('')
  const [location, setLocation] = useState('')
  const [overAlloc, setOverAlloc] = useState<boolean | undefined>(undefined)

  const { data: options } = useQuery({ queryKey: ['filterOptions'], queryFn: fetchFilterOptions })
  const { data: resources, isLoading } = useQuery({
    queryKey: ['resources', search, role, skill, vendor, manager, location, overAlloc],
    queryFn: () => fetchResources({ search, role, skill, vendor, manager, location, over_allocation: overAlloc }),
  })

  const clearFilters = () => {
    setSearch(''); setRole(''); setSkill(''); setVendor('')
    setManager(''); setLocation(''); setOverAlloc(undefined)
  }

  const hasFilters = !!(search || role || skill || vendor || manager || location || overAlloc !== undefined)

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'resource_code', header: 'Code', sortable: true, className: 'font-mono text-[#1B2559] font-medium' },
    { key: 'resource_name', header: 'Name', sortable: true },
    { key: 'role', header: 'Role', sortable: true },
    { key: 'primary_skill', header: 'Skill', sortable: true },
    { key: 'resource_vendor', header: 'Vendor', sortable: true },
    { key: 'location', header: 'Location', sortable: true },
    { key: 'resource_manager', header: 'Manager', sortable: true },
    {
      key: 'total_demand_hours', header: 'Demand Hrs', sortable: true,
      render: (v: unknown) => <span className="text-orange-600 font-medium">{Number(v).toLocaleString()}</span>,
    },
    {
      key: 'total_actual_hours', header: 'Actual Hrs', sortable: true,
      render: (v: unknown) => <span className="text-green-600 font-medium">{Number(v).toLocaleString()}</span>,
    },
    {
      key: 'total_capacity', header: 'Capacity', sortable: true,
      render: (v: unknown) => <span className="text-blue-600 font-medium">{Number(v).toLocaleString()}</span>,
    },
    {
      key: 'utilization_pct', header: 'Util%', sortable: true,
      render: (v: unknown) => {
        const val = Number(v)
        return (
          <span className={clsx(
            'font-semibold',
            val > 100 ? 'text-red-600' : val > 80 ? 'text-orange-500' : 'text-green-600'
          )}>
            {val}%
          </span>
        )
      },
    },
    {
      key: 'is_over_allocated', header: 'Over-Alloc', sortable: true,
      render: (v: unknown) => v
        ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Yes</span>
        : <span className="text-xs text-gray-400">No</span>,
    },
    {
      key: 'resource_status', header: 'Status',
      render: (v: unknown) => (
        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{String(v)}</span>
      ),
    },
  ]

  return (
    <div className="p-4 space-y-4">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-[#1B2559]">Resources</h1>
        <p className="text-xs text-gray-500 mt-0.5">View and filter all resources with their capacity metrics</p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search resources..."
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00BCD4] w-48"
            />
          </div>
          <select value={role} onChange={(e) => setRole(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00BCD4]">
            <option value="">All Roles</option>
            {options?.roles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={skill} onChange={(e) => setSkill(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00BCD4]">
            <option value="">All Skills</option>
            {options?.skills.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={vendor} onChange={(e) => setVendor(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00BCD4]">
            <option value="">All Vendors</option>
            {options?.vendors.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={manager} onChange={(e) => setManager(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00BCD4]">
            <option value="">All Managers</option>
            {options?.managers.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={location} onChange={(e) => setLocation(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00BCD4]">
            <option value="">All Locations</option>
            {options?.locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <select
            value={overAlloc === undefined ? '' : String(overAlloc)}
            onChange={(e) => setOverAlloc(e.target.value === '' ? undefined : e.target.value === 'true')}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00BCD4]">
            <option value="">All</option>
            <option value="true">Over-Allocated</option>
            <option value="false">Not Over-Allocated</option>
          </select>
          {hasFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 px-2 py-1.5">
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00BCD4]" />
          </div>
        ) : (
          <DataTable
            data={(resources ?? []) as unknown as Record<string, unknown>[]}
            columns={columns}
            pageSize={20}
            downloadFilename="resources"
            onRowClick={(row) => navigate(`/resources/${row.resource_code}`)}
            rowClassName={(row) => row.is_over_allocated ? 'bg-red-50/40' : ''}
            searchPlaceholder="Search in results..."
            showSearch={false}
          />
        )}
      </div>
    </div>
  )
}
