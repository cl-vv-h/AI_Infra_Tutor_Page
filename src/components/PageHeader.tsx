import type { ReactNode } from 'react'

export default function PageHeader({eyebrow,title,description,actions,compact=false}:{eyebrow:string;title:ReactNode;description?:ReactNode;actions?:ReactNode;compact?:boolean}) {
  return <header className={`page-heading ${compact?'page-heading--compact':''}`}>
    <div className="min-w-0"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description&&<div className="page-heading__description">{description}</div>}</div>
    {actions&&<div className="page-heading__actions">{actions}</div>}
  </header>
}
