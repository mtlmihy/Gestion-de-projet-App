from typing import Optional
from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MeResponse(BaseModel):
    id: str
    email: str
    nom: Optional[str] = None
    poste: Optional[str] = None
    is_admin: bool
    is_active: bool
    peut_creer_projet: bool
    pages_autorisees: Optional[list[str]] = None

