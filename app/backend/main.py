from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import os
import logging

from database import engine, SessionLocal
from models import Base
from routers import upload, resources, projects, analytics

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create DB tables
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created")

    # Auto-ingest Excel if DB is empty
    db = SessionLocal()
    try:
        from models import Resource, WeeklyMetric
        resource_count = db.query(Resource).count()
        if resource_count == 0:
            excel_path = os.environ.get(
                "EXCEL_PATH",
                os.path.abspath(os.path.join(os.path.dirname(__file__), "../../large_sample_dataset.xlsx"))
            )
            if os.path.exists(excel_path):
                logger.info(f"Auto-ingesting Excel from: {excel_path}")
                with open(excel_path, "rb") as f:
                    file_bytes = f.read()
                from routers.upload import process_excel
                summary = process_excel(file_bytes, db)
                logger.info(
                    f"Auto-ingest complete: {summary.resources_upserted} resources, "
                    f"{summary.projects_upserted} projects, "
                    f"{summary.weekly_metrics_inserted} weekly metrics"
                )
                if summary.errors:
                    logger.warning(f"Ingest errors: {summary.errors}")
            else:
                logger.warning(f"Excel file not found at: {excel_path}")
        else:
            logger.info(f"DB already has {resource_count} resources, skipping auto-ingest")
    except Exception as e:
        logger.error(f"Error during auto-ingest: {e}")
    finally:
        db.close()

    yield


app = FastAPI(
    title="Capacity Planner API",
    description="Resource Capacity, Allocation, Utilization, and Project Demand Management System",
    version="1.0.0",
    lifespan=lifespan,
)

_allowed_origins = os.environ.get("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(resources.router, prefix="/api", tags=["resources"])
app.include_router(projects.router, prefix="/api", tags=["projects"])
app.include_router(analytics.router, prefix="/api", tags=["analytics"])


@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "Capacity Planner API is running"}


# Serve React frontend static build — must be mounted LAST
_static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(_static_dir):
    app.mount("/", StaticFiles(directory=_static_dir, html=True), name="static")
    logger.info(f"Serving React frontend from {_static_dir}")
