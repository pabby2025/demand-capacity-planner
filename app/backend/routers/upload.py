from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
import pandas as pd
import io
import os
from datetime import datetime, date
from typing import List

from database import get_db
from models import Resource, Project, WeeklyMetric
from schemas import UploadSummary

router = APIRouter()

SHEET_TYPES = ["TotalAvailable", "Allocated", "CurrentAvailable", "Utilization"]


def parse_date(val):
    if val is None:
        return None
    if isinstance(val, (datetime, date)):
        return val if isinstance(val, date) else val.date()
    try:
        return pd.to_datetime(str(val)).date()
    except Exception:
        return None


def safe_float(val, default=0.0):
    try:
        if val is None or (isinstance(val, float) and pd.isna(val)):
            return default
        return float(val)
    except Exception:
        return default


def safe_int(val, default=None):
    try:
        if val is None or (isinstance(val, float) and pd.isna(val)):
            return default
        return int(val)
    except Exception:
        return default


def safe_str(val, default=None):
    if val is None:
        return default
    if isinstance(val, float) and pd.isna(val):
        return default
    return str(val).strip() if str(val).strip() else default


def safe_bool(val):
    if isinstance(val, bool):
        return val
    s = safe_str(val, "")
    return s.lower() in ("yes", "true", "1")


def ingest_dataframe(df: pd.DataFrame, sheet_name: str, db: Session, errors: List[str]):
    """Process a single sheet dataframe and upsert to DB."""
    metrics_added = 0
    resources_upserted = set()

    for _, row in df.iterrows():
        rc = safe_str(row.get("Resource Code"))
        if not rc:
            continue

        # Upsert Resource
        if rc not in resources_upserted:
            existing = db.query(Resource).filter(Resource.resource_code == rc).first()
            if not existing:
                res = Resource(
                    resource_code=rc,
                    resource_name=safe_str(row.get("Resource Name")),
                    role=safe_str(row.get("Role")),
                    primary_skill=safe_str(row.get("Primary Skill")),
                    work_location=safe_str(row.get("Work Location")),
                    resource_manager=safe_str(row.get("Resource Manager")),
                    resource_status=safe_str(row.get("Resource Status"), "ACTIVE"),
                    resource_vendor=safe_str(row.get("Resource Vendor")),
                    vendor_code=safe_str(row.get("Resource Vendor Code")),
                    location=safe_str(row.get("Location")),
                    rate=safe_float(row.get("Rate")),
                    area=safe_str(row.get("Area")),
                )
                db.add(res)
            else:
                # Update fields if needed
                existing.resource_name = safe_str(row.get("Resource Name")) or existing.resource_name
                existing.role = safe_str(row.get("Role")) or existing.role
                existing.primary_skill = safe_str(row.get("Primary Skill")) or existing.primary_skill
                existing.work_location = safe_str(row.get("Work Location")) or existing.work_location
                existing.resource_manager = safe_str(row.get("Resource Manager")) or existing.resource_manager
                existing.resource_vendor = safe_str(row.get("Resource Vendor")) or existing.resource_vendor
                existing.vendor_code = safe_str(row.get("Resource Vendor Code")) or existing.vendor_code
                existing.location = safe_str(row.get("Location")) or existing.location
                existing.rate = safe_float(row.get("Rate")) or existing.rate
                existing.area = safe_str(row.get("Area")) or existing.area
            resources_upserted.add(rc)

        # Insert WeeklyMetric
        wm = WeeklyMetric(
            demand_key=safe_str(row.get("Demand_Key")),
            resource_code=rc,
            project_category=safe_str(row.get("Category")),
            sheet_type=sheet_name,
            week_text=safe_str(row.get("Week Text")),
            week=parse_date(row.get("Week")),
            demand_hours=safe_float(row.get("Demand Hours")),
            actual_hours=safe_float(row.get("Actual Hours")),
            max_hours=safe_float(row.get("Max Hours")),
            capacity=safe_float(row.get("Capacity")),
            over_allocation=safe_bool(row.get("OverAllocation")),
            over_allocated_hours=safe_float(row.get("Over Allocated Hours")),
            week_year=safe_int(row.get("Week Year")),
            week_quarter=safe_int(row.get("Week Quarter")),
            week_month=safe_str(row.get("Week Month")),
            week_month_index=safe_int(row.get("Week Month Index")),
            demand_dollar_rate=safe_float(row.get("Demand Dollar Rate")),
            actual_dollar_rate=safe_float(row.get("Actual Dollar Rate")),
            availability_dollar=safe_float(row.get("Availability Dollar")),
            max_capacity_dollar=safe_float(row.get("Max Capacity Dollar")),
            technology=safe_str(row.get("Technology")),
            resource_type=safe_str(row.get("Type")),
            area=safe_str(row.get("Area")),
        )
        db.add(wm)
        metrics_added += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        errors.append(f"Error committing {sheet_name}: {str(e)}")
        metrics_added = 0

    return metrics_added, len(resources_upserted)


def process_excel(file_bytes: bytes, db: Session) -> UploadSummary:
    errors = []
    total_resources = 0
    total_metrics = 0
    sheets_processed = []

    # Delete existing weekly metrics to allow re-ingestion
    db.query(WeeklyMetric).delete()
    db.commit()

    try:
        xl = pd.ExcelFile(io.BytesIO(file_bytes))

        # Process ProjectList
        if "ProjectList" in xl.sheet_names:
            proj_df = xl.parse("ProjectList")
            for _, row in proj_df.iterrows():
                pc = safe_str(row.get("Project Code"))
                if not pc:
                    continue
                existing = db.query(Project).filter(Project.project_code == pc).first()
                if not existing:
                    proj = Project(
                        project_code=pc,
                        project_name=safe_str(row.get("Project Name")),
                        category=safe_str(row.get("Category")),
                    )
                    db.add(proj)
                else:
                    existing.project_name = safe_str(row.get("Project Name")) or existing.project_name
                    existing.category = safe_str(row.get("Category")) or existing.category
            db.commit()
            sheets_processed.append("ProjectList")

        # Process data sheets
        for sheet_name in SHEET_TYPES:
            if sheet_name in xl.sheet_names:
                df = xl.parse(sheet_name)
                metrics, resources = ingest_dataframe(df, sheet_name, db, errors)
                total_metrics += metrics
                total_resources = max(total_resources, resources)
                sheets_processed.append(sheet_name)

    except Exception as e:
        errors.append(f"Excel parse error: {str(e)}")

    # Count actual resources in DB
    db_resource_count = db.query(Resource).count()
    db_project_count = db.query(Project).count()

    return UploadSummary(
        resources_upserted=db_resource_count,
        projects_upserted=db_project_count,
        weekly_metrics_inserted=total_metrics,
        sheets_processed=sheets_processed,
        errors=errors,
    )


@router.post("/upload", response_model=UploadSummary)
async def upload_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported")

    content = await file.read()
    return process_excel(content, db)
