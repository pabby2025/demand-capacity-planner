export interface Resource {
  id: number
  resource_code: string
  resource_name: string | null
  role: string | null
  primary_skill: string | null
  work_location: string | null
  resource_manager: string | null
  resource_status: string | null
  resource_vendor: string | null
  vendor_code: string | null
  location: string | null
  rate: number | null
  area: string | null
}

export interface ResourceWithMetrics extends Resource {
  total_demand_hours: number
  total_actual_hours: number
  total_capacity: number
  utilization_pct: number
  is_over_allocated: boolean
  total_over_allocated_hours: number
}

export interface WeeklyMetric {
  id: number
  demand_key: string | null
  resource_code: string
  project_category: string | null
  sheet_type: string
  week_text: string | null
  week: string | null
  demand_hours: number
  actual_hours: number
  max_hours: number
  capacity: number
  over_allocation: boolean
  over_allocated_hours: number
  week_year: number | null
  week_quarter: number | null
  week_month: string | null
  week_month_index: number | null
  demand_dollar_rate: number
  actual_dollar_rate: number
  availability_dollar: number
  max_capacity_dollar: number
  technology: string | null
  resource_type: string | null
  area: string | null
}

export interface Project {
  id: number
  project_code: string
  project_name: string | null
  category: string | null
}

export interface ProjectWithDetails extends Project {
  total_resources: number
  total_demand_hours: number
  total_actual_hours: number
  avg_utilization: number
  over_allocated_count: number
}

export interface VendorDistribution {
  vendor: string
  count: number
  onshore: number
  offshore: number
  demand_hours: number
  actual_hours: number
  capacity: number
}

export interface LocationDistribution {
  location: string
  count: number
}

export interface RoleDistribution {
  role: string
  count: number
  demand_hours: number
}

export interface SkillDistribution {
  skill: string
  count: number
  demand_hours: number
}

export interface TopResource {
  resource_code: string
  resource_name: string
  role: string
  vendor: string
  demand_hours: number
  actual_hours: number
  utilization_pct: number
  is_over_allocated: boolean
}

export interface TopProject {
  category: string
  demand_hours: number
  actual_hours: number
  resource_count: number
}

export interface DashboardStats {
  total_resources: number
  over_allocated_count: number
  over_allocated_pct: number
  avg_utilization: number
  total_demand_hours: number
  total_actual_hours: number
  total_capacity: number
  vendor_distribution: VendorDistribution[]
  location_distribution: LocationDistribution[]
  top_10_resources_by_demand: TopResource[]
  top_10_projects_by_demand: TopProject[]
  role_distribution: RoleDistribution[]
  skill_distribution: SkillDistribution[]
}

export interface WeeklySeries {
  week: string
  week_date: string | null
  capacity: number
  demand_hours: number
  actual_hours: number
  utilization_pct: number
  over_allocated_count: number
}

export interface CapacityVsDemandResponse {
  series: WeeklySeries[]
  filter_vendor: string | null
  filter_skill: string | null
  filter_year: number | null
}

export interface UtilizationGroup {
  group_name: string
  capacity: number
  demand_hours: number
  actual_hours: number
  utilization_pct: number
  resource_count: number
  over_allocated_count: number
}

export interface UtilizationResponse {
  group_by: string
  groups: UtilizationGroup[]
}

export interface OverallocationEntry {
  resource_code: string
  resource_name: string
  role: string
  skill: string
  vendor: string
  location: string
  manager: string
  week: string | null
  demand_hours: number
  capacity: number
  over_allocated_hours: number
  project_category: string | null
}

export interface VendorBreakdownEntry {
  vendor: string
  onshore_count: number
  offshore_count: number
  total_count: number
  onshore_demand: number
  offshore_demand: number
  total_demand: number
  onshore_capacity: number
  offshore_capacity: number
}

export interface FilterState {
  weekStart: string
  weekEnd: string
  manager: string
  vendor: string
  location: string
  role: string
  skill: string
  area: string
  year: string
}

export interface FilterOptions {
  roles: string[]
  skills: string[]
  vendors: string[]
  managers: string[]
  locations: string[]
  areas: string[]
  years: number[]
}

export interface UploadSummary {
  resources_upserted: number
  projects_upserted: number
  weekly_metrics_inserted: number
  sheets_processed: string[]
  errors: string[]
}
