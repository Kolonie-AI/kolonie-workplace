import { createApp, type App as VueApp } from 'vue'
import App from '@/App.vue'

export function mountWorkplace(selector: string): VueApp<Element> {
  const target = document.querySelector(selector)

  if (target === null) {
    throw new Error(`Kolonie Workplace: mount target "${selector}" was not found.`)
  }

  const app = createApp(App)
  app.mount(target)

  return app
}
