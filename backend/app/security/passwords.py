"""
Politique de mot de passe (validation centralisée).

Critères :
  - Longueur minimale : 12 caractères
  - Au moins 1 majuscule
  - Au moins 1 minuscule
  - Au moins 1 chiffre
  - Au moins 1 caractère spécial
  - Longueur maximale : 128 (anti-DoS bcrypt)

Réutilisé par tous les endpoints qui acceptent un mot de passe :
  - POST /users/                 (création par admin)
  - POST /users/{id}/reset-password
  - POST /auth/change-password
"""
from __future__ import annotations

import re

MIN_LENGTH = 12
MAX_LENGTH = 128

_RE_LOWER = re.compile(r"[a-z]")
_RE_UPPER = re.compile(r"[A-Z]")
_RE_DIGIT = re.compile(r"\d")
_RE_SPEC  = re.compile(r"[^A-Za-z0-9]")


def validate_password_policy(password: str) -> str:
    """Valide la politique. Lève ValueError sinon. Retourne le mdp inchangé."""
    if not isinstance(password, str):
        raise ValueError("Le mot de passe est requis.")
    if len(password) < MIN_LENGTH:
        raise ValueError(f"Le mot de passe doit faire au moins {MIN_LENGTH} caractères.")
    if len(password) > MAX_LENGTH:
        raise ValueError(f"Le mot de passe ne doit pas dépasser {MAX_LENGTH} caractères.")
    if not _RE_LOWER.search(password):
        raise ValueError("Le mot de passe doit contenir au moins une minuscule.")
    if not _RE_UPPER.search(password):
        raise ValueError("Le mot de passe doit contenir au moins une majuscule.")
    if not _RE_DIGIT.search(password):
        raise ValueError("Le mot de passe doit contenir au moins un chiffre.")
    if not _RE_SPEC.search(password):
        raise ValueError("Le mot de passe doit contenir au moins un caractère spécial.")
    return password
