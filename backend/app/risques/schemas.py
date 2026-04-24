from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Probabilite = Literal["Faible", "Moyenne", "Élevée"]
Impact      = Literal["Faible", "Moyen", "Élevé"]
Statut      = Literal["Ouvert", "En cours", "Fermé"]
Priorite    = Literal[1, 2, 3]


class RisqueBase(BaseModel):
    identifiant: str    = Field(..., min_length=1)
    description: str    = ""
    categorie:   str    = ""
    probabilite: Probabilite = "Faible"
    impact:      Impact      = "Faible"
    priorite:    Priorite    = 1
    responsable: str    = Field(..., min_length=1)
    attenuation: str    = ""
    statut:      Statut      = "Ouvert"


class RisqueCreate(RisqueBase):
    """Corps de la requête POST /risques."""
    pass


class RisqueUpdate(RisqueBase):
    """Corps de la requête PUT /risques/{id}."""
    pass


class RisqueRead(RisqueBase):
    """Réponse retournée par l'API."""
    id: str
    model_config = {"from_attributes": True}
