import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import ExportButtons from './ExportButtons'

export interface Column<T> {
  key: keyof T | string
  header: string
  render?: (value: unknown, row: T) => React.ReactNode
  sortable?: boolean
  className?: string
  headerClassName?: string
}

interface DataTableProps<T extends Record<string, unknown>> {
  data: T[]
  columns: Column<T>[]
  pageSize?: number
  downloadFilename?: string
  onRowClick?: (row: T) => void
  rowClassName?: (row: T) => string
  searchPlaceholder?: string
  emptyMessage?: string
  showSearch?: boolean
  showExport?: boolean
}

export default function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  pageSize = 15,
  downloadFilename,
  onRowClick,
  rowClassName,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No data found',
  showSearch = true,
  showExport = true,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase()
    return data.filter((row) =>
      columns.some((col) => {
        const val = row[col.key as keyof T]
        return val !== null && val !== undefined && String(val).toLowerCase().includes(q)
      })
    )
  }, [data, search, columns])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const av = a[sortKey as keyof T]
      const bv = b[sortKey as keyof T]
      if (av === null || av === undefined) return 1
      if (bv === null || bv === undefined) return -1
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.ceil(sorted.length / pageSize)
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize)

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(1)
  }

  const SortIcon = ({ col }: { col: Column<T> }) => {
    if (!col.sortable) return null
    if (sortKey !== col.key) return <ChevronsUpDown size={12} className="text-gray-300" />
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-[#00BCD4]" />
      : <ChevronDown size={12} className="text-[#00BCD4]" />
  }

  return (
    <div className="flex flex-col gap-3">
      {(showSearch || showExport) && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {showSearch && (
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{sorted.length} results</span>
            {showExport && downloadFilename && (
              <ExportButtons
                data={sorted as Record<string, unknown>[]}
                filename={downloadFilename}
              />
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead className="bg-[#1B2559] text-white">
            <tr>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={clsx(
                    'px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap',
                    col.sortable && 'cursor-pointer hover:bg-white/10 select-none',
                    col.headerClassName
                  )}
                  onClick={() => col.sortable && handleSort(String(col.key))}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    <SortIcon col={col} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400 text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginated.map((row, i) => (
                <tr
                  key={i}
                  onClick={() => onRowClick?.(row)}
                  className={clsx(
                    'transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-blue-50',
                    i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50',
                    rowClassName?.(row)
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className={clsx('px-3 py-2 text-xs', col.className)}
                    >
                      {col.render
                        ? col.render(row[col.key as keyof T], row)
                        : (row[col.key as keyof T] as React.ReactNode) ?? '-'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-xs text-gray-400">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
              let pageNum: number
              if (totalPages <= 5) {
                pageNum = idx + 1
              } else if (page <= 3) {
                pageNum = idx + 1
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + idx
              } else {
                pageNum = page - 2 + idx
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={clsx(
                    'w-7 h-7 rounded text-xs font-medium',
                    page === pageNum
                      ? 'bg-[#1B2559] text-white'
                      : 'hover:bg-gray-100 text-gray-600'
                  )}
                >
                  {pageNum}
                </button>
              )
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
