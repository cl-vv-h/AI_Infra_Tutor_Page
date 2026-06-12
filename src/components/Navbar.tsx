import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Menu, X, Github } from 'lucide-react';

const navLinks = [
  { label: '首页', to: '/' },
  { label: 'SGLang', to: '/category/sglang' },
  { label: '关于', to: '/about' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-white/10 bg-[#0a0f1e]/80 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-white">
          <Zap className="h-5 w-5 text-[#00d4ff]" />
          AI Inference Tutor
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-sm text-gray-300 transition-colors hover:text-[#00d4ff]"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <a
            href="https://github.com/cl-vv-h/AI_Infra_Tutor_Page"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 transition-colors hover:text-white"
          >
            <Github className="h-5 w-5" />
          </a>

          <button
            onClick={() => setOpen(!open)}
            className="text-gray-300 md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-b border-white/10 bg-[#0a0f1e]/95 backdrop-blur-md md:hidden">
          <div className="flex flex-col gap-2 px-4 py-3">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className="rounded px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-white/5 hover:text-[#00d4ff]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
