import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore(
  'user',
  () => {
    const user = ref({
      name: '',
      first_name: '',
      last_name: '',
      neigborhood: '',
      address: '',
      phone_number: '',
      payment_method_option: '',
    })

    // getter "a mano"
    function fucion() {
      return 0
    }

    // helpers útiles
    function setUser(partial) {
      user.value = {
        ...user.value,
        ...partial,
      }
    }

    function resetUser() {
      user.value = {
        name: '',
        first_name: '',
        last_name: '',
        neigborhood: '',
        address: '',
        phone_number: '',
        payment_method_option: '',
      }
    }

    /** Cierra la sesión de admin: elimina token, inserted_by e iframe para que la persistencia se actualice. */
    function clearSession() {
      const { token, inserted_by, iframe, ...rest } = user.value
      user.value = { ...rest }
    }

    return {
      user,
      fucion,
      setUser,
      resetUser,
      clearSession,
    }
  },
  {
    // persistencia al estilo pinia-plugin-persistedstate
    persist: {
      key: 'user',
      paths: ['user'],
      // si usas @pinia-plugin-persistedstate/nuxt puedes agregar:
      // storage: persistedState.localStorage,
    },
  },
)
