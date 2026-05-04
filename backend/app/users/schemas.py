from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator

from app.security.passwords import validate_password_policy


class UserCreate(BaseModel):
    email: str
    nom: Optional[str] = None
    poste: Optional[str] = None
    password: str
    is_admin: bool = False
    peut_creer_projet: bool = False
    pages_autorisees: Optional[list[str]] = None

    @field_validator("password")
    @classmethod
    def _password_policy(cls, v: str) -> str:
        return validate_password_policy(v)


class UserUpdate(BaseModel):
    nom: Optional[str] = None
    poste: Optional[str] = None
    is_admin: bool = False
    is_active: bool = True
    peut_creer_projet: bool = False
    pages_autorisees: Optional[list[str]] = None


class UserRead(BaseModel):
    id: str
    email: str
    nom: Optional[str] = None
    poste: Optional[str] = None
    is_admin: bool
    is_active: bool
    peut_creer_projet: bool
    pages_autorisees: Optional[list[str]] = None
    derniere_connexion: Optional[datetime] = None
    model_config = {"from_attributes": True}


class UserPublic(BaseModel):
    """Infos minimales exposées à tout utilisateur connecté (pas de données sensibles)."""
    id: str
    email: str
    nom: Optional[str] = None
    poste: Optional[str] = None
    model_config = {"from_attributes": True}


class ResetPasswordRequest(BaseModel):
    password: str

    @field_validator("password")
    @classmethod
    def _password_policy(cls, v: str) -> str:
        return validate_password_policy(v)
