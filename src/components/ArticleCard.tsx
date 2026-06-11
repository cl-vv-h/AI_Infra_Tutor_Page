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
      className="group block rounded-lg border border-white/10 bg-[#1a1f35] p-6 transition-all duration-300 hover:border-[#00d4ff]/40 hover:shadow-lg hover:shadow-[#00d4ff]/5"
    >
      <h3 className="mb-2 text-lg font-semibold text-white transition-colors group-hover:text-[#00d4ff]">
        {title}
      </h3>

      <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-gray-400">
        {summary}
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-[#00d4ff]/10 px-2.5 py-0.5 text-xs text-[#00d4ff]"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500">
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
