import { Component, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
export default class CommunicationTopologyBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  render(){return this.state.failed?<section className="page-container py-12 text-ink" role="alert"><h1 className="text-2xl">通信实验室暂时无法加载</h1><p className="my-4 text-secondary">请检查网络后重试。已应用参数保留在 URL 中，播放位置不会保存。</p><div className="flex flex-wrap gap-3"><button className="button-primary" onClick={()=>location.reload()}>重新加载实验室</button><Link className="button-secondary" to="/models">返回模型目录</Link></div></section>:this.props.children}
}
