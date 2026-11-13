import {defineConfig} from '@playwright/test'

export default defineConfig({
  workers: 1,
  use: {baseURL: 'http://127.0.0.1:4173', locale: 'en-US', viewport: {width: 1536, height: 1024}, trace: 'retain-on-failure'},
  webServer: {command: 'npm run build && npm exec -- vite preview --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI},
})
