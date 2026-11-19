import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { createSurveyApi } from './server/surveyApi.mjs'

// npm run dev / npm run preview 에서도 /api/survey 저장 API가 동작하도록 연결
const surveyApiPlugin = () => {
  const api = createSurveyApi({
    dataDir: process.env.SURVEY_DATA_DIR || path.resolve('data'),
    adminPin: process.env.SURVEY_ADMIN_PIN || '1234',
  })
  const mount = (server) => server.middlewares.use('/api/survey', (req, res) => {
    req.url = '/api/survey' + (req.url === '/' ? '' : req.url)
    api(req, res)
  })
  return { name: 'survey-api', configureServer: mount, configurePreviewServer: mount }
}

export default defineConfig({
  plugins: [react(), surveyApiPlugin()],
})
