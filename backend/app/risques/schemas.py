from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field

Probabilite = Literal["Faible", "Moyenne", "Élevée"]
Impact      = Literal["Faible", "Moyen", "Élevé"]
Statut      = Literal["Ouvert", "En cours", "Fermé"]
Priorite    = Literal[1, 2, 3]


class RisqueBase(BaseModel):
    nom:         str        = Field(..., min_length=1, max_length=200)
    description: str        = Field("", max_length=5000)
    categorie:   str        = Field("", max_length=100)
    probabilite: Probabilite = "Faible"
    impact:      Impact      = "Faible"
    priorite:    Priorite    = 1
    responsable: str        = Field("", max_length=200)
    attenuation: str        = Field("", max_length=5000)
    statut:      Statut      = "Ouvert"


class RisqueCreate(RisqueBase):
    pass


class RisqueUpdate(RisqueBase):
    pass


class RisqueRead(RisqueBase):
    id: str
    projet_id: str
    model_config = {"from_attributes": True}
