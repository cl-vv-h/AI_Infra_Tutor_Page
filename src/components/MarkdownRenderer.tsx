import { useState, useEffect, useCallback, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import { Copy, Check, AlertCircle } from 'lucide-react'

interface MermaidAPI {
  initialize: (config: Record<string, unknown>) => void
  render: (id: string, code: string) => Promise<{ svg: string }>
}

let mermaidInstance: MermaidAPI | null = null
let mermaidInitPromise: Promise<MermaidAPI> | null = null

async function getMermaid() {
  if (mermaidInstance) return mermaidInstance
  if (mermaidInitPromise) return mermaidInitPromise

  mermaidInitPromise = (async () => {
    const m = await import('mermaid') as { default: MermaidAPI }
    m.default.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        primaryColor: '#1a1f35',
        primaryTextColor: '#e5e7eb',
        primaryBorderColor: '#00d4ff',
        lineColor: '#4b5563',
        secondaryColor: '#1e2440',
        tertiaryColor: '#0d1117',
        fontFamily: '"Space Grotesk", "Noto Sans SC", sans-serif',
      },
    })
    mermaidInstance = m.default
    return mermaidInstance
  })()

  return mermaidInitPromise
}

interface MarkdownRendererProps {
  content: string
}

function MermaidBlock({ code }: { code: string }) {
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const renderDiagram = async () => {
      try {
        setLoading(true)
        const mermaid = await getMermaid()
        if (cancelled) return
        const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`
        const { svg: renderedSvg } = await mermaid.render(id, code.trim())
        if (!cancelled) {
          setSvg(renderedSvg)
          setError('')
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(String(err))
          setLoading(false)
        }
      }
    }
    renderDiagram()
    return () => { cancelled = true }
  }, [code])

  if (loading && !svg && !error) {
    return (
      <div className="my-4 overflow-x-auto rounded-lg border border-white/10 bg-[#0d1117] p-6">
        <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-transparent" />
          <span>图表渲染中...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="my-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4" />
          <span>Mermaid 渲染失败</span>
        </div>
        <pre className="overflow-x-auto rounded bg-black/30 p-3 text-xs text-gray-400">
          <code>{code}</code>
        </pre>
      </div>
    )
  }

  return (
    <div className="mermaid-diagram my-4 overflow-x-auto rounded-lg border border-white/10 bg-[#0d1117] p-6">
      <div dangerouslySetInnerHTML={{ __html: svg }} className="flex justify-center [&>svg]:max-w-full [&>svg]:h-auto" />
    </div>
  )
}

function CodeBlock({ className, children }: { className?: string; children?: ReactNode }) {
  const [copied, setCopied] = useState(false)
  const codeStr = String(children).replace(/\n$/, '')
  const language = className?.replace('language-', '') ?? ''

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(codeStr).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [codeStr])

  if (language === 'mermaid') {
    return <MermaidBlock code={codeStr} />
  }

  return (
    <div className="relative my-4 overflow-x-auto rounded-lg border border-white/10 bg-[#0d1117]">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-1.5">
        {language ? (
          <span className="text-xs text-gray-500">{language}</span>
        ) : (
          <span />
        )}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-gray-400 transition-colors hover:bg-white/5 hover:text-gray-200"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              已复制
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              复制
            </>
          )}
        </button>
      </div>
      <pre className="!m-0 !rounded-none !border-0 p-4">
        <code className={`${className ?? ''} text-sm leading-relaxed`}>{children}</code>
      </pre>
    </div>
  )
}

function extractTextFromChildren(children: ReactNode): string {
  if (typeof children === 'string') return children
  if (Array.isArray(children)) return children.map(extractTextFromChildren).join('')
  if (children && typeof children === 'object' && 'props' in children) {
    return extractTextFromChildren((children as { props: { children: ReactNode } }).props.children)
  }
  return ''
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypeSlug]}
      components={{
        h1: ({ children, ...props }) => (
          <h1 className="mb-4 mt-10 border-b border-white/10 pb-3 text-3xl font-bold text-white" {...props}>
            {children}
          </h1>
        ),
        h2: ({ children, ...props }) => (
          <h2 className="mb-4 mt-8 border-b border-white/10 pb-3 text-2xl font-bold text-white" {...props}>
            {children}
          </h2>
        ),
        h3: ({ children, ...props }) => (
          <h3 className="mb-3 mt-6 text-xl font-semibold text-white" {...props}>
            {children}
          </h3>
        ),
        h4: ({ children, ...props }) => (
          <h4 className="mb-2 mt-4 text-lg font-semibold text-white" {...props}>
            {children}
          </h4>
        ),
        p: ({ children }) => (
          <p className="mb-4 leading-relaxed text-gray-300">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="mb-4 list-disc space-y-1 pl-6 text-gray-300">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-4 list-decimal space-y-1 pl-6 text-gray-300">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-gray-300">{children}</li>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-4 border-l-4 border-[#00d4ff]/30 pl-4 italic text-gray-400">
            {children}
          </blockquote>
        ),
        a: ({ children, href }) => (
          <a href={href} className="text-[#00d4ff] hover:underline" target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-white">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-gray-200">{children}</em>
        ),
        hr: () => (
          <hr className="my-8 border-white/10" />
        ),
        table: ({ children }) => (
          <div className="mb-6 overflow-x-auto">
            <table className="w-full border-collapse text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="border-b border-white/10">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="px-4 py-2 text-left font-semibold text-white">{children}</th>
        ),
        td: ({ children }) => (
          <td className="border-b border-white/5 px-4 py-2 text-gray-300">{children}</td>
        ),
        tr: ({ children }) => (
          <tr className="border-b border-white/5">{children}</tr>
        ),
        img: ({ src, alt }) => {
          if (!src) return null
          if (src.startsWith('http') || src.startsWith('data:')) {
            return <img src={src} alt={alt} className="my-4 max-w-full rounded-lg" />
          }
          return (
            <div className="my-4 rounded-lg border border-white/10 bg-[#1a1f35] p-4 text-center">
              <p className="text-sm text-gray-400">图片: {alt || src}</p>
            </div>
          )
        },
        code: ({ className, children, node, ...props }) => {
          const isBlock = className?.startsWith('language-') || (node?.position && String(children).includes('\n'))
          if (isBlock) {
            const textContent = extractTextFromChildren(children)
            return <CodeBlock className={className}>{textContent}</CodeBlock>
          }
          return (
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm text-[#00d4ff]" {...props}>
              {children}
            </code>
          )
        },
        pre: ({ children }) => <>{children}</>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
