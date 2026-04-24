<script setup lang="ts">
import Button from 'primevue/button'
import Message from 'primevue/message'
import Password from 'primevue/password'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const password = ref('')
const localError = ref('')

watch(
  () => auth.isAuthenticated,
  (authenticated) => {
    if (authenticated) {
      router.replace('/')
    }
  },
  { immediate: true },
)

const canSubmit = computed(() => password.value.trim().length > 0 && !auth.isSubmitting)

async function submit() {
  localError.value = ''
  try {
    await auth.login(password.value)
    router.replace('/')
  } catch {
    localError.value = auth.errorMessage || 'Mot de passe invalide.'
  }
}
</script>

<template>
  <section class="login-page">
    <div class="login-panel">
      <div class="login-copy">
        <p class="eyebrow">API + Vue 3</p>
        <h1>Reprendre le pilotage sans repasser par Streamlit.</h1>
        <p>
          Cette interface consomme directement le backend FastAPI, avec authentification par
          cookie HttpOnly et données stockées dans PostgreSQL.
        </p>
      </div>

      <form class="login-form" @submit.prevent="submit">
        <label class="field-label" for="password">Mot de passe administrateur</label>
        <Password
          id="password"
          v-model="password"
          class="w-full"
          :feedback="false"
          input-class="field-input"
          toggle-mask
        />

        <Message v-if="localError" severity="error" :closable="false">{{ localError }}</Message>

        <Button
          type="submit"
          label="Entrer dans l'application"
          icon="pi pi-arrow-right"
          icon-pos="right"
          :disabled="!canSubmit"
          :loading="auth.isSubmitting"
          class="login-submit"
        />
      </form>
    </div>
  </section>
</template>