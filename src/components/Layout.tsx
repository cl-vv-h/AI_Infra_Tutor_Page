import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const {pathname,hash}=useLocation();
  const navigationType=useNavigationType();
  const previousPath=useRef(pathname);
  useEffect(()=>{
    // Query edits are intentionally excluded: calculator controls must not jump.
    const changed=previousPath.current!==pathname;
    previousPath.current=pathname;
    if(changed && !hash && navigationType!=='POP')window.scrollTo({top:0,behavior:'instant'});
  },[pathname,hash,navigationType]);
  return (
    <div className="site-shell min-h-screen bg-canvas" data-section={pathname.split('/')[1]||'home'}>
      <a className="skip-link" href="#main-content" onClick={event=>{event.preventDefault();document.getElementById('main-content')?.focus();document.getElementById('main-content')?.scrollIntoView({block:'start'});}}>跳转到主要内容</a>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="pt-16 focus:outline-none">{children}</main>
      <Footer />
    </div>
  );
}
