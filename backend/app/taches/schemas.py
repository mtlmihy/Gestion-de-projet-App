from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Importance = Literal["Faible", "Moyenne", "Élevée", "Critique"]


class TacheBase(BaseModel):
    nom:         str        = Field(..., min_length=1)
    description: str        = ""
    importance:  Importance = "Moyenne"
    avancement:  int        = Field(0, ge=0, le=100)
    assigne:     str        = Field(..., min_length=1)
    jalon:       str        = ""


class TacheCreate(TacheBase):
    pass


class TacheUpdate(TacheBase):
    pass


class TacheRead(TacheBase):
    id: str
    model_config = {"from_attributes": True}
