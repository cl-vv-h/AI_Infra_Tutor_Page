import { Link } from 'react-router-dom';
import { Clock, Calendar } from 'lucide-react';

interface ArticleCardProps {
  title: string;
  slug: string;
  summary: string;
  tags: string[];
  readTime: string;
  date: string;
}

export default function ArticleCard({
  title,
  slug,
  summary,
  tags,
  readTime,
  date,
}: ArticleCardProps) {
  return (
    <Link
      to={`/article/${slug}`}
      className="surface-card group block p-5 transition-colors hover:border-accent/40"
    >
      <h3 className="mb-2 text-lg font-semibold text-white transition-colors group-hover:text-accent">
        {title}
      </h3>

      <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-muted">
        {summary}
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded border border-line bg-raised px-2 py-1 text-xs text-secondary"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {readTime}
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {date}
        </span>
      </div>
    </Link>
  )
}
