import { Link } from 'react-router-dom';
import {
  GitBranch,
  Puzzle,
  FastForward,
  Terminal,
  Shuffle,
  Zap,
  Minimize2,
  Code2,
  Network,
  type LucideIcon,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  GitBranch,
  Puzzle,
  FastForward,
  Terminal,
  Shuffle,
  Zap,
  Minimize2,
  Code2,
  Network,
};

interface CategoryCardProps {
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
}

export default function CategoryCard({ name, slug, description, icon, color }: CategoryCardProps) {
  const IconComponent = iconMap[icon] || Zap;

  return (
    <Link
      to={`/category/${slug}`}
      className="group block rounded-lg border border-white/10 bg-[#1a1f35] p-6 transition-all duration-300 hover:border-opacity-60 hover:shadow-lg"
      style={{
        ['--card-color' as string]: color,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.boxShadow = `0 0 20px ${color}33`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}20` }}
      >
        <IconComponent className="h-6 w-6" style={{ color }} />
      </div>

      <h3 className="mb-2 text-lg font-semibold" style={{ color }}>
        {name}
      </h3>

      <p className="text-sm leading-relaxed text-gray-400">{description}</p>
    </Link>
  );
}
