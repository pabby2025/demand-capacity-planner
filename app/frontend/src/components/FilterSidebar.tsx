import { X, SlidersHorizontal } from 'lucide-react'
import type { FilterState, FilterOptions } from '../types'

interface FilterSidebarProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
  options: FilterOptions
  collapsed?: boolean
  onToggle?: () => void
}

const defaultFilters: FilterState = {
  weekStart: '',
  weekEnd: '',
  manager: '',
  vendor: '',
  location: '',
  role: '',
  skill: '',
  area: '',
  year: '',
}

export default function FilterSidebar({
  filters,
  onChange,
  options,
  collapsed = false,
  onToggle,
}: FilterSidebarProps) {
  const update = (key: keyof FilterState, value: string) => {
    onChange({ ...filters, [key]: value })
  }

  const clearAll = () => onChange({ ...defaultFilters })

  const hasActive = Object.values(filters).some(Boolean)

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700"
      >
        <SlidersHorizontal size={16} />
        Filters
        {hasActive && <span className="w-2 h-2 rounded-full bg-[#00BCD4]" />}
      </button>
    )
  }

  return (
    <aside className="w-56 flex-shrink-0 bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4 self-start sticky top-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-[#1B2559] text-sm">
          <SlidersHorizontal size={15} />
          Filters
        </div>
        {hasActive && (
          <button
            onClick={clearAll}
            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>

      {/* Year */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
        <select
          value={filters.year}
          onChange={(e) => update('year', e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
        >
          <option value="">All Years</option>
          {options.years.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
      </div>

      {/* Week range */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Week Start</label>
        <input
          type="date"
          value={filters.weekStart}
          onChange={(e) => update('weekStart', e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Week End</label>
        <input
          type="date"
          value={filters.weekEnd}
          onChange={(e) => update('weekEnd', e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
        />
      </div>

      {/* Manager */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Resource Manager</label>
        <select
          value={filters.manager}
          onChange={(e) => update('manager', e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
        >
          <option value="">All Managers</option>
          {options.managers.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Vendor */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Resource Vendor</label>
        <select
          value={filters.vendor}
          onChange={(e) => update('vendor', e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
        >
          <option value="">All Vendors</option>
          {options.vendors.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>

      {/* Location */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Work Location</label>
        <select
          value={filters.location}
          onChange={(e) => update('location', e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
        >
          <option value="">All Locations</option>
          {options.locations.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>

      {/* Role */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
        <select
          value={filters.role}
          onChange={(e) => update('role', e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
        >
          <option value="">All Roles</option>
          {options.roles.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Skill */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Primary Skill</label>
        <select
          value={filters.skill}
          onChange={(e) => update('skill', e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
        >
          <option value="">All Skills</option>
          {options.skills.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Area */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Area</label>
        <select
          value={filters.area}
          onChange={(e) => update('area', e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
        >
          <option value="">All Areas</option>
          {options.areas.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {hasActive && (
        <button
          onClick={clearAll}
          className="w-full text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 rounded-lg transition-colors font-medium"
        >
          Clear All Filters
        </button>
      )}
    </aside>
  )
}
