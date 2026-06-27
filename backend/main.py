import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Index,
    String,
    create_engine,
    text,
)
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, declarative_base, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set.\n"
        "Set it before starting the app, for example:\n"
        "  export DATABASE_URL='postgresql://user:password@host:5432/simplenotes'\n"
        "On Railway: add a PostgreSQL service and reference its DATABASE_URL variable\n"
        "in the backend service (e.g. DATABASE_URL=${{Postgres.DATABASE_URL}})."
    )

# Railway/Heroku expose 'postgres://', which SQLAlchemy 2.x does not accept.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

IS_SQLITE = DATABASE_URL.startswith("sqlite")

if IS_SQLITE:
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
    )
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_size=int(os.getenv("DB_POOL_SIZE", "5")),
        max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "10")),
        pool_recycle=int(os.getenv("DB_POOL_RECYCLE", "1800")),
        pool_timeout=int(os.getenv("DB_POOL_TIMEOUT", "30")),
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_uuid() -> str:
    return str(uuid.uuid4())


class Note(Base):
    __tablename__ = "notes"

    id = Column(String, primary_key=True, default=_new_uuid)
    title = Column(String, nullable=False, default="")
    content = Column(String, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )
    is_deleted = Column(Boolean, nullable=False, default=False)
    user_id = Column(String, nullable=False, default="default_user")
    photo = Column(String, nullable=True)

    __table_args__ = (
        Index("ix_notes_user_id", "user_id"),
        Index("ix_notes_created_at", "created_at"),
    )


class NoteBase(BaseModel):
    title: str = Field(default="", max_length=512)
    content: str = Field(default="")
    photo: Optional[str] = None


class NoteCreate(NoteBase):
    user_id: str = Field(default="default_user", max_length=255)


class NoteUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=512)
    content: Optional[str] = None
    photo: Optional[str] = None
    is_deleted: Optional[bool] = None


class NoteResponse(NoteBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime
    is_deleted: bool
    user_id: str


class SyncNote(BaseModel):
    id: Optional[str] = None
    title: str = Field(default="", max_length=512)
    content: str = Field(default="")
    photo: Optional[str] = None
    is_deleted: bool = False
    user_id: str = Field(default="default_user", max_length=255)
    updated_at: Optional[datetime] = None


class SyncRequest(BaseModel):
    notes: List[SyncNote] = Field(default_factory=list)


class SyncResult(BaseModel):
    created: int
    updated: int
    skipped: int
    notes: List[NoteResponse]


Base.metadata.create_all(bind=engine)


def _ensure_schema():
    # create_all() only creates missing tables, not missing columns. The 'photo'
    # column was added after the table already existed on Railway, so add it here.
    if IS_SQLITE:
        return
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE notes ADD COLUMN IF NOT EXISTS photo VARCHAR"))
    except SQLAlchemyError as exc:
        print(f"[schema] could not ensure 'photo' column: {exc}")


_ensure_schema()

app = FastAPI(title="SimpleNotes API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_active_note(db: Session, note_id: str) -> Note:
    note = db.query(Note).filter(Note.id == note_id, Note.is_deleted.is_(False)).first()
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return note


@app.get("/")
async def root():
    return {"status": "ok", "service": "SimpleNotes API", "version": "1.0.0"}


@app.get("/health")
async def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        )


@app.get("/notes", response_model=List[NoteResponse])
async def list_notes(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    try:
        return (
            db.query(Note)
            .filter(Note.is_deleted.is_(False))
            .order_by(Note.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list notes",
        )


@app.get("/notes/{note_id}", response_model=NoteResponse)
async def get_note(note_id: str, db: Session = Depends(get_db)):
    return _get_active_note(db, note_id)


@app.post("/notes", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(payload: NoteCreate, db: Session = Depends(get_db)):
    try:
        note = Note(
            title=payload.title,
            content=payload.content,
            photo=payload.photo,
            user_id=payload.user_id,
        )
        db.add(note)
        db.commit()
        db.refresh(note)
        return note
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create note",
        )


@app.put("/notes/{note_id}", response_model=NoteResponse)
async def update_note(note_id: str, payload: NoteUpdate, db: Session = Depends(get_db)):
    note = _get_active_note(db, note_id)
    data = payload.model_dump(exclude_unset=True)
    try:
        for field, value in data.items():
            setattr(note, field, value)
        db.commit()
        db.refresh(note)
        return note
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update note",
        )


@app.delete("/notes/{note_id}", status_code=status.HTTP_200_OK)
async def delete_note(note_id: str, db: Session = Depends(get_db)):
    note = _get_active_note(db, note_id)
    try:
        note.is_deleted = True
        db.commit()
        return {"status": "deleted", "id": note_id}
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete note",
        )


def _reconcile_note(db: Session, incoming: SyncNote) -> str:
    existing = None
    if incoming.id:
        existing = db.query(Note).filter(Note.id == incoming.id).first()

    if existing is None:
        note = Note(
            title=incoming.title,
            content=incoming.content,
            photo=incoming.photo,
            is_deleted=incoming.is_deleted,
            user_id=incoming.user_id,
        )
        if incoming.id:
            note.id = incoming.id
        db.add(note)
        return "created"

    if incoming.updated_at is not None and existing.updated_at is not None:
        existing_ts = existing.updated_at
        if existing_ts.tzinfo is None:
            existing_ts = existing_ts.replace(tzinfo=timezone.utc)
        incoming_ts = incoming.updated_at
        if incoming_ts.tzinfo is None:
            incoming_ts = incoming_ts.replace(tzinfo=timezone.utc)
        if incoming_ts <= existing_ts:
            return "skipped"

    existing.title = incoming.title
    existing.content = incoming.content
    existing.photo = incoming.photo
    existing.is_deleted = incoming.is_deleted
    existing.user_id = incoming.user_id
    return "updated"


@app.post("/sync", response_model=SyncResult)
async def sync_notes(payload: SyncRequest, db: Session = Depends(get_db)):
    counters = {"created": 0, "updated": 0, "skipped": 0}
    try:
        for incoming in payload.notes:
            counters[_reconcile_note(db, incoming)] += 1
        db.commit()
        notes = (
            db.query(Note)
            .filter(Note.is_deleted.is_(False))
            .order_by(Note.created_at.desc())
            .all()
        )
        return SyncResult(notes=notes, **counters)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to sync notes",
        )
