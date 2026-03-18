import React from 'react';
import { AttemptDetail, ExerciseType } from '../types';

interface ResultReviewProps {
  details: AttemptDetail[];
  score: number;
  maxScore: number;
  type: ExerciseType;
  hideDetails?: boolean;
}

export const ResultReview: React.FC<ResultReviewProps> = ({ details, score, maxScore, type, hideDetails }) => {
  const isGraded = type !== ExerciseType.WRITING && type !== ExerciseType.SPEAKING && type !== ExerciseType.ORAL_SPEECH;
  const hasScore = score > 0;

  return (
    <div>
      <div className={`${hideDetails ? 'p-5' : 'p-8'} rounded-[32px] border ${(!isGraded && !hasScore) || score/maxScore >= 0.8 ? 'bg-emerald-50/80 border-emerald-100' : 'bg-amber-50/80 border-amber-100'} shadow-sm backdrop-blur-sm`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`${hideDetails ? 'text-lg' : 'text-2xl'} font-bold text-slate-800 tracking-tight`}>
            {isGraded || hasScore ? `Result: ${score} / ${maxScore}` : "Выполнено"}
          </h3>
          {hideDetails && (
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${(!isGraded && !hasScore) || score/maxScore >= 0.8 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {(!isGraded && !hasScore) ? "Completed" : score/maxScore >= 0.8 ? "Great job!" : "Keep practicing!"}
            </span>
          )}
        </div>
        <div className="w-full bg-white/60 rounded-full h-3 mb-4 overflow-hidden shadow-inner">
           <div 
             className={`h-full rounded-full transition-all duration-1000 ease-out ${(!isGraded && !hasScore) || score/maxScore >= 0.8 ? 'bg-emerald-400' : 'bg-amber-400'}`} 
             style={{ width: `${(!isGraded && !hasScore) ? 100 : maxScore > 0 ? Math.min(100, (score/maxScore)*100) : 0}%` }}
           ></div>
        </div>
        {!hideDetails && (
          <p className="text-slate-600 font-medium leading-relaxed">
              {(!isGraded && !hasScore) 
                ? "Exercise completed successfully. Pending teacher review."
                : score/maxScore >= 0.8 ? "Outstanding work! You've mastered this exercise." : "Good effort! Keep practicing to improve your score."}
          </p>
        )}
      </div>
    </div>
  );
};
