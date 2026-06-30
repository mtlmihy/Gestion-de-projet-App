from __future__ import annotations
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field

# Le contenu est un document JSON sérialisé (sections, jalons...) ; la limite
# est large pour ne pas gêner un CDC complet, juste pour écarter les abus.
CDC_CONTENU_MAX_LENGTH = 200_000


class CdcRead(BaseModel):
    contenu: str = ""
    projet_id: str
    derniere_maj: Optional[datetime] = None


class CdcUpdate(BaseModel):
    contenu: str = Field("", max_length=CDC_CONTENU_MAX_LENGTH)
