<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import ProgressBar from 'primevue/progressbar'
import Tag from 'primevue/tag'
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'

import AppShell from '../components/layout/AppShell.vue'
import { fetchCdcVersion, fetchEquipe, fetchHealth, fetchRisques, fetchTaches } from '../lib/api'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

watch(
  () => [auth.isBootstrapping, auth.isAuthenticated],
  ([bootstrapping, authenticated]) => {
    if (!bootstrapping && !authenticated) {
      router.replace('/login')
    }
  },
  { immediate: true },
)

const queryEnabled = computed(() => auth.isAuthenticated)

const risquesQuery = useQuery({
  queryKey: ['risques'],
  queryFn: fetchRisques,
  enabled: queryEnabled,
})

const tachesQuery = useQuery({
  queryKey: ['taches'],
  queryFn: fetchTaches,
  enabled: queryEnabled,
})

const equipeQuery = useQuery({
  queryKey: ['equipe'],
  queryFn: fetchEquipe,
  enabled: queryEnabled,
})

const cdcVersionQuery = useQuery({
  queryKey: ['cdc-version'],
  queryFn: fetchCdcVersion,
  enabled: queryEnabled,
})

const healthQuery = useQuery({
  queryKey: ['health'],
  queryFn: fetchHealth,
})

const risques = computed(() => risquesQuery.data.value ?? [])
const taches = computed(() => tachesQuery.data.value ?? [])
const equipe = computed(() => equipeQuery.data.value ?? [])

const openRisques = computed(() => risques.value.filter((risque) => risque.statut !== 'Fermé').length)
const progressAverage = computed(() => {
  if (taches.value.length === 0) {
    return 0
  }
  const total = taches.value.reduce((sum, tache) => sum + tache.avancement, 0)
  return Math.round(total / taches.value.length)
})

function refreshAll() {
  risquesQuery.refetch()
  tachesQuery.refetch()
  equipeQuery.refetch()
  cdcVersionQuery.refetch()
  healthQuery.refetch()
}

async function handleLogout() {
  await auth.logout()
  router.replace('/login')
}

function riskSeverity(statut: string) {
  if (statut === 'Fermé') return 'success'
  if (statut === 'En cours') return 'warn'
  return 'danger'
}

function taskSeverity(importance: string) {
  if (importance === 'Critique') return 'danger'
  if (importance === 'Élevée') return 'warn'
  if (importance === 'Moyenne') return 'info'
  return 'contrast'
}
</script>

<template>
  <section v-if="auth.isBootstrapping" class="loading-screen">
    <div class="loading-card">
      <span class="pi pi-spin pi-spinner loading-icon" />
      <p>Validation de la session en cours…</p>
    </div>
  </section>

  <AppShell
    v-else-if="auth.isAuthenticated"
    subtitle="Lecture rapide de l'API FastAPI avant de construire les écrans métier complets."
    :on-refresh="refreshAll"
    :on-logout="handleLogout"
  >
    <div class="hero-grid">
      <article class="metric-card accent-sand">
        <span class="metric-label">API</span>
        <strong>{{ healthQuery.data?.status ?? '...' }}</strong>
        <p>Backend FastAPI relié à PostgreSQL.</p>
      </article>
      <article class="metric-card accent-clay">
        <span class="metric-label">Risques ouverts</span>
        <strong>{{ openRisques }}</strong>
        <p>{{ risques.length }} risques chargés.</p>
      </article>
      <article class="metric-card accent-ink">
        <span class="metric-label">Avancement moyen</span>
        <strong>{{ progressAverage }}%</strong>
        <p>{{ taches.length }} tâches suivies.</p>
      </article>
      <article class="metric-card accent-mint">
        <span class="metric-label">CDC</span>
        <strong>{{ cdcVersionQuery.data?.hash ?? 'indisponible' }}</strong>
        <p>Hash de version pour synchronisation.</p>
      </article>
    </div>

    <div class="dashboard-grid">
      <section class="panel-card">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Registre des risques</p>
            <h2>Vue opérationnelle</h2>
          </div>
        </div>

        <DataTable :value="risques" striped-rows paginator :rows="5" responsive-layout="scroll">
          <Column field="identifiant" header="ID" />
          <Column field="description" header="Description" />
          <Column field="responsable" header="Responsable" />
          <Column field="statut" header="Statut">
            <template #body="slotProps">
              <Tag :value="slotProps.data.statut" :severity="riskSeverity(slotProps.data.statut)" />
            </template>
          </Column>
        </DataTable>
      </section>

      <section class="panel-card">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Tâches</p>
            <h2>Exécution</h2>
          </div>
        </div>

        <DataTable :value="taches" striped-rows paginator :rows="5" responsive-layout="scroll">
          <Column field="nom" header="Tâche" />
          <Column field="assigne" header="Assigné" />
          <Column field="importance" header="Importance">
            <template #body="slotProps">
              <Tag :value="slotProps.data.importance" :severity="taskSeverity(slotProps.data.importance)" />
            </template>
          </Column>
          <Column field="avancement" header="Avancement">
            <template #body="slotProps">
              <ProgressBar :value="slotProps.data.avancement" :show-value="true" />
            </template>
          </Column>
        </DataTable>
      </section>

      <section class="panel-card panel-card-wide">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Équipe</p>
            <h2>Capacité mobilisée</h2>
          </div>
          <Button :label="`${equipe.length} membres`" severity="secondary" outlined disabled />
        </div>

        <DataTable :value="equipe" striped-rows paginator :rows="8" responsive-layout="scroll">
          <Column field="collaborateur" header="Collaborateur" />
          <Column field="poste" header="Poste" />
          <Column field="manager" header="Manager" />
          <Column field="email" header="Email" />
        </DataTable>
      </section>
    </div>
  </AppShell>
</template>