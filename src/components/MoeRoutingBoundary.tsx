import { Component, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

export default class MoeRoutingBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  render(){
    if(!this.state.failed)return this.props.children
    return <section role="alert" className="page-container py-12 text-ink"><h1 className="text-2xl">MoE 沙盘暂时无法加载</h1><p className="my-4 text-secondary">请检查网络后重新加载。URL 中已应用的参数会保留，未应用的输入不会保存。</p><div className="flex flex-wrap gap-3"><button className="button-primary" onClick={()=>window.location.reload()}>重新加载沙盘</button><Link className="button-secondary" to="/models">返回模型目录</Link></div></section>
  }
}
