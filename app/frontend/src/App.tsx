import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ResourcesPage from './pages/ResourcesPage'
import ResourceDetail from './pages/ResourceDetail'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDetail from './pages/ProjectDetail'
import AIChat from './components/AIChat'

export default function App() {
  return (
    <>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/resources/:code" element={<ResourceDetail />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:code" element={<ProjectDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      <AIChat />
    </>
  )
}
