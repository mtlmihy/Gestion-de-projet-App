from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field


class TacheBase(BaseModel):
    nom:         str           = Field(..., min_length=1)
    description: str           = ""
    importance:  str           = "Moyenne"
    avancement:  int           = Field(0, ge=0, le=100)
    assigne:     str           = ""
    jalon:       str           = ""
    statut:      str           = "A faire"
    echeance:    Optional[str] = None


class TacheCreate(TacheBase):
    pass


class TacheUpdate(TacheBase):
    pass


class TacheRead(TacheBase):
    id: str
    projet_id: str
    model_config = {"from_attributes": True}
