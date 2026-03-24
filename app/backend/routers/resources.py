from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import Optional, List
from models import Resource, WeeklyMetric
from database import get_db
from schemas import ResourceResponse, ResourceWithMetrics, WeeklyMetricResponse

router = APIRouter()


def build_resource_metrics_query(db: Session, sheet_type: str = "Allocated"):
    return (
        db.query(
            Resource.resource_code,
            Resource.resource_name,
            Resource.role,
            Resource.primary_skill,
            Resource.work_location,
            Resource.resource_manager,
            Resource.resource_status,
            Resource.resource_vendor,
            Resource.vendor_code,
            Resource.location,
            Resource.rate,
            Resource.area,
            func.coalesce(func.sum(WeeklyMetric.demand_hours), 0).label("total_demand_hours"),
            func.coalesce(func.sum(WeeklyMetric.actual_hours), 0).label("total_actual_hours"),
            func.coalesce(func.sum(WeeklyMetric.capacity), 0).label("total_capacity"),
            func.coalesce(func.sum(WeeklyMetric.over_allocated_hours), 0).label("total_over_allocated_hours"),
            func.max(case((WeeklyMetric.over_allocation == True, 1), else_=0)).label("is_over_allocated"),
        )
        .outerjoin(WeeklyMetric, (Resource.resource_code == WeeklyMetric.resource_code) & (WeeklyMetric.sheet_type == sheet_type))
        .group_by(Resource.resource_code)
    )


@router.get("/resources", response_model=List[ResourceWithMetrics])
def list_resources(
    role: Optional[str] = Query(None),
    skill: Optional[str] = Query(None),
    vendor: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    manager: Optional[str] = Query(None),
    over_allocation: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    sheet_type: Optional[str] = Query("Allocated"),
    db: Session = Depends(get_db),
):
    q = build_resource_metrics_query(db, sheet_type)

    if role:
        q = q.filter(Resource.role == role)
    if skill:
        q = q.filter(Resource.primary_skill == skill)
    if vendor:
        q = q.filter(Resource.resource_vendor == vendor)
    if location:
        q = q.filter(Resource.location == location)
    if manager:
        q = q.filter(Resource.resource_manager == manager)
    if search:
        q = q.filter(
            (Resource.resource_code.ilike(f"%{search}%"))
            | (Resource.resource_name.ilike(f"%{search}%"))
            | (Resource.role.ilike(f"%{search}%"))
        )

    rows = q.all()
    results = []
    for r in rows:
        cap = r.total_capacity if r.total_capacity else 1
        util = round((r.total_demand_hours / cap) * 100, 1) if cap > 0 else 0.0
        is_over = bool(r.is_over_allocated)

        if over_allocation is not None and is_over != over_allocation:
            continue

        results.append(
            ResourceWithMetrics(
                id=0,
                resource_code=r.resource_code,
                resource_name=r.resource_name,
                role=r.role,
                primary_skill=r.primary_skill,
                work_location=r.work_location,
                resource_manager=r.resource_manager,
                resource_status=r.resource_status,
                resource_vendor=r.resource_vendor,
                vendor_code=r.vendor_code,
                location=r.location,
                rate=r.rate,
                area=r.area,
                total_demand_hours=round(r.total_demand_hours, 1),
                total_actual_hours=round(r.total_actual_hours, 1),
                total_capacity=round(r.total_capacity, 1),
                utilization_pct=util,
                is_over_allocated=is_over,
                total_over_allocated_hours=round(r.total_over_allocated_hours, 1),
            )
        )

    return results


@router.get("/resources/{code}")
def get_resource(code: str, db: Session = Depends(get_db)):
    resource = db.query(Resource).filter(Resource.resource_code == code).first()
    if not resource:
        raise HTTPException(status_code=404, detail=f"Resource {code} not found")

    # Get weekly metrics from Allocated sheet
    metrics = (
        db.query(WeeklyMetric)
        .filter(WeeklyMetric.resource_code == code, WeeklyMetric.sheet_type == "Allocated")
        .order_by(WeeklyMetric.week)
        .all()
    )

    # Summary stats
    total_demand = sum(m.demand_hours for m in metrics)
    total_actual = sum(m.actual_hours for m in metrics)
    total_capacity = sum(m.capacity for m in metrics)
    total_over = sum(m.over_allocated_hours for m in metrics)
    util_pct = round((total_demand / total_capacity) * 100, 1) if total_capacity > 0 else 0.0
    is_over = any(m.over_allocation for m in metrics)

    # Projects
    project_categories = list(set(m.project_category for m in metrics if m.project_category))

    weekly_data = [
        {
            "id": m.id,
            "week": m.week.isoformat() if m.week else None,
            "week_text": m.week_text,
            "demand_hours": m.demand_hours,
            "actual_hours": m.actual_hours,
            "capacity": m.capacity,
            "max_hours": m.max_hours,
            "over_allocation": m.over_allocation,
            "over_allocated_hours": m.over_allocated_hours,
            "week_month": m.week_month,
            "week_year": m.week_year,
            "project_category": m.project_category,
            "technology": m.technology,
        }
        for m in metrics
    ]

    return {
        "resource": {
            "id": resource.id,
            "resource_code": resource.resource_code,
            "resource_name": resource.resource_name,
            "role": resource.role,
            "primary_skill": resource.primary_skill,
            "work_location": resource.work_location,
            "resource_manager": resource.resource_manager,
            "resource_status": resource.resource_status,
            "resource_vendor": resource.resource_vendor,
            "vendor_code": resource.vendor_code,
            "location": resource.location,
            "rate": resource.rate,
            "area": resource.area,
        },
        "summary": {
            "total_demand_hours": round(total_demand, 1),
            "total_actual_hours": round(total_actual, 1),
            "total_capacity": round(total_capacity, 1),
            "utilization_pct": util_pct,
            "is_over_allocated": is_over,
            "total_over_allocated_hours": round(total_over, 1),
            "project_categories": project_categories,
        },
        "weekly_metrics": weekly_data,
    }
