import { useState, useCallback, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'

interface MarkdownRendererProps {
  content: string
}

function MermaidBlock({ code }: { code: string }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mermaid-diagram my-4 rounded-lg border border-[#00d4ff]/20 bg-[#0d1117] p-4">
      <div className="mb-2 flex items-center gap-2 text-sm text-[#00d4ff]">
        <span className="font-medium">Mermaid 图表</span>
        <span className="text-gray-500">（请在支持Mermaid的查看器中查看）</span>
      </div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300 transition-colors"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {expanded ? '收起源码' : '查看源码'}
      </button>
      {expanded && (
        <pre className="mt-2 overflow-x-auto rounded bg-black/30 p-3 text-xs text-gray-300">
          <code>{code}</code>
        </pre>
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
        img: ({ src, alt }) => (
          <img src={src} alt={alt} className="my-4 max-w-full rounded-lg" />
        ),
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
