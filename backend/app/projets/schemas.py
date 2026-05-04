from __future__ import annotations
from typing import List, Optional
from pydantic import BaseModel, Field


class ProjetBase(BaseModel):
    nom: str = Field(..., min_length=1)
    description: str = ""
    statut: str = "Brouillon"
    type_projet: str = "Interne"
    budget_prevu: Optional[float] = None


class ProjetCreate(ProjetBase):
    pass


class ProjetUpdate(ProjetBase):
    pass


class ProjetStatutUpdate(BaseModel):
    statut: str


class ProjetRead(ProjetBase):
    id: str
    mon_role: Optional[str] = None
    mes_pages: Optional[List[str]] = None
    pages_visibles: Optional[List[str]] = None
    est_cloture: bool = False
    model_config = {"from_attributes": True}


class ProjetPagesUpdate(BaseModel):
    pages_visibles: Optional[List[str]] = None


class ProjetSettingsUpdate(BaseModel):
    type_projet: str
    budget_prevu: Optional[float] = None


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


class MembrePagesUpdate(BaseModel):
    pages_autorisees: Optional[List[str]] = None


class MembreRead(BaseModel):
    user_id: str
    email: str
    nom: Optional[str] = None
    poste: Optional[str] = None
    role: str
    pages_autorisees: Optional[List[str]] = None
