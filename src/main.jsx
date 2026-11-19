import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import SurveyApp from './survey/SurveyApp.jsx'
import AdminApp from './admin/AdminApp.jsx'
import './survey/survey.css'

// 해시 라우팅 — 서버 설정 없이 어디에 배포해도 동작
//   #/survey      사용성 평가 (평가자)
//   #/admin       관리자 모드
//   그 외          PuzzleGen Dental PoC 데모
const parse = () => {
  const h = window.location.hash.replace(/^#\/?/, '')
  const [page, id] = h.split('/')
  return { page, id: Number(id) || null }
}

function Router() {
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const on = () => setRoute(parse())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  useEffect(() => {
    document.title = route.page === 'survey' ? 'PuzzleGen Dental 사용성 평가' : route.page === 'admin' ? '사용성 평가 관리자' : 'Puzzle Gen Dental'
  }, [route.page])
  if (route.page === 'survey') return <SurveyApp key="survey" />
  if (route.page === 'admin') return <AdminApp />
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
)
