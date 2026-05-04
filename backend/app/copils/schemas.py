from __future__ import annotations
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class CopilCreate(BaseModel):
    date_reunion: date
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
    titre: str
    participants: Optional[str] = None
    notes: Optional[str] = None
    decisions: Optional[str] = None
    actions: Optional[str] = None
    createur_id: Optional[str] = None
    date_creation: datetime
    derniere_maj: datetime

    model_config = {"from_attributes": True}
