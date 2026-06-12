import { Link } from 'react-router-dom'
import { ArrowRight, Calendar, Clock } from 'lucide-react'
import { categories, learningPaths } from '@/data/categories'
import { articles } from '@/data/articles'
import CategoryCard from '@/components/CategoryCard'

const levelMap: Record<string, string> = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '专家',
}

export default function Home() {
  const latestArticles = articles.slice(0, 4)

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <section className="grid-bg relative overflow-hidden py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-[#00d4ff]/5 to-transparent" />
        <div className="container relative mx-auto px-6 text-center">
          <h1 className="mb-6 text-5xl font-bold tracking-tight text-white md:text-6xl">
            AI Inference Tutor
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-gray-400 md:text-xl">
            系统化掌握大模型推理核心技术，从并行策略到推理部署的全链路知识体系
          </p>
          <Link
            to="/category/sglang"
            className="inline-flex items-center gap-2 rounded-lg bg-[#00d4ff] px-8 py-3 font-semibold text-[#0a0f1e] transition-all hover:bg-[#00b8e6] hover:shadow-lg hover:shadow-[#00d4ff]/25"
          >
            开始学习
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-6">
          <h2 className="mb-12 text-center text-3xl font-bold text-white">知识领域</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => (
              <CategoryCard key={cat.id} name={cat.name} slug={cat.slug} description={cat.description} icon={cat.icon} color={cat.color} />
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-6">
          <h2 className="mb-12 text-center text-3xl font-bold text-white">学习路径</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {learningPaths.map((path) => (
              <div
                key={path.id}
                className="rounded-xl border border-white/5 bg-[#1a1f35] p-6"
                style={{ borderLeftWidth: '4px', borderLeftColor: path.color }}
              >
                <div className="mb-3 flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-white">{path.title}</h3>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: `${path.color}20`, color: path.color }}
                  >
                    {levelMap[path.level]}
                  </span>
                </div>
                <p className="mb-4 text-sm text-gray-400">{path.description}</p>
                <ul className="space-y-2">
                  {path.topics.map((topic) => (
                    <li key={topic} className="flex items-center gap-2 text-sm text-gray-300">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: path.color }} />
                      {topic}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-6">
          <h2 className="mb-12 text-center text-3xl font-bold text-white">最新内容</h2>
          <div className="space-y-4">
            {latestArticles.map((article) => (
              <Link
                key={article.id}
                to={`/article/${article.slug}`}
                className="group flex flex-col gap-3 rounded-xl border border-white/5 bg-[#1a1f35] p-5 transition-all hover:border-white/10 hover:bg-[#1e2440] md:flex-row md:items-start md:gap-6"
              >
                <div className="flex-1">
                  <h3 className="mb-1 text-base font-semibold text-white group-hover:text-[#00d4ff] transition-colors">
                    {article.title}
                  </h3>
                  <p className="text-sm text-gray-400 line-clamp-2">{article.summary}</p>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {article.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {article.readTime}
                  </span>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {article.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-gray-400">
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
