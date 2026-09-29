import { Component, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

export default class TokenJourneyBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  render(){
    if(!this.state.failed)return this.props.children
    return <section role="alert" className="page-container py-12 text-ink"><h1 className="text-2xl">Token 旅程暂时无法加载</h1><p className="my-4 text-secondary">请检查网络后重新加载。已应用的参数保留在 URL 中，播放位置不会保存。</p><div className="flex flex-wrap gap-3"><button className="button-primary" onClick={()=>window.location.reload()}>重新加载旅程</button><Link className="button-secondary" to="/models">返回模型目录</Link></div></section>
  }
}
