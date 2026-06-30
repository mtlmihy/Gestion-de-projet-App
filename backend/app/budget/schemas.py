from __future__ import annotations
from datetime import date, datetime
from pydantic import BaseModel, Field
from typing import Optional

CATEGORIES = ('Prestation', 'Matériel', 'Déplacement', 'Formation', 'Sous-traitance', 'Autre')


class DepenseCreate(BaseModel):
    date: date
    categorie: str = Field('Autre', max_length=100)
    description: str = Field('', max_length=2000)
    montant: float = Field(..., ge=0)
    assigne: Optional[str] = Field(None, max_length=200)


class DepenseUpdate(DepenseCreate):
    pass


class DepenseRead(DepenseCreate):
    id: str
    projet_id: str
    date_creation: datetime
    model_config = {'from_attributes': True}
