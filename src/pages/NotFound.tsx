import { Link } from 'react-router-dom'
import PageHeader from '@/components/PageHeader'
export default function NotFound(){return <div className="page-container py-16"><PageHeader eyebrow="404 / NOT FOUND" title="这个页面暂时不存在" description="链接可能已变更。你可以从课程、模型或性能工具重新开始。"/><div className="mt-8 flex flex-wrap gap-3"><Link className="button-primary" to="/">返回首页</Link><Link className="button-secondary" to="/learn">浏览课程</Link><Link className="button-secondary" to="/models">模型目录</Link></div></div>}
