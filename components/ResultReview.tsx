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
  return (
    <div className={hideDetails ? "space-y-4" : "space-y-6"}>
      <div className={`${hideDetails ? 'p-5' : 'p-8'} rounded-[32px] border ${score/maxScore >= 0.8 ? 'bg-emerald-50/80 border-emerald-100' : 'bg-amber-50/80 border-amber-100'} shadow-sm backdrop-blur-sm`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`${hideDetails ? 'text-lg' : 'text-2xl'} font-bold text-slate-800 tracking-tight`}>Result: {score} / {maxScore}</h3>
          {hideDetails && (
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${score/maxScore >= 0.8 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {score/maxScore >= 0.8 ? "Great job!" : "Keep practicing!"}
            </span>
          )}
        </div>
        <div className="w-full bg-white/60 rounded-full h-3 mb-4 overflow-hidden shadow-inner">
           <div 
             className={`h-full rounded-full transition-all duration-1000 ease-out ${score/maxScore >= 0.8 ? 'bg-emerald-400' : 'bg-amber-400'}`} 
             style={{ width: `${maxScore > 0 ? Math.min(100, (score/maxScore)*100) : 0}%` }}
           ></div>
        </div>
        {!hideDetails && (
          <p className="text-slate-600 font-medium leading-relaxed">
              {score/maxScore >= 0.8 ? "Outstanding work! You've mastered this exercise." : "Good effort! Keep practicing to improve your score."}
          </p>
        )}
      </div>

      {!hideDetails && (
        <div className="space-y-4">
          {details.map((detail, idx) => (
          <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="font-bold text-slate-800 mb-2">{detail.question}</div>
            
            {detail.audioUrl ? (
               <div className="mt-2">
                 <audio controls src={detail.audioUrl} className="w-full" />
                 <div className="text-xs text-slate-400 mt-1 uppercase font-bold">Audio Response</div>
               </div>
            ) : detail.wordCount !== undefined ? (
               <div className="bg-slate-50 p-3 rounded-lg text-slate-700 whitespace-pre-wrap font-mono text-sm">
                 {detail.userAnswer}
                 <div className="mt-2 text-xs text-slate-400 font-bold">{detail.wordCount} words</div>
               </div>
            ) : (
               <div className="flex flex-col gap-1">
                 <div className={`flex items-center gap-2 font-medium ${detail.isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {detail.isCorrect ? (
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    ) : (
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    )}
                    <span>{detail.userAnswer || '(No Answer)'}</span>
                 </div>
                 {!detail.isCorrect && (
                    <div className="text-sm text-slate-500 pl-7">
                        Correct: <span className="font-bold">{detail.correctAnswer}</span>
                    </div>
                 )}
               </div>
            )}
          </div>
        ))}
      </div>
    )}
    </div>
  );
};
