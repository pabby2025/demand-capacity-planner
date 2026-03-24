from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

_DATABASE_URL = os.environ.get("DATABASE_URL")

if _DATABASE_URL:
    # Azure PostgreSQL uses "postgres://" prefix; SQLAlchemy needs "postgresql://"
    if _DATABASE_URL.startswith("postgres://"):
        _DATABASE_URL = _DATABASE_URL.replace("postgres://", "postgresql://", 1)
    engine = create_engine(_DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=10)
else:
    # Local SQLite fallback
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    _DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'capacity_planner.db')}"
    engine = create_engine(
        _DATABASE_URL,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
