from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import date


# Resource schemas
class ResourceBase(BaseModel):
    resource_code: str
    resource_name: Optional[str] = None
    role: Optional[str] = None
    primary_skill: Optional[str] = None
    work_location: Optional[str] = None
    resource_manager: Optional[str] = None
    resource_status: Optional[str] = "ACTIVE"
    resource_vendor: Optional[str] = None
    vendor_code: Optional[str] = None
    location: Optional[str] = None
    rate: Optional[float] = 0.0
    area: Optional[str] = None


class ResourceCreate(ResourceBase):
    pass


class ResourceResponse(ResourceBase):
    id: int

    class Config:
        from_attributes = True


class ResourceWithMetrics(ResourceResponse):
    total_demand_hours: Optional[float] = 0.0
    total_actual_hours: Optional[float] = 0.0
    total_capacity: Optional[float] = 0.0
    utilization_pct: Optional[float] = 0.0
    is_over_allocated: Optional[bool] = False
    total_over_allocated_hours: Optional[float] = 0.0


# Project schemas
class ProjectBase(BaseModel):
    project_code: str
    project_name: Optional[str] = None
    category: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectResponse(ProjectBase):
    id: int

    class Config:
        from_attributes = True


class ProjectWithDetails(ProjectResponse):
    total_resources: Optional[int] = 0
    total_demand_hours: Optional[float] = 0.0
    total_actual_hours: Optional[float] = 0.0
    avg_utilization: Optional[float] = 0.0
    over_allocated_count: Optional[int] = 0


# WeeklyMetric schemas
class WeeklyMetricBase(BaseModel):
    demand_key: Optional[str] = None
    resource_code: str
    project_category: Optional[str] = None
    sheet_type: str
    week_text: Optional[str] = None
    week: Optional[date] = None
    demand_hours: Optional[float] = 0.0
    actual_hours: Optional[float] = 0.0
    max_hours: Optional[float] = 0.0
    capacity: Optional[float] = 0.0
    over_allocation: Optional[bool] = False
    over_allocated_hours: Optional[float] = 0.0
    week_year: Optional[int] = None
    week_quarter: Optional[int] = None
    week_month: Optional[str] = None
    week_month_index: Optional[int] = None
    demand_dollar_rate: Optional[float] = 0.0
    actual_dollar_rate: Optional[float] = 0.0
    availability_dollar: Optional[float] = 0.0
    max_capacity_dollar: Optional[float] = 0.0
    technology: Optional[str] = None
    resource_type: Optional[str] = None
    area: Optional[str] = None


class WeeklyMetricCreate(WeeklyMetricBase):
    pass


class WeeklyMetricResponse(WeeklyMetricBase):
    id: int

    class Config:
        from_attributes = True


# Analytics response schemas
class VendorDistribution(BaseModel):
    vendor: str
    count: int
    onshore: int
    offshore: int
    demand_hours: float
    actual_hours: float
    capacity: float


class LocationDistribution(BaseModel):
    location: str
    count: int


class RoleDistribution(BaseModel):
    role: str
    count: int
    demand_hours: float


class SkillDistribution(BaseModel):
    skill: str
    count: int
    demand_hours: float


class TopResource(BaseModel):
    resource_code: str
    resource_name: str
    role: str
    vendor: str
    demand_hours: float
    actual_hours: float
    utilization_pct: float
    is_over_allocated: bool


class TopProject(BaseModel):
    category: str
    demand_hours: float
    actual_hours: float
    resource_count: int


class DashboardStats(BaseModel):
    total_resources: int
    over_allocated_count: int
    over_allocated_pct: float
    avg_utilization: float
    total_demand_hours: float
    total_actual_hours: float
    total_capacity: float
    vendor_distribution: List[VendorDistribution]
    location_distribution: List[LocationDistribution]
    top_10_resources_by_demand: List[TopResource]
    top_10_projects_by_demand: List[TopProject]
    role_distribution: List[RoleDistribution]
    skill_distribution: List[SkillDistribution]


class WeeklySeries(BaseModel):
    week: str
    week_date: Optional[str] = None
    capacity: float
    demand_hours: float
    actual_hours: float
    utilization_pct: float
    over_allocated_count: int


class CapacityVsDemandResponse(BaseModel):
    series: List[WeeklySeries]
    filter_vendor: Optional[str] = None
    filter_skill: Optional[str] = None
    filter_year: Optional[int] = None


class UtilizationGroup(BaseModel):
    group_name: str
    capacity: float
    demand_hours: float
    actual_hours: float
    utilization_pct: float
    resource_count: int
    over_allocated_count: int


class UtilizationResponse(BaseModel):
    group_by: str
    groups: List[UtilizationGroup]


class OverallocationEntry(BaseModel):
    resource_code: str
    resource_name: str
    role: str
    skill: str
    vendor: str
    location: str
    manager: str
    week: Optional[str] = None
    demand_hours: float
    capacity: float
    over_allocated_hours: float
    project_category: Optional[str] = None


class HeatmapCell(BaseModel):
    resource_code: str
    resource_name: str
    week: str
    value: float


class HeatmapResponse(BaseModel):
    view: str
    data: List[HeatmapCell]
    weeks: List[str]
    resources: List[str]


class VendorBreakdownEntry(BaseModel):
    vendor: str
    onshore_count: int
    offshore_count: int
    total_count: int
    onshore_demand: float
    offshore_demand: float
    total_demand: float
    onshore_capacity: float
    offshore_capacity: float


class UploadSummary(BaseModel):
    resources_upserted: int
    projects_upserted: int
    weekly_metrics_inserted: int
    sheets_processed: List[str]
    errors: List[str]
