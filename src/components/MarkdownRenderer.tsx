import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import { Copy, Check } from 'lucide-react'

let mermaidInitialized = false
async function getMermaid() {
  const m = await import('mermaid')
  if (!mermaidInitialized) {
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
    mermaidInitialized = true
  }
  return m.default
}

interface MarkdownRendererProps {
  content: string
}

function MermaidBlock({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    const renderDiagram = async () => {
      try {
        const mermaid = await getMermaid()
        if (cancelled) return
        const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`
        const { svg: renderedSvg } = await mermaid.render(id, code)
        if (!cancelled) {
          setSvg(renderedSvg)
          setError('')
        }
      } catch (err) {
        if (!cancelled) setError(String(err))
      }
    }
    renderDiagram()
    return () => { cancelled = true }
  }, [code])

  if (error) {
    return (
      <div className="my-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
        <p className="mb-2 text-sm text-red-400">Mermaid 渲染失败</p>
        <pre className="overflow-x-auto text-xs text-gray-400"><code>{code}</code></pre>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="mermaid-diagram my-4 overflow-x-auto rounded-lg border border-white/10 bg-[#0d1117] p-6">
      {svg ? (
        <div dangerouslySetInnerHTML={{ __html: svg }} className="flex justify-center" />
      ) : (
        <div className="flex items-center justify-center py-8 text-gray-500">渲染中...</div>
      )}
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
        {language && (
          <span className="text-xs text-gray-500">{language}</span>
        )}
        {!language && <span />}
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

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypeHighlight, rehypeSlug]}
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
        code: ({ className, children, ...props }) => {
          const isBlock = className?.startsWith('language-') || String(children).includes('\n')
          if (isBlock) {
            return <CodeBlock className={className}>{children}</CodeBlock>
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
