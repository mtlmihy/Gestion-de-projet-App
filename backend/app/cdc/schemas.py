from __future__ import annotations
from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class CdcRead(BaseModel):
    contenu: str = ""
    projet_id: str
    derniere_maj: Optional[datetime] = None


class CdcUpdate(BaseModel):
    contenu: str = ""
