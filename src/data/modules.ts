import type { LucideIcon } from 'lucide-react'
import { BookOpenText, Newspaper, Orbit } from 'lucide-react'

export interface PortalModule {
  id: string
  eyebrow: string
  title: string
  titleEn: string
  description: string
  to?: string
  icon: LucideIcon
  accent: string
  stats: string[]
  status: 'live' | 'beta' | 'planned'
}

// Add a new entry here to expand the portal without changing the home layout.
export const portalModules: PortalModule[] = [
  {
    id: 'learn',
    eyebrow: 'LEARN / 01',
    title: 'AI Infra 教学',
    titleEn: 'AI Infrastructure Lab',
    description: '从推理基础、模型架构到 SGLang 源码与 Ascend NPU 算子的系统化双语课程。',
    to: '/learn',
    icon: BookOpenText,
    accent: '#70e1f5',
    stats: ['双语课程', '源码导读', '持续同步'],
    status: 'live',
  },
  {
    id: 'news',
    eyebrow: 'SIGNALS / 02',
    title: '全球新闻雷达',
    titleEn: 'Global Signal Desk',
    description: '聚合 AI、科技、金融与国际形势的重要进展，保留原始来源与每周脉络。',
    to: '/news',
    icon: Newspaper,
    accent: '#d8ff78',
    stats: ['每日更新', '国际信源', '每周报告'],
    status: 'beta',
  },
  {
    id: 'future',
    eyebrow: 'NEXT / 03',
    title: '下一间实验室',
    titleEn: 'Next Lab',
    description: '为未来的工具、实验和专题预留独立入口；模块结构可继续横向扩展。',
    icon: Orbit,
    accent: '#c7a8ff',
    stats: ['开放规划', '模块化接入'],
    status: 'planned',
  },
]
