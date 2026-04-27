from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field


class ProjetBase(BaseModel):
    nom: str = Field(..., min_length=1)
    description: str = ""
    statut: str = "Brouillon"


class ProjetCreate(ProjetBase):
    pass


class ProjetUpdate(ProjetBase):
    pass


class ProjetRead(ProjetBase):
    id: str
    model_config = {"from_attributes": True}
