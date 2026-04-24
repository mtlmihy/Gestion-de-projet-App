import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { ApiError, fetchRisques, login as loginRequest, logout as logoutRequest } from '../lib/api'

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false)
  const isBootstrapping = ref(true)
  const isSubmitting = ref(false)
  const bootstrapped = ref(false)
  const errorMessage = ref('')

  async function restoreSession() {
    if (bootstrapped.value) {
      isBootstrapping.value = false
      return
    }

    try {
      await fetchRisques()
      isAuthenticated.value = true
      errorMessage.value = ''
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        console.error(error)
      }
      isAuthenticated.value = false
    } finally {
      bootstrapped.value = true
      isBootstrapping.value = false
    }
  }

  async function login(password: string) {
    isSubmitting.value = true
    errorMessage.value = ''
    try {
      await loginRequest(password)
      isAuthenticated.value = true
    } catch (error) {
      isAuthenticated.value = false
      errorMessage.value = error instanceof Error ? error.message : 'Connexion impossible.'
      throw error
    } finally {
      isSubmitting.value = false
    }
  }

  async function logout() {
    try {
      await logoutRequest()
    } finally {
      isAuthenticated.value = false
      errorMessage.value = ''
    }
  }

  return {
    errorMessage,
    isAuthenticated: computed(() => isAuthenticated.value),
    isBootstrapping: computed(() => isBootstrapping.value),
    isSubmitting: computed(() => isSubmitting.value),
    login,
    logout,
    restoreSession,
  }
})