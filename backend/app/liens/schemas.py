from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field, HttpUrl, field_validator


TYPES_VALIDES = ("jira", "miro", "teams", "confluence", "github", "drive", "autre")


class LienBase(BaseModel):
    libelle: str = Field(..., min_length=1, max_length=100)
    url: str = Field(..., min_length=1)
    type: str = "autre"
    visible: bool = True
    ordre: int = 0

    @field_validator("type")
    @classmethod
    def _check_type(cls, v: str) -> str:
        if v not in TYPES_VALIDES:
            raise ValueError(f"Type invalide. Valeurs : {TYPES_VALIDES}")
        return v

    @field_validator("url")
    @classmethod
    def _check_url(cls, v: str) -> str:
        # Validation souple : doit commencer par http(s)://
        v = v.strip()
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("L'URL doit commencer par http:// ou https://")
        return v


class LienCreate(LienBase):
    pass


class LienUpdate(LienBase):
    pass


class LienVisibilite(BaseModel):
    visible: bool


class LienRead(LienBase):
    id: str
    projet_id: str
    model_config = {"from_attributes": True}
