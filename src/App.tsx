import { lazy, Suspense } from 'react'
import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'

const Home = lazy(() => import('@/pages/Home'))
const Learn = lazy(() => import('@/pages/Learn'))
const News = lazy(() => import('@/pages/News'))
const CategoryPage = lazy(() => import('@/pages/Category'))
const ArticlePage = lazy(() => import('@/pages/Article'))
const About = lazy(() => import('@/pages/About'))
const KnowledgeGraph = lazy(() => import('@/pages/KnowledgeGraph'))

export default function App() {
  return (
    <Router basename="/">
      <Layout>
        <Suspense fallback={<div className="grid min-h-[70vh] place-items-center text-sm text-white/35">正在连接知识节点…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/news" element={<News />} />
            <Route path="/category/:slug" element={<CategoryPage />} />
            <Route path="/article/:slug" element={<ArticlePage />} />
            <Route path="/about" element={<About />} />
            <Route path="/knowledge-graph" element={<KnowledgeGraph />} />
          </Routes>
        </Suspense>
      </Layout>
    </Router>
  )
}
