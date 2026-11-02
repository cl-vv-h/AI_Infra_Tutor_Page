import { Component, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
export default class LearningGuideBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  render(){return this.state.failed?<div role="alert" className="page-container py-16"><h1 className="text-2xl text-ink">课程目录暂时无法加载</h1><p className="my-5 text-secondary">请检查网络后刷新，或进入原分类继续阅读。</p><button className="button-primary mr-4" onClick={()=>window.location.reload()}>重新加载课程</button><Link className="button-secondary" to="/category/sglang">进入原分类</Link></div>:this.props.children}
}
