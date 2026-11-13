import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

const devPolicy = {
  name: 'margin-development-policy',
  apply: 'serve',
  transformIndexHtml: html => html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'"),
}

export default defineConfig({
  base: './',
  plugins: [devPolicy, react()],
  build: {license: {fileName: 'THIRD-PARTY.md'}},
})
