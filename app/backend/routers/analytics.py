from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case, distinct
from typing import Optional, List
from models import Resource, WeeklyMetric
from database import get_db

router = APIRouter()

DEFAULT_SHEET = "Allocated"


@router.get("/analytics/dashboard")
def get_dashboard(
    vendor: Optional[str] = Query(None),
    manager: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    skill: Optional[str] = Query(None),
    week_start: Optional[str] = Query(None),
    week_end: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    # Base query for resources
    res_q = db.query(Resource)
    if vendor:
        res_q = res_q.filter(Resource.resource_vendor == vendor)
    if manager:
        res_q = res_q.filter(Resource.resource_manager == manager)
    if location:
        res_q = res_q.filter(Resource.location == location)
    if role:
        res_q = res_q.filter(Resource.role == role)
    if skill:
        res_q = res_q.filter(Resource.primary_skill == skill)

    all_resources = res_q.all()
    resource_codes = [r.resource_code for r in all_resources]
    total_resources = len(resource_codes)

    if total_resources == 0:
        return {
            "total_resources": 0,
            "over_allocated_count": 0,
            "over_allocated_pct": 0.0,
            "avg_utilization": 0.0,
            "total_demand_hours": 0.0,
            "total_actual_hours": 0.0,
            "total_capacity": 0.0,
            "vendor_distribution": [],
            "location_distribution": [],
            "top_10_resources_by_demand": [],
            "top_10_projects_by_demand": [],
            "role_distribution": [],
            "skill_distribution": [],
        }

    # Metrics query
    metrics_q = (
        db.query(WeeklyMetric)
        .filter(WeeklyMetric.resource_code.in_(resource_codes), WeeklyMetric.sheet_type == DEFAULT_SHEET)
    )
    if week_start:
        metrics_q = metrics_q.filter(WeeklyMetric.week >= week_start)
    if week_end:
        metrics_q = metrics_q.filter(WeeklyMetric.week <= week_end)

    metrics = metrics_q.all()

    total_demand = sum(m.demand_hours for m in metrics)
    total_actual = sum(m.actual_hours for m in metrics)
    total_capacity = sum(m.capacity for m in metrics)

    # Over-allocation
    over_alloc_codes = set(m.resource_code for m in metrics if m.over_allocation)
    over_allocated_count = len(over_alloc_codes)
    over_allocated_pct = round((over_allocated_count / total_resources) * 100, 1) if total_resources > 0 else 0.0

    # Avg utilization per resource
    resource_utils = {}
    for m in metrics:
        if m.resource_code not in resource_utils:
            resource_utils[m.resource_code] = {"demand": 0.0, "capacity": 0.0}
        resource_utils[m.resource_code]["demand"] += m.demand_hours
        resource_utils[m.resource_code]["capacity"] += m.capacity

    util_vals = [
        (v["demand"] / v["capacity"]) * 100
        for v in resource_utils.values()
        if v["capacity"] > 0
    ]
    avg_utilization = round(sum(util_vals) / len(util_vals), 1) if util_vals else 0.0

    # Vendor distribution
    resource_vendor_map = {r.resource_code: r for r in all_resources}
    vendor_data = {}
    for r in all_resources:
        v = r.resource_vendor or "Unknown"
        if v not in vendor_data:
            vendor_data[v] = {"vendor": v, "count": 0, "onshore": 0, "offshore": 0, "demand": 0.0, "actual": 0.0, "capacity": 0.0}
        vendor_data[v]["count"] += 1
        if r.location == "Onshore":
            vendor_data[v]["onshore"] += 1
        else:
            vendor_data[v]["offshore"] += 1

    for m in metrics:
        r = resource_vendor_map.get(m.resource_code)
        if r:
            v = r.resource_vendor or "Unknown"
            if v in vendor_data:
                vendor_data[v]["demand"] += m.demand_hours
                vendor_data[v]["actual"] += m.actual_hours
                vendor_data[v]["capacity"] += m.capacity

    vendor_distribution = [
        {
            "vendor": v,
            "count": d["count"],
            "onshore": d["onshore"],
            "offshore": d["offshore"],
            "demand_hours": round(d["demand"], 1),
            "actual_hours": round(d["actual"], 1),
            "capacity": round(d["capacity"], 1),
        }
        for v, d in vendor_data.items()
    ]

    # Location distribution
    loc_map = {}
    for r in all_resources:
        loc = r.location or "Unknown"
        loc_map[loc] = loc_map.get(loc, 0) + 1
    location_distribution = [{"location": k, "count": v} for k, v in loc_map.items()]

    # Role distribution
    role_data = {}
    for r in all_resources:
        ro = r.role or "Unknown"
        if ro not in role_data:
            role_data[ro] = {"count": 0, "demand": 0.0}
        role_data[ro]["count"] += 1
    for m in metrics:
        r = resource_vendor_map.get(m.resource_code)
        if r:
            ro = r.role or "Unknown"
            if ro in role_data:
                role_data[ro]["demand"] += m.demand_hours
    role_distribution = [{"role": k, "count": v["count"], "demand_hours": round(v["demand"], 1)} for k, v in role_data.items()]

    # Skill distribution
    skill_data = {}
    for r in all_resources:
        sk = r.primary_skill or "Unknown"
        if sk not in skill_data:
            skill_data[sk] = {"count": 0, "demand": 0.0}
        skill_data[sk]["count"] += 1
    for m in metrics:
        r = resource_vendor_map.get(m.resource_code)
        if r:
            sk = r.primary_skill or "Unknown"
            if sk in skill_data:
                skill_data[sk]["demand"] += m.demand_hours
    skill_distribution = [{"skill": k, "count": v["count"], "demand_hours": round(v["demand"], 1)} for k, v in skill_data.items()]

    # Top 10 resources by demand
    resource_demand = {}
    for m in metrics:
        if m.resource_code not in resource_demand:
            resource_demand[m.resource_code] = {"demand": 0.0, "actual": 0.0, "capacity": 0.0, "over": False}
        resource_demand[m.resource_code]["demand"] += m.demand_hours
        resource_demand[m.resource_code]["actual"] += m.actual_hours
        resource_demand[m.resource_code]["capacity"] += m.capacity
        if m.over_allocation:
            resource_demand[m.resource_code]["over"] = True

    top_resources = sorted(resource_demand.items(), key=lambda x: x[1]["demand"], reverse=True)[:10]
    top_10_resources = []
    for rc, data in top_resources:
        r = resource_vendor_map.get(rc)
        if r:
            cap = data["capacity"] if data["capacity"] > 0 else 1
            top_10_resources.append({
                "resource_code": rc,
                "resource_name": r.resource_name or rc,
                "role": r.role or "",
                "vendor": r.resource_vendor or "",
                "demand_hours": round(data["demand"], 1),
                "actual_hours": round(data["actual"], 1),
                "utilization_pct": round((data["demand"] / cap) * 100, 1),
                "is_over_allocated": data["over"],
            })

    # Top 10 projects by demand
    proj_demand = {}
    for m in metrics:
        cat = m.project_category or "Unknown"
        if cat not in proj_demand:
            proj_demand[cat] = {"demand": 0.0, "actual": 0.0, "resources": set()}
        proj_demand[cat]["demand"] += m.demand_hours
        proj_demand[cat]["actual"] += m.actual_hours
        proj_demand[cat]["resources"].add(m.resource_code)

    top_10_projects = sorted(
        [
            {
                "category": k,
                "demand_hours": round(v["demand"], 1),
                "actual_hours": round(v["actual"], 1),
                "resource_count": len(v["resources"]),
            }
            for k, v in proj_demand.items()
        ],
        key=lambda x: x["demand_hours"],
        reverse=True,
    )[:10]

    return {
        "total_resources": total_resources,
        "over_allocated_count": over_allocated_count,
        "over_allocated_pct": over_allocated_pct,
        "avg_utilization": avg_utilization,
        "total_demand_hours": round(total_demand, 1),
        "total_actual_hours": round(total_actual, 1),
        "total_capacity": round(total_capacity, 1),
        "vendor_distribution": vendor_distribution,
        "location_distribution": location_distribution,
        "top_10_resources_by_demand": top_10_resources,
        "top_10_projects_by_demand": top_10_projects,
        "role_distribution": role_distribution,
        "skill_distribution": skill_distribution,
    }


@router.get("/analytics/capacity-vs-demand")
def capacity_vs_demand(
    vendor: Optional[str] = Query(None),
    skill: Optional[str] = Query(None),
    week_year: Optional[int] = Query(None),
    manager: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    sheet_type: Optional[str] = Query(DEFAULT_SHEET),
    db: Session = Depends(get_db),
):
    res_q = db.query(Resource)
    if vendor:
        res_q = res_q.filter(Resource.resource_vendor == vendor)
    if skill:
        res_q = res_q.filter(Resource.primary_skill == skill)
    if manager:
        res_q = res_q.filter(Resource.resource_manager == manager)
    if location:
        res_q = res_q.filter(Resource.location == location)

    resource_codes = [r.resource_code for r in res_q.all()]

    metrics_q = (
        db.query(WeeklyMetric)
        .filter(WeeklyMetric.resource_code.in_(resource_codes), WeeklyMetric.sheet_type == sheet_type)
    )
    if week_year:
        metrics_q = metrics_q.filter(WeeklyMetric.week_year == week_year)

    metrics = metrics_q.all()

    weekly_map = {}
    for m in metrics:
        wk = m.week.isoformat() if m.week else (m.week_text or "")
        if wk not in weekly_map:
            weekly_map[wk] = {
                "week": m.week_text or wk,
                "week_date": wk,
                "capacity": 0.0,
                "demand_hours": 0.0,
                "actual_hours": 0.0,
                "over_count": 0,
                "resources": set(),
            }
        weekly_map[wk]["capacity"] += m.capacity
        weekly_map[wk]["demand_hours"] += m.demand_hours
        weekly_map[wk]["actual_hours"] += m.actual_hours
        if m.over_allocation:
            weekly_map[wk]["resources"].add(m.resource_code)

    series = []
    for wk_date, data in sorted(weekly_map.items()):
        cap = data["capacity"] if data["capacity"] > 0 else 1
        series.append({
            "week": data["week"],
            "week_date": data["week_date"],
            "capacity": round(data["capacity"], 1),
            "demand_hours": round(data["demand_hours"], 1),
            "actual_hours": round(data["actual_hours"], 1),
            "utilization_pct": round((data["demand_hours"] / cap) * 100, 1),
            "over_allocated_count": len(data["resources"]),
        })

    return {
        "series": series,
        "filter_vendor": vendor,
        "filter_skill": skill,
        "filter_year": week_year,
    }


@router.get("/analytics/utilization")
def utilization_by_group(
    group_by: str = Query("vendor"),
    sheet_type: Optional[str] = Query(DEFAULT_SHEET),
    week_year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    metrics_q = db.query(WeeklyMetric).filter(WeeklyMetric.sheet_type == sheet_type)
    if week_year:
        metrics_q = metrics_q.filter(WeeklyMetric.week_year == week_year)
    metrics = metrics_q.all()

    resources = {r.resource_code: r for r in db.query(Resource).all()}

    group_data = {}
    for m in metrics:
        r = resources.get(m.resource_code)
        if not r:
            continue

        if group_by == "vendor":
            key = r.resource_vendor or "Unknown"
        elif group_by == "role":
            key = r.role or "Unknown"
        elif group_by == "skill":
            key = r.primary_skill or "Unknown"
        elif group_by == "manager":
            key = r.resource_manager or "Unknown"
        elif group_by == "location":
            key = r.location or "Unknown"
        else:
            key = r.resource_vendor or "Unknown"

        if key not in group_data:
            group_data[key] = {
                "capacity": 0.0,
                "demand": 0.0,
                "actual": 0.0,
                "resources": set(),
                "over_resources": set(),
            }
        group_data[key]["capacity"] += m.capacity
        group_data[key]["demand"] += m.demand_hours
        group_data[key]["actual"] += m.actual_hours
        group_data[key]["resources"].add(m.resource_code)
        if m.over_allocation:
            group_data[key]["over_resources"].add(m.resource_code)

    groups = []
    for key, data in group_data.items():
        cap = data["capacity"] if data["capacity"] > 0 else 1
        groups.append({
            "group_name": key,
            "capacity": round(data["capacity"], 1),
            "demand_hours": round(data["demand"], 1),
            "actual_hours": round(data["actual"], 1),
            "utilization_pct": round((data["demand"] / cap) * 100, 1),
            "resource_count": len(data["resources"]),
            "over_allocated_count": len(data["over_resources"]),
        })

    return {"group_by": group_by, "groups": sorted(groups, key=lambda x: x["demand_hours"], reverse=True)}


@router.get("/analytics/overallocations")
def get_overallocations(
    vendor: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    manager: Optional[str] = Query(None),
    sheet_type: Optional[str] = Query(DEFAULT_SHEET),
    db: Session = Depends(get_db),
):
    res_q = db.query(Resource)
    if vendor:
        res_q = res_q.filter(Resource.resource_vendor == vendor)
    if role:
        res_q = res_q.filter(Resource.role == role)
    if manager:
        res_q = res_q.filter(Resource.resource_manager == manager)

    resources = {r.resource_code: r for r in res_q.all()}

    metrics = (
        db.query(WeeklyMetric)
        .filter(
            WeeklyMetric.resource_code.in_(list(resources.keys())),
            WeeklyMetric.sheet_type == sheet_type,
            WeeklyMetric.over_allocation == True,
        )
        .order_by(WeeklyMetric.over_allocated_hours.desc())
        .all()
    )

    result = []
    for m in metrics:
        r = resources.get(m.resource_code)
        if r:
            result.append({
                "resource_code": m.resource_code,
                "resource_name": r.resource_name,
                "role": r.role,
                "skill": r.primary_skill,
                "vendor": r.resource_vendor,
                "location": r.location,
                "manager": r.resource_manager,
                "week": m.week.isoformat() if m.week else m.week_text,
                "demand_hours": m.demand_hours,
                "capacity": m.capacity,
                "over_allocated_hours": m.over_allocated_hours,
                "project_category": m.project_category,
            })

    return result


@router.get("/analytics/heatmap")
def get_heatmap(
    view: str = Query("demand"),
    sheet_type: Optional[str] = Query(DEFAULT_SHEET),
    week_year: Optional[int] = Query(None),
    vendor: Optional[str] = Query(None),
    limit_resources: int = Query(20),
    db: Session = Depends(get_db),
):
    res_q = db.query(Resource)
    if vendor:
        res_q = res_q.filter(Resource.resource_vendor == vendor)
    resources = {r.resource_code: r for r in res_q.all()}

    metrics_q = (
        db.query(WeeklyMetric)
        .filter(
            WeeklyMetric.resource_code.in_(list(resources.keys())),
            WeeklyMetric.sheet_type == sheet_type,
        )
    )
    if week_year:
        metrics_q = metrics_q.filter(WeeklyMetric.week_year == week_year)

    metrics = metrics_q.order_by(WeeklyMetric.week).all()

    # Get top resources by demand
    res_demand = {}
    for m in metrics:
        res_demand[m.resource_code] = res_demand.get(m.resource_code, 0) + m.demand_hours

    top_resources = [k for k, _ in sorted(res_demand.items(), key=lambda x: x[1], reverse=True)[:limit_resources]]

    weeks = sorted(set(m.week.isoformat() if m.week else m.week_text for m in metrics if m.week or m.week_text))

    data = []
    for m in metrics:
        if m.resource_code not in top_resources:
            continue
        wk = m.week.isoformat() if m.week else m.week_text
        r = resources.get(m.resource_code)
        if view == "demand":
            value = m.demand_hours
        elif view == "actual":
            value = m.actual_hours
        else:
            value = m.capacity
        data.append({
            "resource_code": m.resource_code,
            "resource_name": r.resource_name if r else m.resource_code,
            "week": wk,
            "value": value,
        })

    return {
        "view": view,
        "data": data,
        "weeks": weeks,
        "resources": [resources[rc].resource_name or rc for rc in top_resources if rc in resources],
    }


@router.get("/analytics/vendor-breakdown")
def vendor_breakdown(
    sheet_type: Optional[str] = Query(DEFAULT_SHEET),
    week_year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    resources = {r.resource_code: r for r in db.query(Resource).all()}

    metrics_q = db.query(WeeklyMetric).filter(WeeklyMetric.sheet_type == sheet_type)
    if week_year:
        metrics_q = metrics_q.filter(WeeklyMetric.week_year == week_year)
    metrics = metrics_q.all()

    vendor_data = {}
    for m in metrics:
        r = resources.get(m.resource_code)
        if not r:
            continue
        v = r.resource_vendor or "Unknown"
        loc = r.location or "Unknown"
        if v not in vendor_data:
            vendor_data[v] = {
                "vendor": v,
                "onshore_resources": set(),
                "offshore_resources": set(),
                "onshore_demand": 0.0,
                "offshore_demand": 0.0,
                "onshore_capacity": 0.0,
                "offshore_capacity": 0.0,
            }
        if loc == "Onshore":
            vendor_data[v]["onshore_resources"].add(m.resource_code)
            vendor_data[v]["onshore_demand"] += m.demand_hours
            vendor_data[v]["onshore_capacity"] += m.capacity
        else:
            vendor_data[v]["offshore_resources"].add(m.resource_code)
            vendor_data[v]["offshore_demand"] += m.demand_hours
            vendor_data[v]["offshore_capacity"] += m.capacity

    result = []
    for v, data in vendor_data.items():
        on_count = len(data["onshore_resources"])
        off_count = len(data["offshore_resources"])
        result.append({
            "vendor": v,
            "onshore_count": on_count,
            "offshore_count": off_count,
            "total_count": on_count + off_count,
            "onshore_demand": round(data["onshore_demand"], 1),
            "offshore_demand": round(data["offshore_demand"], 1),
            "total_demand": round(data["onshore_demand"] + data["offshore_demand"], 1),
            "onshore_capacity": round(data["onshore_capacity"], 1),
            "offshore_capacity": round(data["offshore_capacity"], 1),
        })

    return sorted(result, key=lambda x: x["total_demand"], reverse=True)


@router.get("/analytics/filters")
def get_filter_options(db: Session = Depends(get_db)):
    """Return distinct filter option values."""
    resources = db.query(Resource).all()
    return {
        "roles": sorted(set(r.role for r in resources if r.role)),
        "skills": sorted(set(r.primary_skill for r in resources if r.primary_skill)),
        "vendors": sorted(set(r.resource_vendor for r in resources if r.resource_vendor)),
        "managers": sorted(set(r.resource_manager for r in resources if r.resource_manager)),
        "locations": sorted(set(r.location for r in resources if r.location)),
        "areas": sorted(set(r.area for r in resources if r.area)),
        "years": sorted(set(
            m.week_year for m in db.query(WeeklyMetric.week_year).distinct().all()
            if m.week_year
        )),
    }
