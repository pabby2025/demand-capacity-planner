import { Download } from 'lucide-react'

interface ExportButtonsProps {
  data: Record<string, unknown>[]
  filename?: string
  className?: string
}

function toCSV(data: Record<string, unknown>[]): string {
  if (!data.length) return ''
  const headers = Object.keys(data[0])
  const rows = data.map((row) =>
    headers.map((h) => {
      const val = row[h]
      const str = val === null || val === undefined ? '' : String(val)
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str
    }).join(',')
  )
  return [headers.join(','), ...rows].join('\n')
}

export default function ExportButtons({ data, filename = 'export', className = '' }: ExportButtonsProps) {
  const downloadCSV = () => {
    const csv = toCSV(data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={downloadCSV}
      disabled={!data.length}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 bg-white hover:bg-gray-50 rounded-lg text-gray-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <Download size={14} />
      Export CSV
    </button>
  )
}
