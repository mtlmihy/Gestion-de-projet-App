from __future__ import annotations
from typing import List, Literal
from pydantic import BaseModel, Field

RaciRole = Literal["R", "A", "C", "I"]


class RaciMembreRead(BaseModel):
    id: str
    collaborateur: str
    poste: str = ""
    email: str = ""


class RaciTacheRead(BaseModel):
    id: str
    nom: str
    jalon: str = ""
    importance: str = ""
    statut: str = ""
    avancement: int = 0


class RaciAssignationRead(BaseModel):
    tache_id: str
    membre_id: str
    role: RaciRole


class RaciMatrixRead(BaseModel):
    membres: List[RaciMembreRead]
    taches: List[RaciTacheRead]
    assignations: List[RaciAssignationRead]


class RaciAssignationWrite(BaseModel):
    membre_id: str = Field(..., min_length=1)
    role: RaciRole


class RaciTacheAssignationsWrite(BaseModel):
    assignations: List[RaciAssignationWrite] = Field(default_factory=list)
