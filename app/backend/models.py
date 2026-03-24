from sqlalchemy import Column, Integer, String, Float, Boolean, Date, ForeignKey, Index
from sqlalchemy.orm import relationship
from database import Base


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True)
    resource_code = Column(String, unique=True, index=True, nullable=False)
    resource_name = Column(String)
    role = Column(String)
    primary_skill = Column(String)
    work_location = Column(String)
    resource_manager = Column(String)
    resource_status = Column(String, default="ACTIVE")
    resource_vendor = Column(String)
    vendor_code = Column(String)
    location = Column(String)
    rate = Column(Float, default=0.0)
    area = Column(String)

    weekly_metrics = relationship("WeeklyMetric", back_populates="resource", lazy="dynamic")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    project_code = Column(String, unique=True, index=True, nullable=False)
    project_name = Column(String)
    category = Column(String)


class WeeklyMetric(Base):
    __tablename__ = "weekly_metrics"

    id = Column(Integer, primary_key=True, index=True)
    demand_key = Column(String, index=True)
    resource_code = Column(String, ForeignKey("resources.resource_code"), index=True)
    project_category = Column(String)
    sheet_type = Column(String, index=True)  # TotalAvailable, Allocated, CurrentAvailable, Utilization
    week_text = Column(String)
    week = Column(Date, index=True)
    demand_hours = Column(Float, default=0.0)
    actual_hours = Column(Float, default=0.0)
    max_hours = Column(Float, default=0.0)
    capacity = Column(Float, default=0.0)
    over_allocation = Column(Boolean, default=False)
    over_allocated_hours = Column(Float, default=0.0)
    week_year = Column(Integer)
    week_quarter = Column(Integer)
    week_month = Column(String)
    week_month_index = Column(Integer)
    demand_dollar_rate = Column(Float, default=0.0)
    actual_dollar_rate = Column(Float, default=0.0)
    availability_dollar = Column(Float, default=0.0)
    max_capacity_dollar = Column(Float, default=0.0)
    technology = Column(String)
    resource_type = Column(String)
    area = Column(String)

    resource = relationship("Resource", back_populates="weekly_metrics")

    __table_args__ = (
        Index("ix_wm_resource_sheet", "resource_code", "sheet_type"),
        Index("ix_wm_week_sheet", "week", "sheet_type"),
    )
