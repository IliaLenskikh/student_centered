
import React from 'react';
import { Story, ExerciseType, StudentResult } from '../types';

interface ExerciseCardProps {
  story: Story;
  type: ExerciseType;
  onClick: () => void;
  onRetry?: () => void;
  isCompleted?: boolean;
  result?: StudentResult;
  readOnly?: boolean;
}

const ExerciseCard: React.FC<ExerciseCardProps> = ({ story, type, onClick, onRetry, isCompleted, result, readOnly }) => {
  const isGraded = type !== ExerciseType.WRITING && type !== ExerciseType.SPEAKING && type !== ExerciseType.ORAL_SPEECH;

  const getThemeColors = () => {
    if (isCompleted) {
        // Completed state (White card)
        let badgeClass = '';
        switch(type) {
            case ExerciseType.GRAMMAR: badgeClass = 'bg-indigo-50 text-indigo-600 border-indigo-100'; break;
            case ExerciseType.VOCABULARY: badgeClass = 'bg-teal-50 text-teal-600 border-teal-100'; break;
            case ExerciseType.SPEAKING: badgeClass = 'bg-rose-50 text-rose-600 border-rose-100'; break;
            case ExerciseType.ORAL_SPEECH: badgeClass = 'bg-purple-50 text-purple-600 border-purple-100'; break;
            case ExerciseType.WRITING: badgeClass = 'bg-blue-50 text-blue-600 border-blue-100'; break;
            case ExerciseType.READING: badgeClass = 'bg-amber-50 text-amber-600 border-amber-100'; break;
            case ExerciseType.LISTENING: badgeClass = 'bg-cyan-50 text-cyan-600 border-cyan-100'; break;
            default: badgeClass = 'bg-gray-50 text-gray-600 border-gray-100';
        }

        return {
            card: 'bg-white border-slate-200 hover:border-indigo-300 shadow-sm opacity-90 hover:opacity-100',
            title: 'text-slate-700',
            desc: 'text-slate-400',
            badge: badgeClass,
            divider: 'border-slate-100',
            meta: 'text-slate-400',
            scoreBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100'
        };
    }

    // Not Completed state (Pastel Colored card)
    switch(type) {
        case ExerciseType.GRAMMAR: return {
            card: 'bg-indigo-100 border-indigo-200 hover:bg-indigo-200 shadow-sm hover:shadow-md',
            title: 'text-indigo-900',
            desc: 'text-indigo-800/80',
            badge: 'bg-white text-indigo-700 border-white/50 shadow-sm',
            divider: 'border-indigo-200',
            meta: 'text-indigo-600',
            scoreBg: ''
        };
        case ExerciseType.VOCABULARY: return {
            card: 'bg-teal-100 border-teal-200 hover:bg-teal-200 shadow-sm hover:shadow-md',
            title: 'text-teal-900',
            desc: 'text-teal-800/80',
            badge: 'bg-white text-teal-700 border-white/50 shadow-sm',
            divider: 'border-teal-200',
            meta: 'text-teal-600',
            scoreBg: ''
        };
        case ExerciseType.SPEAKING: return {
            card: 'bg-rose-100 border-rose-200 hover:bg-rose-200 shadow-sm hover:shadow-md',
            title: 'text-rose-900',
            desc: 'text-rose-800/80',
            badge: 'bg-white text-rose-700 border-white/50 shadow-sm',
            divider: 'border-rose-200',
            meta: 'text-rose-600',
            scoreBg: ''
        };
        case ExerciseType.ORAL_SPEECH: return {
            card: 'bg-purple-100 border-purple-200 hover:bg-purple-200 shadow-sm hover:shadow-md',
            title: 'text-purple-900',
            desc: 'text-purple-800/80',
            badge: 'bg-white text-purple-700 border-white/50 shadow-sm',
            divider: 'border-purple-200',
            meta: 'text-purple-600',
            scoreBg: ''
        };
        case ExerciseType.WRITING: return {
            card: 'bg-blue-100 border-blue-200 hover:bg-blue-200 shadow-sm hover:shadow-md',
            title: 'text-blue-900',
            desc: 'text-blue-800/80',
            badge: 'bg-white text-blue-700 border-white/50 shadow-sm',
            divider: 'border-blue-200',
            meta: 'text-blue-600',
            scoreBg: ''
        };
        case ExerciseType.READING: return {
            card: 'bg-amber-100 border-amber-200 hover:bg-amber-200 shadow-sm hover:shadow-md',
            title: 'text-amber-900',
            desc: 'text-amber-800/80',
            badge: 'bg-white text-amber-700 border-white/50 shadow-sm',
            divider: 'border-amber-200',
            meta: 'text-amber-600',
            scoreBg: ''
        };
        case ExerciseType.LISTENING: return {
            card: 'bg-cyan-100 border-cyan-200 hover:bg-cyan-200 shadow-sm hover:shadow-md',
            title: 'text-cyan-900',
            desc: 'text-cyan-800/80',
            badge: 'bg-white text-cyan-700 border-white/50 shadow-sm',
            divider: 'border-cyan-200',
            meta: 'text-cyan-600',
            scoreBg: ''
        };
        default: return {
            card: 'bg-slate-100 border-slate-200 hover:bg-slate-200 shadow-sm hover:shadow-md',
            title: 'text-slate-900',
            desc: 'text-slate-800/80',
            badge: 'bg-white text-slate-700 border-white/50 shadow-sm',
            divider: 'border-slate-200',
            meta: 'text-slate-600',
            scoreBg: ''
        };
    }
  };

  const colors = getThemeColors();

  const getPreviewText = () => {
    let text = "";
    if (type === ExerciseType.WRITING) {
        text = story.emailSubject || "Write an email...";
    } else if (type === ExerciseType.READING || type === ExerciseType.SPEAKING || type === ExerciseType.ORAL_SPEECH || type === ExerciseType.LISTENING) {
        if (story.text) text = story.text;
        else if (story.texts && story.texts.length > 0) text = story.texts[0].content;
        else if (type === ExerciseType.LISTENING) text = "Audio task. Listen and answer.";
    } else {
        text = story.template && story.template.length > 0 ? story.template[0].replace(/\{0\}/g, '...') : "Exercise details...";
    }

    // Don't repeat the title in the preview
    if (text.trim().toLowerCase() === story.title.trim().toLowerCase()) {
        return "";
    }
    return text;
  }

  const previewText = getPreviewText();

  return (
    <div 
      onClick={onClick}
      className={`${colors.card} rounded-[24px] p-6 shadow-sm border hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden h-full flex flex-col`}
    >
      {/* Main Click Area */}
      <div className="flex-1">
        <div className="flex justify-between items-start mb-4">
            <span className={`inline-block px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider ${colors.badge}`}>
                {type === ExerciseType.READING && story.questions ? 'ВЕРНО/НЕВЕРНО' : 
                 type === ExerciseType.ORAL_SPEECH ? (story.speakingType === 'interview' ? 'ИНТЕРВЬЮ' : 'МОНОЛОГ') : 
                 type === ExerciseType.GRAMMAR ? 'ГРАММАТИЧЕСКАЯ СТОРОНА РЕЧИ' :
                 type === ExerciseType.VOCABULARY ? 'ЛЕКСИЧЕСКАЯ СТОРОНА РЕЧИ' :
                 type === ExerciseType.READING ? 'СМЫСЛОВОЕ ЧТЕНИЕ' :
                 type === ExerciseType.SPEAKING ? 'ФОНЕТИЧЕСКАЯ СТОРОНА РЕЧИ' :
                 type === ExerciseType.WRITING ? 'ПИСЬМЕННАЯ РЕЧЬ' :
                 type === ExerciseType.LISTENING ? 'АУДИРОВАНИЕ' :
                 type}
            </span>
        </div>
        
        <h3 className={`font-bold text-lg md:text-xl mb-2 transition-colors leading-tight ${colors.title}`}>
          {story.title}
        </h3>
        
        {previewText && (
          <p className={`text-sm leading-relaxed line-clamp-3 mb-4 font-medium ${colors.desc}`}>
            {previewText}
          </p>
        )}
      </div>

      {isCompleted && result && (
          <div className={`pt-4 border-t flex items-center justify-between mt-auto ${colors.divider}`}>
             <span className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${colors.scoreBg}`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {isGraded ? `Score: ${result.score} / ${result.max_score}` : "Выполнено"}
             </span>
             {onRetry && (
                 <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        onRetry();
                    }}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wider transition-colors px-2 py-1"
                 >
                    Сделать повторно
                 </button>
             )}
          </div>
      )}
    </div>
  );
};

export default ExerciseCard;
