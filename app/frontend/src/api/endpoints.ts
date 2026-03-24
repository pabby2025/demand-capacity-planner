import client from './client'
import type {
  ResourceWithMetrics,
  ProjectWithDetails,
  DashboardStats,
  CapacityVsDemandResponse,
  UtilizationResponse,
  OverallocationEntry,
  VendorBreakdownEntry,
  FilterOptions,
  UploadSummary,
  FilterState,
} from '../types'

// Upload
export async function uploadExcel(file: File, onProgress?: (pct: number) => void): Promise<UploadSummary> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await client.post<UploadSummary>('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    },
  })
  return res.data
}

// Resources
export async function fetchResources(filters?: Partial<FilterState> & { search?: string; over_allocation?: boolean }): Promise<ResourceWithMetrics[]> {
  const params: Record<string, string | boolean | undefined> = {}
  if (filters?.role) params.role = filters.role
  if (filters?.skill) params.skill = filters.skill
  if (filters?.vendor) params.vendor = filters.vendor
  if (filters?.location) params.location = filters.location
  if (filters?.manager) params.manager = filters.manager
  if (filters?.search) params.search = filters.search
  if (filters?.over_allocation !== undefined) params.over_allocation = filters.over_allocation
  const res = await client.get<ResourceWithMetrics[]>('/resources', { params })
  return res.data
}

export async function fetchResourceDetail(code: string) {
  const res = await client.get(`/resources/${code}`)
  return res.data
}

// Projects
export async function fetchProjects(filters?: { category?: string; search?: string }): Promise<ProjectWithDetails[]> {
  const res = await client.get<ProjectWithDetails[]>('/projects', { params: filters })
  return res.data
}

export async function fetchProjectDetail(code: string) {
  const res = await client.get(`/projects/${code}`)
  return res.data
}

// Analytics
export async function fetchDashboardStats(filters?: Partial<FilterState>): Promise<DashboardStats> {
  const params: Record<string, string | undefined> = {}
  if (filters?.vendor) params.vendor = filters.vendor
  if (filters?.manager) params.manager = filters.manager
  if (filters?.location) params.location = filters.location
  if (filters?.role) params.role = filters.role
  if (filters?.skill) params.skill = filters.skill
  if (filters?.weekStart) params.week_start = filters.weekStart
  if (filters?.weekEnd) params.week_end = filters.weekEnd
  const res = await client.get<DashboardStats>('/analytics/dashboard', { params })
  return res.data
}

export async function fetchCapacityVsDemand(params?: {
  vendor?: string
  skill?: string
  week_year?: number
  manager?: string
  location?: string
  sheet_type?: string
}): Promise<CapacityVsDemandResponse> {
  const res = await client.get<CapacityVsDemandResponse>('/analytics/capacity-vs-demand', { params })
  return res.data
}

export async function fetchUtilization(params?: {
  group_by?: string
  sheet_type?: string
  week_year?: number
}): Promise<UtilizationResponse> {
  const res = await client.get<UtilizationResponse>('/analytics/utilization', { params })
  return res.data
}

export async function fetchOverallocations(params?: {
  vendor?: string
  role?: string
  manager?: string
}): Promise<OverallocationEntry[]> {
  const res = await client.get<OverallocationEntry[]>('/analytics/overallocations', { params })
  return res.data
}

export async function fetchHeatmap(params?: {
  view?: string
  sheet_type?: string
  week_year?: number
  vendor?: string
  limit_resources?: number
}) {
  const res = await client.get('/analytics/heatmap', { params })
  return res.data
}

export async function fetchVendorBreakdown(params?: {
  sheet_type?: string
  week_year?: number
}): Promise<VendorBreakdownEntry[]> {
  const res = await client.get<VendorBreakdownEntry[]>('/analytics/vendor-breakdown', { params })
  return res.data
}

export async function fetchFilterOptions(): Promise<FilterOptions> {
  const res = await client.get<FilterOptions>('/analytics/filters')
  return res.data
}

export async function checkHealth() {
  const res = await client.get('/health')
  return res.data
}
