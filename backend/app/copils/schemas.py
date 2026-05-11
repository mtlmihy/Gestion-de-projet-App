from __future__ import annotations
from datetime import date, datetime, time
from typing import Optional

from pydantic import BaseModel, Field


class CopilCreate(BaseModel):
    date_reunion: date
    heure_reunion: Optional[time] = None
    titre: str = Field(..., min_length=3, max_length=200)
    participants: Optional[str] = None
    notes: Optional[str] = None
    decisions: Optional[str] = None
    actions: Optional[str] = None


class CopilUpdate(CopilCreate):
    pass


class CopilRead(BaseModel):
    id: str
    projet_id: str
    date_reunion: date
    heure_reunion: Optional[time] = None
    titre: str
    participants: Optional[str] = None
    notes: Optional[str] = None
    decisions: Optional[str] = None
    actions: Optional[str] = None
    createur_id: Optional[str] = None
    date_creation: datetime
    derniere_maj: datetime

    model_config = {"from_attributes": True}


class CopilNoteCreate(BaseModel):
    contenu: str = Field(..., min_length=1, max_length=5000)


class CopilNoteUpdate(CopilNoteCreate):
    pass


class CopilNoteRead(BaseModel):
    id: str
    copil_id: str
    auteur_id: Optional[str] = None
    contenu: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
