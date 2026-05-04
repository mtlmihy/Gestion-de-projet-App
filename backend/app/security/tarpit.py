"""
Tarpit middleware — anti-fuzzing / anti-scan.

Principe :
  - On suit le nombre de réponses 401 / 403 / 404 émises par IP sur une
    fenêtre glissante (TARPIT_WINDOW_SECONDS).
  - Au-delà de TARPIT_THRESHOLD échecs, on ralentit les *prochaines* requêtes
    de cette IP (délai exponentiel borné). On ne bannit JAMAIS — on ralentit
    seulement, ce qui rend les outils de fuzzing / scan inefficaces sans
    risque d'auto-bloquer un utilisateur légitime.
  - Une réponse 2xx / 3xx réinitialise le compteur (utilisateur légitime).
  - L'état est en mémoire (par worker uvicorn). Sur 2 workers, le tarpit est
    approximatif mais reste efficace : un attaquant frappera quand même
    régulièrement le même worker via keep-alive.

Volontairement aucun log d'IP côté client : on ne renvoie aucun indice
("Trop de requêtes", "Vous êtes ralenti", etc.). L'attaquant pense juste
que l'API est lente.
"""
from __future__ import annotations

import asyncio
import time
from collections import deque
from typing import Deque, Dict

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


# ── Réglages ──────────────────────────────────────────────────────────────────
TARPIT_WINDOW_SECONDS = 60          # fenêtre glissante
TARPIT_THRESHOLD      = 8           # nb d'échecs tolérés avant ralentissement
TARPIT_BASE_DELAY     = 0.25        # délai initial (s) au-delà du seuil
TARPIT_MAX_DELAY      = 5.0         # plafond du délai (s)
TARPIT_MAX_TRACKED    = 2048        # protection mémoire (LRU implicite)
SUSPECT_STATUSES      = {401, 403, 404}

# Chemins qui ne déclenchent jamais le tarpit (healthchecks infra).
TARPIT_EXEMPT_PATHS = {"/health"}


class _IpState:
    __slots__ = ("failures",)

    def __init__(self) -> None:
        # timestamps des échecs récents (FIFO)
        self.failures: Deque[float] = deque()


class TarpitMiddleware(BaseHTTPMiddleware):
    """Ralentit les IPs qui accumulent des 401/403/404 — anti-scan."""

    def __init__(self, app):
        super().__init__(app)
        self._ips: Dict[str, _IpState] = {}
        self._lock = asyncio.Lock()

    @staticmethod
    def _client_ip(request: Request) -> str:
        # Render / Azure injectent X-Forwarded-For. On prend la 1ʳᵉ IP
        # (l'originelle), sinon fallback sur la socket.
        xff = request.headers.get("x-forwarded-for")
        if xff:
            return xff.split(",")[0].strip()
        return request.client.host if request.client else "?"

    def _purge_old(self, state: _IpState, now: float) -> None:
        cutoff = now - TARPIT_WINDOW_SECONDS
        f = state.failures
        while f and f[0] < cutoff:
            f.popleft()

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path in TARPIT_EXEMPT_PATHS:
            return await call_next(request)

        ip  = self._client_ip(request)
        now = time.monotonic()

        # 1) Calculer le délai à appliquer AVANT de traiter la requête,
        #    en fonction du nombre d'échecs récents de cette IP.
        delay = 0.0
        state = self._ips.get(ip)
        if state is not None:
            self._purge_old(state, now)
            n = len(state.failures)
            if n >= TARPIT_THRESHOLD:
                # Délai exponentiel borné : 0.25, 0.5, 1, 2, 4, 5, 5…
                over = n - TARPIT_THRESHOLD
                delay = min(TARPIT_BASE_DELAY * (2 ** over), TARPIT_MAX_DELAY)

        if delay > 0:
            await asyncio.sleep(delay)

        # 2) Traiter la requête.
        response = await call_next(request)

        # 3) Mettre à jour le compteur en fonction du résultat.
        async with self._lock:
            if response.status_code in SUSPECT_STATUSES:
                state = self._ips.get(ip)
                if state is None:
                    # Protection mémoire : si trop d'IPs suivies, drop la plus ancienne.
                    if len(self._ips) >= TARPIT_MAX_TRACKED:
                        # purge des entrées vides + suppression LRU naïve
                        for k in list(self._ips.keys())[: TARPIT_MAX_TRACKED // 4]:
                            self._ips.pop(k, None)
                    state = _IpState()
                    self._ips[ip] = state
                state.failures.append(now)
            else:
                # Succès → réinitialise (utilisateur légitime non puni).
                if ip in self._ips:
                    self._ips.pop(ip, None)

        return response
