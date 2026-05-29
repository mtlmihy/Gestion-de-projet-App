from typing import Optional
from pydantic import BaseModel, field_validator

from app.security.passwords import validate_password_policy


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


class PinnedProjectsResponse(BaseModel):
    projet_ids: list[str] = []


class PinnedProjectsUpdateRequest(BaseModel):
    projet_ids: list[str]


class ChangePasswordRequest(BaseModel):
    """Changement de mot de passe par l'utilisateur lui-même."""
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _new_password_policy(cls, v: str) -> str:
        return validate_password_policy(v)

