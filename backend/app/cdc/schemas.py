from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel


class CdcRead(BaseModel):
    """Réponse GET /cdc — retourne le JSON complet du CDC + date de mise à jour."""
    data:       Dict[str, Any]
    updated_at: Optional[datetime] = None


class CdcUpdate(BaseModel):
    """Corps PUT /cdc — le JSON complet du CDC tel que sérialisé par le frontend."""
    data: Dict[str, Any]


class CdcVersion(BaseModel):
    """Réponse GET /cdc/version — hash court pour détecter les changements."""
    hash: str
