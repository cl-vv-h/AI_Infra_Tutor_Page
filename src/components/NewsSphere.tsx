import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react'
import type { Hotspot } from '@/lib/news-hotspots.mjs'
import { categories } from '@/lib/news-hotspots.mjs'
import { pointRadius, relatedSignals, rotatePoint, spherePosition } from '@/lib/news-sphere'
import type { Vec3 } from '@/lib/news-sphere'

type Props = { all: Hotspot[]; visible: Hotspot[]; selected: string; highlighted: string; onSelect: (id: string) => void }
type Dot = { item: Hotspot; p: Vec3; alpha: number; x: number; y: number; z: number; size: number; forceX: number; forceY: number }
const colors = { ai: '196,186,229', technology: '166,204,215', finance: '180,212,194', world: '221,205,175' }

export default function NewsSphere(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null), tooltip = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(''), [playing, setPlaying] = useState(true), [failed, setFailed] = useState(false)
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [compact, setCompact] = useState(() => innerWidth < 768)
  const latest = useRef({ ...props, playing, reduced, hovered })
  latest.current = { ...props, playing, reduced, hovered }
  // Stable catalog membership while filters morph targets. Mobile has a disclosed cap.
  const nodes = useMemo(() => props.all, [props.all])
  const state = useRef({ yaw: .3, pitch: -.12, vx: 0, vy: 0, pointer: { x: -1000, y: -1000 }, down: false, moved: 0, lastX: 0, lastY: 0, lastInput: 0, width: 0, height: 0, dots: [] as Dot[], visible: true, step: 0 })
  const invalidate = useRef<() => void>(() => {})
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)'), mobile = matchMedia('(max-width: 767px)')
    const change = () => { setReduced(media.matches); if (media.matches) setPlaying(false); invalidate.current() }
    const resize = () => setCompact(mobile.matches)
    media.addEventListener('change', change); mobile.addEventListener('change', resize)
    return () => { media.removeEventListener('change', change); mobile.removeEventListener('change', resize) }
  }, [])
  useEffect(() => {
    const element = canvas.current
    if (!element) return
    let ctx: CanvasRenderingContext2D | null = null
    try { ctx = element.getContext('2d', { alpha: true }) } catch { /* readable fallback below */ }
    if (!ctx) { setFailed(true); return }
    const context = ctx, s = state.current
    s.dots = nodes.map((item, i) => { const p = spherePosition(i, nodes.length, item.id), start = latest.current.reduced ? 1 : .08; return { item, p: { x: p.x * start, y: p.y * start, z: p.z * start }, alpha: 0, x: 0, y: 0, z: 0, size: 0, forceX: 0, forceY: 0 } })
    let frame = 0, previous: number | null = null, dirty = true
    const wake = () => { dirty = true; if (!frame && !document.hidden && s.visible) frame = requestAnimationFrame(draw) }
    invalidate.current = wake
    function draw(now: number) {
      frame = 0
      if (document.hidden || !s.visible) { previous = null; return }
      const delta = previous === null ? 0 : Math.max(0, Math.min(50, now - previous)); previous = now
      const current = latest.current, animated = current.playing && !current.reduced
      const blend = current.reduced || !current.playing ? 1 : 1 - Math.exp(-delta / 180)
      const active = current.selected || current.highlighted || current.hovered
      const targetRows = current.visible.slice(0, compact ? 320 : 1200), activeRow = current.visible.find(row => row.id === active)
      if (activeRow && !targetRows.some(row => row.id === active)) targetRows.splice(-1, 1, activeRow)
      const visible = new Set(targetRows.map(row => row.id))
      const chosen = current.all.find(row => row.id === active)
      const related = new Set(chosen ? relatedSignals(chosen, current.visible).map(row => row.id) : [])
      const spatialOrder = [...targetRows].sort((a,b) => a.id.localeCompare(b.id))
      const targets = new Map(spatialOrder.map((row, i) => [row.id, spherePosition(i, spatialOrder.length, row.id)])), scores = new Map(targetRows.map(row => [row.id, row.score])), pulsing = new Set([...targetRows].sort((a,b) => b.score-a.score).slice(0,Math.ceil(targetRows.length * .05)).map(row => row.id))
      const focus = targets.get(current.selected)
      if (focus && !s.down) {
        const targetYaw = -Math.atan2(focus.x, focus.z), targetPitch = Math.atan2(focus.y, Math.hypot(focus.x, focus.z))
        const difference = Math.atan2(Math.sin(targetYaw - s.yaw), Math.cos(targetYaw - s.yaw))
        s.yaw += difference * blend; s.pitch += (targetPitch - s.pitch) * blend
      } else if (animated && !s.down) {
        s.yaw += s.vx; s.pitch = Math.max(-1.1, Math.min(1.1, s.pitch + s.vy)); s.vx *= .92; s.vy *= .92
        if (now - s.lastInput > 3500) s.yaw += delta * Math.PI * 2 / 120000
      }
      s.yaw += s.step; s.step = 0
      const { width: w, height: h } = s, scale = Math.min(w * .41, h * .40), centerX = w / 2, centerY = h * .49
      context.clearRect(0, 0, w, h)
      let settling = false
      for (const dot of s.dots) {
        const target = targets.get(dot.item.id) || dot.p
        const targetAlpha = visible.has(dot.item.id) ? 1 : 0
        if (!targetAlpha && dot.alpha < .005) {dot.alpha = 0; continue}
        if (Math.abs(targetAlpha - dot.alpha) > .005 || Math.abs(target.x - dot.p.x) + Math.abs(target.y - dot.p.y) + Math.abs(target.z - dot.p.z) > .005) settling = true
        dot.alpha += (targetAlpha - dot.alpha) * blend
        dot.p.x += (target.x - dot.p.x) * blend; dot.p.y += (target.y - dot.p.y) * blend; dot.p.z += (target.z - dot.p.z) * blend
        const p = rotatePoint(dot.p, s.yaw, s.pitch), perspective = 3.6 / (3.6 - p.z)
        let x = centerX + p.x * scale * perspective, y = centerY - p.y * scale * perspective
        const distance = Math.hypot(x - s.pointer.x, y - s.pointer.y), influence = Math.max(0, 1 - distance / 100)
        const forceX = animated && !s.down ? p.x * influence * 13 + p.y * influence * 3 : 0, forceY = animated && !s.down ? -p.y * influence * 13 + p.x * influence * 3 : 0
        dot.forceX += (forceX - dot.forceX) * blend; dot.forceY += (forceY - dot.forceY) * blend
        x += dot.forceX; y += dot.forceY
        dot.x = x; dot.y = y; dot.z = p.z
        const heat = scores.get(dot.item.id) || 0
        const pulse = animated && pulsing.has(dot.item.id) ? 1 + .08 * Math.sin(now / 650 + dot.p.x) : 1
        dot.size = pointRadius(heat) * perspective * pulse * (active === dot.item.id ? 1.7 : 1)
      }
      const ordered = s.dots.filter(dot => dot.alpha >= .01).sort((a, b) => a.z - b.z)
      const origin = s.dots.find(dot => dot.item.id === active && dot.alpha > .5)
      if (origin && !compact) {
        context.strokeStyle = 'rgba(180,186,210,.22)'; context.lineWidth = .6
        for (const dot of s.dots.filter(dot => related.has(dot.item.id) && dot.alpha > .5)) { context.beginPath(); context.moveTo(origin.x, origin.y); context.lineTo(dot.x, dot.y); context.stroke() }
      }
      for (const dot of ordered) {
        if (dot.alpha < .01) continue
        const emphasized = dot.item.id === active || related.has(dot.item.id)
        const opacity = dot.alpha * (.30 + (dot.z + 1) / 2 * .65) * (current.selected && !emphasized ? .28 : 1)
        context.fillStyle = `rgba(${emphasized ? colors[dot.item.category] : '205,211,222'},${Math.min(1, opacity)})`
        if (dot.size > 3) { context.shadowColor = `rgba(${colors[dot.item.category]},.45)`; context.shadowBlur = emphasized ? 16 : 7 }
        context.beginPath(); context.arc(dot.x, dot.y, Math.max(.2, dot.size), 0, Math.PI * 2); context.fill(); context.shadowBlur = 0
        if (dot.item.id === active) { context.strokeStyle = `rgba(${colors[dot.item.category]},.6)`; context.lineWidth = 1; context.beginPath(); context.arc(dot.x, dot.y, dot.size + 6, 0, Math.PI * 2); context.stroke() }
      }
      if (tooltip.current && origin) {
        const left = Math.max(12, Math.min(w - Math.min(280, w - 24) - 12, origin.x + 18)), top = Math.max(12, Math.min(h - 175, origin.y - 70))
        tooltip.current.style.transform = `translate(${left}px,${top}px)`
        context.strokeStyle = 'rgba(200,205,220,.35)'; context.beginPath(); context.moveTo(origin.x, origin.y); context.lineTo(left, top + 45); context.stroke()
      }
      element.dataset.nodes = String(targetRows.length); element.dataset.yaw = s.yaw.toFixed(4)
      if (animated || settling || dirty) { dirty = false; frame = requestAnimationFrame(draw) } else previous = null
    }
    const resize = () => { const rect = element.getBoundingClientRect(); s.width = rect.width; s.height = rect.height; const ratio = Math.min(devicePixelRatio || 1, 2); element.width = rect.width * ratio; element.height = rect.height * ratio; context.setTransform(ratio, 0, 0, ratio, 0, 0); wake() }
    const observer = new ResizeObserver(resize); observer.observe(element)
    const intersection = new IntersectionObserver(entries => { s.visible = entries[0].isIntersecting; previous = null; if (s.visible) wake() }); intersection.observe(element)
    const visibility = () => { previous = null; if (!document.hidden) wake() }; document.addEventListener('visibilitychange', visibility)
    return () => { cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect(); document.removeEventListener('visibilitychange', visibility); invalidate.current = () => {} }
  }, [nodes, compact])
  useEffect(() => { invalidate.current() }, [props.visible, props.selected, props.highlighted, hovered, playing, reduced])
  const hit = (x: number, y: number) => [...state.current.dots].filter(dot => dot.alpha > .7 && Math.hypot(dot.x - x, dot.y - y) < Math.max(14, dot.size + 8)).sort((a, b) => b.z - a.z)[0]?.item.id || ''
  const hover = props.visible.find(row => row.id === hovered)
  const browseNext = () => { const index = props.visible.findIndex(row => row.id === hovered); setHovered(props.visible[(index + 1) % props.visible.length]?.id || '') }
  return <div className="pulse-sphere-wrap">
    <div className="pulse-sphere-controls"><button disabled={reduced || failed} onClick={() => setPlaying(value => !value)} aria-label={playing && !reduced ? '暂停球体动画' : '播放球体动画'}>{playing && !reduced ? <Pause size={14}/> : <Play size={14}/>}<span>{reduced ? '减少动态效果' : playing ? '暂停' : '播放'}</span></button><button disabled={failed} onClick={() => { setPlaying(false); state.current.step = Math.PI / 12; invalidate.current() }} aria-label="单步旋转球体"><SkipForward size={14}/></button><button disabled={failed} onClick={() => {state.current.yaw = .3; state.current.pitch = -.12; state.current.vx = 0; state.current.vy = 0; setHovered(''); invalidate.current()}} aria-label="重置球体视角"><RotateCcw size={14}/></button></div>
    {failed ? <div className="pulse-canvas-fallback" role="status">此浏览器无法绘制球体，完整新闻仍可在下方阅读。</div> : <canvas ref={canvas} className="pulse-canvas" tabIndex={0} role="group" aria-label="新闻信息球体。拖动探索；左右键选择新闻，回车打开详情，Escape 清除预览。" onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {event.preventDefault(); const index = props.visible.findIndex(row => row.id === hovered), delta = event.key === 'ArrowRight' ? 1 : -1; setHovered(props.visible[(index + delta + props.visible.length) % props.visible.length]?.id || '')} else if (event.key === 'Enter' && hovered) props.onSelect(hovered); else if (event.key === 'Escape') setHovered('') }}
      onPointerDown={event => { const s = state.current; s.down = true; s.moved = 0; s.lastX = event.clientX; s.lastY = event.clientY; s.vx = 0; s.vy = 0; event.currentTarget.setPointerCapture(event.pointerId) }}
      onPointerMove={event => { const s = state.current, rect = event.currentTarget.getBoundingClientRect(); s.pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top }; s.lastInput = performance.now(); if (s.down) { const dx = event.clientX - s.lastX, dy = event.clientY - s.lastY; s.moved += Math.abs(dx) + Math.abs(dy); s.vx = Math.max(-.03, Math.min(.03, dx * .003)); s.vy = Math.max(-.03, Math.min(.03, dy * .003)); s.yaw += dx * .006; s.pitch = Math.max(-1.1, Math.min(1.1, s.pitch + dy * .006)); s.lastX = event.clientX; s.lastY = event.clientY } else if (event.pointerType === 'mouse') setHovered(hit(s.pointer.x, s.pointer.y)); invalidate.current() }}
      onPointerUp={event => {const s = state.current; s.down = false; s.lastInput = performance.now(); if (s.moved < 8) {const rect = event.currentTarget.getBoundingClientRect(), id = hit(event.clientX - rect.left, event.clientY - rect.top); if (id) { if (event.pointerType === 'mouse' || hovered === id) props.onSelect(id); else setHovered(id) }} }}
      onPointerCancel={() => {state.current.down = false; state.current.vx = 0; state.current.vy = 0}}
      onPointerLeave={event => {state.current.pointer = {x:-1000,y:-1000}; if (event.pointerType === 'mouse' && !state.current.down) setHovered(''); invalidate.current()}} />}
    {hover && !props.selected && <div ref={tooltip} className="pulse-preview" role="status"><span>{categories[hover.category]} · 活跃度 {hover.score}</span><strong>{hover.title}</strong><span>{hover.reports[0]?.source} · {hover.publishers} 个发布方</span><small>点击／回车查看 · 同板块连线仅供延伸阅读</small></div>}
    <div className="pulse-sphere-caption"><span>拖动探索 · 悬停预览 · 点击聚焦</span><button onClick={browseNext} disabled={!props.visible.length}>逐条探索 →</button>{hover && <button onClick={() => props.onSelect(hover.id)}>打开预览详情</button>}</div>
    {props.visible.length > (compact ? 320 : 1200) && <p className="pulse-cap">球体展示前 {compact ? 320 : 1200} 个信号；完整结果在下方。</p>}
  </div>
}
