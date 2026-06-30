from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field


class TacheBase(BaseModel):
    nom:          str            = Field(..., min_length=1, max_length=200)
    description:  str            = Field("", max_length=5000)
    importance:   str            = Field("Moyenne", max_length=50)
    avancement:   int            = Field(0, ge=0, le=100)
    assigne:      str            = Field("", max_length=200)
    jalon:        str            = Field("", max_length=200)
    statut:       str            = Field("A faire", max_length=50)
    echeance:     Optional[str]  = None
    charge_jours: Optional[float] = Field(None, ge=0)


class TacheCreate(TacheBase):
    pass


class TacheUpdate(TacheBase):
    pass


class TacheRead(TacheBase):
    id: str
    projet_id: str
    model_config = {"from_attributes": True}
