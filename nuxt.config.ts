// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },
  pages: true,
  modules: ["@nuxtjs/tailwindcss", "@nuxt/icon"], // Removed empty string
  nitro: {
    experimental: {
      websocket: true
    }
  },
  icon: {
    customCollections: [
      {
        prefix: "custom",
        dir: "./assets/icons"
      }
    ]
  }
});