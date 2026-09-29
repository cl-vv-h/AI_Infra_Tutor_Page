import { Component, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

export default class NewsEventsBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <section className="page-container py-12" role="alert">
      <h1 className="text-2xl text-ink">事件追踪暂时无法加载</h1>
      <p className="my-4 text-secondary">索引格式或页面资源可能发生变化。没有修改本机收藏，也没有将旧内容标成最新。</p>
      <div className="flex flex-wrap gap-3"><button className="button-primary" onClick={() => location.reload()}>重新加载事件追踪</button><Link className="button-secondary" to="/news">返回新闻</Link></div>
    </section> : this.props.children
  }
}
