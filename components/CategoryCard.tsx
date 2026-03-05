import React from 'react';

interface CategoryCardProps {
  title: string;
  subtitle: string;
  count?: number;
  onClick: () => void;
  colorClass: string;
  icon: React.ReactNode;
  delay: number;
  badge?: string;
  stats?: { completed: number; total: number };
  readOnly?: boolean;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  title,
  subtitle,
  onClick,
  colorClass,
  icon,
  delay,
  badge,
  stats,
  readOnly,
}) => {
  // Extract background color from colorClass (e.g., "bg-indigo-50")
  const bgColorMatch = colorClass.match(/bg-[a-z]+-50/);
  const bgColor = bgColorMatch ? bgColorMatch[0] : 'bg-white';
  
  // Extract text color from colorClass (e.g., "text-indigo-600")
  const textColorMatch = colorClass.match(/text-[a-z]+-600/);
  const textColor = textColorMatch ? textColorMatch[0] : 'text-slate-600';

  return (
    <div
      onClick={onClick}
      className={`${bgColor} p-6 md:p-8 rounded-[32px] shadow-sm flex flex-col items-start gap-4 h-full group relative hover:shadow-md transition-all duration-300 cursor-pointer ${readOnly ? 'opacity-90' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="absolute top-6 right-6 flex items-center gap-2">
        {stats && (
          <div className="bg-white/60 backdrop-blur-sm text-slate-600 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                stats.completed === stats.total && stats.total > 0
                  ? 'bg-emerald-500'
                  : 'bg-slate-400'
              }`}
            ></span>
            {stats.completed}/{stats.total}
          </div>
        )}
        {badge && (
          <div className="bg-rose-500 text-white text-xs font-bold px-3 py-1.5 rounded-full animate-bounce shadow-sm">
            {badge}
          </div>
        )}
      </div>

      <div
        className={`p-4 rounded-2xl bg-white/80 backdrop-blur-sm ${textColor} shadow-sm transition-transform group-hover:scale-110`}
      >
        {icon}
      </div>

      <div className="mt-auto pt-4 w-full flex items-end justify-between">
        <div>
          <p className={`text-xs font-bold ${textColor} uppercase tracking-wider mb-1`}>{subtitle}</p>
          <h3 className="text-xl md:text-2xl font-bold text-slate-800 leading-tight">
            {title}
          </h3>
        </div>
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm group-hover:bg-slate-800 group-hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
        </div>
      </div>
    </div>
  );
};
