import { Link } from 'react-router-dom'
import KnowledgeGraphView from '@/components/KnowledgeGraphView'
import PageHeader from '@/components/PageHeader'

export default function KnowledgeGraph() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="page-container py-8">
        <Link
          to="/category/sglang"
          className="mb-6 inline-block text-sm text-muted transition-colors hover:text-accent"
        >
          ← 返回SGLang分类
        </Link>

        <PageHeader eyebrow="CURRICULUM / SYSTEM MAP" title="SGLang 架构知识图谱" description="查看核心模块与调用关系。选择模块阅读详情，悬停高亮关联路径。" compact />

        <KnowledgeGraphView />
      </div>
    </div>
  )
}
