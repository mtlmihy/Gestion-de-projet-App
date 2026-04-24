export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export interface Risque {
  id: string
  identifiant: string
  description: string
  categorie: string
  probabilite: 'Faible' | 'Moyenne' | 'Élevée'
  impact: 'Faible' | 'Moyen' | 'Élevé'
  priorite: 1 | 2 | 3
  responsable: string
  attenuation: string
  statut: 'Ouvert' | 'En cours' | 'Fermé'
}

export interface Tache {
  id: string
  nom: string
  description: string
  importance: 'Faible' | 'Moyenne' | 'Élevée' | 'Critique'
  avancement: number
  assigne: string
  jalon: string
}

export interface Membre {
  id: string
  collaborateur: string
  poste: string
  manager: string
  numero: string
  email: string
}

export interface CdcVersion {
  hash: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    let message = `Erreur API (${response.status})`
    try {
      const body = await response.json()
      message = body.detail ?? message
    } catch {
      // garde le message générique
    }
    throw new ApiError(message, response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export function login(password: string) {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

export function logout() {
  return apiFetch<void>('/auth/logout', {
    method: 'POST',
  })
}

export function fetchRisques() {
  return apiFetch<Risque[]>('/risques/')
}

export function fetchTaches() {
  return apiFetch<Tache[]>('/taches/')
}

export function fetchEquipe() {
  return apiFetch<Membre[]>('/equipe/')
}

export function fetchCdcVersion() {
  return apiFetch<CdcVersion>('/cdc/version')
}

export function fetchHealth() {
  return apiFetch<{ status: string }>('/health')
}