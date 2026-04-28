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


class ProjetStatutUpdate(BaseModel):
    statut: str


class ProjetRead(ProjetBase):
    id: str
    mon_role: Optional[str] = None
    est_cloture: bool = False
    model_config = {"from_attributes": True}


# ── Membres du projet ─────────────────────────────────────────────────────────

ROLES_VALIDES = ("Proprietaire", "Editeur", "Lecteur", "Client_Limite")


class MembreCreate(BaseModel):
    user_id: str
    role: str = "Lecteur"

    def validate_role(self) -> "MembreCreate":
        if self.role not in ROLES_VALIDES:
            raise ValueError(f"Rôle invalide. Valeurs : {ROLES_VALIDES}")
        return self


class MembreUpdate(BaseModel):
    role: str


class MembreRead(BaseModel):
    user_id: str
    email: str
    nom: Optional[str] = None
    poste: Optional[str] = None
    role: Optional[str] = None
    role: str
