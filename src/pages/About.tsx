import { Link } from 'react-router-dom'
import { Github, BookOpen, Target, Users, ShieldCheck } from 'lucide-react'

export default function About() {
  return (
    <div className="min-h-screen bg-[#070b10]">
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h1 className="mb-4 text-4xl font-bold text-white">关于 AI Infra Space</h1>
          <p className="text-lg text-gray-400">
            理解系统，追踪信号，保留通向下一次探索的入口
          </p>
        </div>
      </section>

      <section className="pb-20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-16 rounded-xl border border-white/5 bg-[#1a1f35] p-8">
            <div className="mb-4 flex items-center gap-3">
              <Target className="h-6 w-6 text-[#00d4ff]" />
              <h2 className="text-2xl font-bold text-white">项目使命</h2>
            </div>
            <p className="leading-relaxed text-gray-300">
              项目希望把分散的 AI Infra 知识整理成可行走的地图：既能从 Prefill、KV Cache 等基础概念开始，也能一路深入 SGLang 调度、分布式执行、Ascend NPU 与真实算子源码。
            </p>
          </div>

          <div className="mb-16 rounded-xl border border-white/5 bg-[#1a1f35] p-8">
            <div className="mb-4 flex items-center gap-3">
              <BookOpen className="h-6 w-6 text-[#00d4ff]" />
              <h2 className="text-2xl font-bold text-white">内容标准</h2>
            </div>
            <p className="mb-6 leading-relaxed text-gray-300">
              每篇内容遵循五维度标准，确保知识的完整性与实用性：
            </p>
            <div className="space-y-4">
              {[
                { title: '核心概念解释', desc: '清晰阐述技术概念的定义与核心思想' },
                { title: '技术原理分析', desc: '深入剖析技术背后的数学原理与算法机制' },
                { title: '实现细节说明', desc: '提供关键实现细节与工程实践要点' },
                { title: '性能评估指标', desc: '定义量化评估标准，提供可衡量的性能指标' },
                { title: '典型应用案例', desc: '结合真实场景，展示技术的实际应用效果' },
              ].map((item) => (
                <div key={item.title} className="flex gap-4 rounded-lg bg-white/5 p-4">
                  <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#00d4ff]" />
                  <div>
                    <h3 className="font-semibold text-white">{item.title}</h3>
                    <p className="mt-1 text-sm text-gray-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-16 rounded-xl border border-white/5 bg-[#1a1f35] p-8">
            <div className="mb-4 flex items-center gap-3">
              <Users className="h-6 w-6 text-[#00d4ff]" />
              <h2 className="text-2xl font-bold text-white">参与贡献</h2>
            </div>
            <p className="leading-relaxed text-gray-300">
              我们欢迎所有对大模型推理技术感兴趣的开发者参与贡献。无论是修正错误、补充内容还是新增主题，每一份贡献都将帮助更多人掌握推理技术。请通过 GitHub 提交 Issue 或 Pull Request 参与贡献。
            </p>
          </div>

          <div className="rounded-xl border border-white/5 bg-[#1a1f35] p-8">
            <div className="mb-4 flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-[#d8ff78]" />
              <h2 className="text-2xl font-bold text-white">公开与安全</h2>
            </div>
            <p className="mb-4 leading-relaxed text-gray-300">
              网站只发布公开课程、公共新闻元数据与来源链接。自动化所需凭证保存在 GitHub Secrets 中，不进入仓库、网页或报告。
            </p>
            <Link
              to="https://github.com/cl-vv-h/AI_Infra_Tutor_Page"
              target="_blank"
              className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Github className="h-4 w-4" />
              查看项目仓库
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
