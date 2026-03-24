import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { Upload, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { uploadExcel } from '../api/endpoints'
import type { UploadSummary } from '../types'

interface FileUploadProps {
  onSuccess?: () => void
}

export default function FileUpload({ onSuccess }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<UploadSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setError('Please upload an Excel file (.xlsx or .xls)')
      return
    }

    setIsUploading(true)
    setProgress(0)
    setError(null)
    setResult(null)

    try {
      const summary = await uploadExcel(file, setProgress)
      setResult(summary)
      // Invalidate all queries to refresh data
      queryClient.invalidateQueries()
      setTimeout(() => {
        onSuccess?.()
      }, 2000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setError(message)
    } finally {
      setIsUploading(false)
    }
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
          ${isDragging ? 'border-[#00BCD4] bg-cyan-50' : 'border-gray-200 hover:border-[#00BCD4] hover:bg-gray-50'}
          ${isUploading ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={onInputChange}
        />
        <FileSpreadsheet size={32} className="mx-auto mb-3 text-gray-400" />
        <p className="text-sm font-medium text-gray-700">
          {isDragging ? 'Drop your Excel file here' : 'Drag & drop your Excel file here'}
        </p>
        <p className="text-xs text-gray-400 mt-1">or click to browse</p>
        <p className="text-xs text-gray-400 mt-1">Supports .xlsx, .xls</p>
      </div>

      {isUploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Uploading and processing...</span>
            <span className="text-[#00BCD4] font-medium">{progress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-[#00BCD4] h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={18} className="text-green-500" />
            <span className="font-medium text-green-800">Upload successful!</span>
          </div>
          <ul className="text-sm text-green-700 space-y-0.5 ml-6">
            <li>{result.resources_upserted} resources</li>
            <li>{result.projects_upserted} projects</li>
            <li>{result.weekly_metrics_inserted.toLocaleString()} weekly records</li>
            <li>Sheets: {result.sheets_processed.join(', ')}</li>
          </ul>
          {result.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-orange-600 font-medium">Warnings:</p>
              {result.errors.slice(0, 3).map((e, i) => (
                <p key={i} className="text-xs text-orange-500">{e}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800 text-sm">Upload failed</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}
    </div>
  )
}
