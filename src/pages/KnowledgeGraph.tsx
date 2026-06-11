import { Link } from 'react-router-dom'
import KnowledgeGraphView from '@/components/KnowledgeGraphView'

export default function KnowledgeGraph() {
  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <Link
          to="/category/sglang"
          className="mb-6 inline-block text-sm text-gray-500 transition-colors hover:text-[#00d4ff]"
        >
          ← 返回SGLang分类
        </Link>

        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-white">SGLang 架构知识图谱</h1>
          <p className="text-gray-400">
            SGLang核心模块架构与调用关系全景图 — 点击模块查看详情，悬停高亮关联路径
          </p>
        </div>

        <KnowledgeGraphView />
      </div>
    </div>
  )
}
