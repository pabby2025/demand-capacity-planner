from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from models import Project, WeeklyMetric, Resource
from database import get_db

router = APIRouter()


@router.get("/projects")
def list_projects(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    # Get all projects
    q = db.query(Project)
    if category:
        q = q.filter(Project.category == category)
    if search:
        q = q.filter(
            Project.project_name.ilike(f"%{search}%")
            | Project.project_code.ilike(f"%{search}%")
        )
    projects = q.all()

    results = []
    for proj in projects:
        # Get metrics from Allocated sheet matching by category
        metrics = (
            db.query(WeeklyMetric)
            .filter(
                WeeklyMetric.project_category == proj.project_name,
                WeeklyMetric.sheet_type == "Allocated",
            )
            .all()
        )

        total_demand = sum(m.demand_hours for m in metrics)
        total_actual = sum(m.actual_hours for m in metrics)
        total_capacity = sum(m.capacity for m in metrics)
        resource_codes = set(m.resource_code for m in metrics)
        over_alloc_resources = set(m.resource_code for m in metrics if m.over_allocation)
        util_pct = round((total_demand / total_capacity) * 100, 1) if total_capacity > 0 else 0.0

        results.append(
            {
                "id": proj.id,
                "project_code": proj.project_code,
                "project_name": proj.project_name,
                "category": proj.category,
                "total_resources": len(resource_codes),
                "total_demand_hours": round(total_demand, 1),
                "total_actual_hours": round(total_actual, 1),
                "avg_utilization": util_pct,
                "over_allocated_count": len(over_alloc_resources),
            }
        )

    return results


@router.get("/projects/{code}")
def get_project(code: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.project_code == code).first()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {code} not found")

    # Get all metrics for this project by category name
    metrics = (
        db.query(WeeklyMetric)
        .filter(
            WeeklyMetric.project_category == project.project_name,
            WeeklyMetric.sheet_type == "Allocated",
        )
        .order_by(WeeklyMetric.week)
        .all()
    )

    total_demand = sum(m.demand_hours for m in metrics)
    total_actual = sum(m.actual_hours for m in metrics)
    total_capacity = sum(m.capacity for m in metrics)
    util_pct = round((total_demand / total_capacity) * 100, 1) if total_capacity > 0 else 0.0

    resource_codes = list(set(m.resource_code for m in metrics))
    resources = db.query(Resource).filter(Resource.resource_code.in_(resource_codes)).all()

    resource_map = {r.resource_code: r for r in resources}

    resource_list = []
    for rc in resource_codes:
        res_metrics = [m for m in metrics if m.resource_code == rc]
        r_demand = sum(m.demand_hours for m in res_metrics)
        r_actual = sum(m.actual_hours for m in res_metrics)
        r_cap = sum(m.capacity for m in res_metrics)
        r_util = round((r_demand / r_cap) * 100, 1) if r_cap > 0 else 0.0
        r_over = any(m.over_allocation for m in res_metrics)
        r = resource_map.get(rc)
        if r:
            resource_list.append(
                {
                    "resource_code": rc,
                    "resource_name": r.resource_name,
                    "role": r.role,
                    "primary_skill": r.primary_skill,
                    "vendor": r.resource_vendor,
                    "location": r.location,
                    "manager": r.resource_manager,
                    "demand_hours": round(r_demand, 1),
                    "actual_hours": round(r_actual, 1),
                    "capacity": round(r_cap, 1),
                    "utilization_pct": r_util,
                    "is_over_allocated": r_over,
                }
            )

    # Weekly trend
    weekly_map = {}
    for m in metrics:
        wk = m.week.isoformat() if m.week else m.week_text
        if wk not in weekly_map:
            weekly_map[wk] = {"week": wk, "week_text": m.week_text, "demand_hours": 0, "actual_hours": 0, "capacity": 0}
        weekly_map[wk]["demand_hours"] += m.demand_hours
        weekly_map[wk]["actual_hours"] += m.actual_hours
        weekly_map[wk]["capacity"] += m.capacity

    weekly_trend = sorted(weekly_map.values(), key=lambda x: x["week"])

    return {
        "project": {
            "id": project.id,
            "project_code": project.project_code,
            "project_name": project.project_name,
            "category": project.category,
        },
        "summary": {
            "total_resources": len(resource_codes),
            "total_demand_hours": round(total_demand, 1),
            "total_actual_hours": round(total_actual, 1),
            "total_capacity": round(total_capacity, 1),
            "avg_utilization": util_pct,
            "over_allocated_count": sum(1 for rl in resource_list if rl["is_over_allocated"]),
        },
        "resources": sorted(resource_list, key=lambda x: x["demand_hours"], reverse=True),
        "weekly_trend": weekly_trend,
    }
