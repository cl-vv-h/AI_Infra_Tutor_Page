import { Component, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

export default class AttentionAtlasBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  render(){
    if(!this.state.failed)return this.props.children
    return <section role="alert" className="page-container py-12"><h1 className="text-2xl text-ink">Attention 图谱暂时无法加载</h1><p className="my-4 text-secondary">请检查网络后重试。所选技术和分支保留在链接中。</p><div className="flex flex-wrap gap-3"><button className="button-primary" onClick={()=>window.location.reload()}>重新加载图谱</button><Link className="button-secondary" to="/learn">返回 AI Infra 教学</Link></div></section>
  }
}
