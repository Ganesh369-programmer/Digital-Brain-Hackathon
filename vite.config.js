import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: "/Digital-Brain-Hackathon/"  // 👈 MUST MATCH REPO NAME EXACTLY
})