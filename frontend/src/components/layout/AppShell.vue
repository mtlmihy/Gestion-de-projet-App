<script setup lang="ts">
import Button from 'primevue/button'

defineProps<{
  subtitle?: string
  onRefresh?: () => void
  onLogout?: () => void
}>()
</script>

<template>
  <div class="shell">
    <header class="shell-header">
      <div>
        <p class="eyebrow">Pilotage projet</p>
        <h1>GouvernanceXGuide CDP</h1>
        <p class="shell-subtitle">{{ subtitle }}</p>
      </div>
      <div class="shell-actions">
        <Button label="Rafraîchir" icon="pi pi-refresh" severity="secondary" outlined @click="onRefresh?.()" />
        <Button label="Déconnexion" icon="pi pi-sign-out" severity="contrast" @click="onLogout?.()" />
      </div>
    </header>

    <main class="shell-content">
      <slot />
    </main>
  </div>
</template>