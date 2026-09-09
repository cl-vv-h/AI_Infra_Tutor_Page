import type { NewsSourceState } from '@/types/news'

export default function NewsSourceStatus({ source }: { source: NewsSourceState }) {
  const fallback = source.channel === 'github-api'
  const label = source.state === 'ok' ? (fallback ? '备用通道可用' : '订阅正常') : source.state === 'invalid' ? '格式异常' : '暂不可用'
  return <div className="mt-2 space-y-1 text-xs leading-5">
    <p className={source.state === 'ok' ? 'text-lime-200' : 'text-amber-200'}>{label}{source.httpStatus ? ` · HTTP ${source.httpStatus}` : ''}</p>
    {fallback && <p className="text-white/55">Atom {source.feedFailure?.state === 'invalid' ? '格式异常' : '暂不可用'}{source.feedFailure?.httpStatus ? `（HTTP ${source.feedFailure.httpStatus}）` : ''}；本次使用官方 GitHub 公开接口。</p>}
  </div>
}
