import { lazy, Suspense } from 'react'
import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import moeRouting from '../config/moe-routing.json'
import MoeRoutingBoundary from '@/components/MoeRoutingBoundary'
import tokenJourney from '../config/token-journey.json'
import TokenJourneyBoundary from '@/components/TokenJourneyBoundary'
import communicationTopology from '../config/communication-topology.json'
import CommunicationTopologyBoundary from '@/components/CommunicationTopologyBoundary'

const Home = lazy(() => import('@/pages/Home'))
const Learn = lazy(() => import('@/pages/Learn'))
const Models = lazy(() => import('@/pages/Models'))
const ModelCatalog = lazy(() => import('@/pages/ModelCatalog'))
const ModelKnowledge = lazy(() => import('@/pages/ModelKnowledge'))
const ModelCompare = lazy(() => import('@/pages/ModelCompare'))
const MoeRouting = lazy(() => import('@/pages/MoeRouting'))
const TokenJourney = lazy(() => import('@/pages/TokenJourney'))
const CommunicationTopology = lazy(() => import('@/pages/CommunicationTopology'))
const DeepseekV41 = lazy(() => import('@/pages/DeepseekV41'))
const DpaLab = lazy(() => import('@/pages/DpaLab'))
const News = lazy(() => import('@/pages/News'))
const WeeklyNews = lazy(() => import('@/pages/WeeklyNews'))
const CategoryPage = lazy(() => import('@/pages/Category'))
const ArticlePage = lazy(() => import('@/pages/Article'))
const About = lazy(() => import('@/pages/About'))
const KnowledgeGraph = lazy(() => import('@/pages/KnowledgeGraph'))
const PerformanceWorkspace = lazy(() => import('@/pages/PerformanceWorkspace'))
const NotFound = lazy(() => import('@/pages/NotFound'))

export default function App() {
  return (
    <Router basename="/">
      <Layout>
        <Suspense fallback={<div role="status" className="page-container grid min-h-[70vh] place-items-center text-sm text-muted">正在加载页面…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/models" element={<ModelCatalog />} />
            <Route path="/models/knowledge" element={<ModelKnowledge />} />
            <Route path="/models/knowledge/:topicId" element={<ModelKnowledge />} />
            <Route path="/models/compare" element={<ModelCompare />} />
            <Route path="/models/moe-routing" element={moeRouting.enabled ? <MoeRoutingBoundary><MoeRouting /></MoeRoutingBoundary> : <NotFound />} />
            <Route path="/models/token-journey" element={tokenJourney.enabled ? <TokenJourneyBoundary><TokenJourney /></TokenJourneyBoundary> : <NotFound />} />
            <Route path="/models/communication" element={communicationTopology.enabled ? <CommunicationTopologyBoundary><CommunicationTopology /></CommunicationTopologyBoundary> : <NotFound />} />
            <Route path="/models/deepseek-v4-1-flash" element={<DeepseekV41 />} />
            <Route path="/models/glm-5-2/dpa" element={<DpaLab />} />
            <Route path="/models/qwen3-8b/dpa" element={<DpaLab modelId="qwen3-8b" />} />
            <Route path="/models/:modelId" element={<Models />} />
            <Route path="/news" element={<News />} />
            <Route path="/news/weekly/:period?" element={<WeeklyNews />} />
            <Route path="/operators/*" element={<PerformanceWorkspace />} />
            <Route path="/category/:slug" element={<CategoryPage />} />
            <Route path="/article/:slug" element={<ArticlePage />} />
            <Route path="/about" element={<About />} />
            <Route path="/knowledge-graph" element={<KnowledgeGraph />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Layout>
    </Router>
  )
}
