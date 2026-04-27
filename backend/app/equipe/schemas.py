from __future__ import annotations
from pydantic import BaseModel, Field


class MembreBase(BaseModel):
    collaborateur: str = Field(..., min_length=1)
    poste:   str = ""
    manager: str = ""
    numero:  str = ""
    email:   str = ""


class MembreCreate(MembreBase):
    pass


class MembreUpdate(MembreBase):
    pass


class MembreRead(MembreBase):
    id: str
    projet_id: str
    model_config = {"from_attributes": True}
