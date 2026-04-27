from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field

Probabilite = Literal["Faible", "Moyenne", "Élevée"]
Impact      = Literal["Faible", "Moyen", "Élevé"]
Statut      = Literal["Ouvert", "En cours", "Fermé"]
Priorite    = Literal[1, 2, 3]


class RisqueBase(BaseModel):
    nom:         str        = Field(..., min_length=1)
    description: str        = ""
    categorie:   str        = ""
    probabilite: Probabilite = "Faible"
    impact:      Impact      = "Faible"
    priorite:    Priorite    = 1
    responsable: str        = ""
    attenuation: str        = ""
    statut:      Statut      = "Ouvert"
    gravite:     int        = Field(1, ge=1, le=5)


class RisqueCreate(RisqueBase):
    pass


class RisqueUpdate(RisqueBase):
    pass


class RisqueRead(RisqueBase):
    id: str
    projet_id: str
    model_config = {"from_attributes": True}
