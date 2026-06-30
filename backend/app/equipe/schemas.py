from __future__ import annotations
from pydantic import BaseModel, Field


class MembreBase(BaseModel):
    collaborateur: str = Field(..., min_length=1, max_length=200)
    poste:   str = Field("", max_length=200)
    manager: str = Field("", max_length=200)
    numero:  str = Field("", max_length=50)
    email:   str = Field("", max_length=254)


class MembreCreate(MembreBase):
    pass


class MembreUpdate(MembreBase):
    pass


class MembreRead(MembreBase):
    id: str
    projet_id: str
    model_config = {"from_attributes": True}
