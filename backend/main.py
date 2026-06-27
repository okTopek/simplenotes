from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import Note
from schemas import (
    NoteCreate,
    NoteResponse,
    NoteUpdate,
    SyncNote,
    SyncRequest,
    SyncResult,
)

Base.metadata.create_all(bind=engine)

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


@app.get("/notes", response_model=list[NoteResponse])
async def list_notes(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    try:
        notes = (
            db.query(Note)
            .filter(Note.is_deleted.is_(False))
            .order_by(Note.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        return notes
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
    existing.is_deleted = incoming.is_deleted
    existing.user_id = incoming.user_id
    return "updated"


@app.post("/sync", response_model=SyncResult)
async def sync_notes(payload: SyncRequest, db: Session = Depends(get_db)):
    counters = {"created": 0, "updated": 0, "skipped": 0}
    try:
        for incoming in payload.notes:
            outcome = _reconcile_note(db, incoming)
            counters[outcome] += 1
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