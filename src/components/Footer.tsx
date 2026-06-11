import { Link } from 'react-router-dom'

const categoryLinks = [
  { label: '大模型并行策略', to: '/category/parallel-strategy' },
  { label: 'LoRA', to: '/category/lora' },
  { label: 'Prefill', to: '/category/prefill' },
  { label: 'Decode', to: '/category/decode' },
  { label: '推理采样', to: '/category/sampling' },
  { label: '投机推理', to: '/category/speculative-decoding' },
  { label: '量化', to: '/category/quantization' },
  { label: 'SGLang', to: '/category/sglang' },
  { label: '分布式推理', to: '/category/distributed-inference' },
]

const resourceLinks = [
  { label: 'GitHub', href: 'https://github.com' },
  { label: '贡献指南', to: '/about' },
]

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#0a0f1e]">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <h3 className="mb-4 text-sm font-semibold text-white">关于</h3>
            <p className="text-sm leading-relaxed text-gray-400">
              AI Inference Tutor 是一个专注于大模型推理技术的知识平台，涵盖并行策略、LoRA、Prefill/Decode、量化、SGLang等核心技术领域，帮助开发者深入理解大模型推理的底层原理与工程实践。
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-white">知识领域</h3>
            <ul className="space-y-2">
              {categoryLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-gray-400 transition-colors hover:text-[#00d4ff]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-white">资源</h3>
            <ul className="space-y-2">
              {resourceLinks.map((link) => (
                <li key={link.label}>
                  {link.to ? (
                    <Link
                      to={link.to}
                      className="text-sm text-gray-400 transition-colors hover:text-[#00d4ff]"
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gray-400 transition-colors hover:text-[#00d4ff]"
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-center">
          <p className="text-sm text-gray-500">© 2025 AI Inference Tutor</p>
        </div>
      </div>
    </footer>
  )
}
