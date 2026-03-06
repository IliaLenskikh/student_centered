import React from 'react';
import { Story, ExerciseType, StudentResult } from '../types';
import ExerciseCard from './ExerciseCard';

interface ExerciseListProps {
  stories: Story[];
  type: ExerciseType;
  completedStories: Set<string>;
  userResults: Record<string, StudentResult>;
  onStartExercise: (story: Story, type: ExerciseType, mode?: 'review' | 'retry') => void;
  onGoHome: () => void;
  readOnly?: boolean;
}

export const ExerciseList: React.FC<ExerciseListProps> = ({
  stories,
  type,
  completedStories,
  userResults,
  onStartExercise,
  onGoHome,
  readOnly,
}) => {
  let title = 'Грамматическая сторона речи';
  let subtitle = 'Прочитайте текст и выполните задания.';
  let instruction = '';
  
  if (type === ExerciseType.GRAMMAR) {
    instruction = 'Прочитайте приведённый ниже текст. Преобразуйте слова, напечатанные заглавными буквами в конце строк, обозначенных номерами 20–28, так, чтобы они грамматически соответствовали содержанию текста. Заполните пропуски полученными словами. Каждый пропуск соответствует отдельному заданию 20–28.';
  }
  if (type === ExerciseType.VOCABULARY) {
    title = 'Лексическая сторона речи';
    subtitle = 'Словообразование';
  }
  if (type === ExerciseType.READING) {
    title = 'Смысловое чтение';
    subtitle = 'Понимание текста';
  }
  if (type === ExerciseType.LISTENING) {
    title = 'Аудирование';
    subtitle = 'Задания по аудированию';
  }
  if (type === ExerciseType.SPEAKING) {
    title = 'Фонетическая сторона речи';
    subtitle = 'Чтение вслух';
  }
  if (type === ExerciseType.ORAL_SPEECH) {
    title = 'Говорение';
    subtitle = 'Дайте развернутый ответ.';
  }
  if (type === ExerciseType.WRITING) {
    title = 'Письменная речь';
    subtitle = 'Личное электронное письмо';
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center mb-10 justify-between">
        <div className="flex items-center gap-6">
          <button
            onClick={onGoHome}
            className="w-12 h-12 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all shadow-sm flex items-center justify-center group"
          >
            <svg
              className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </button>
          <div className="flex flex-col gap-4 max-w-5xl">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
              {title}
            </h2>
            {instruction && (
              <div className="relative max-w-4xl">
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-indigo-500/10 rounded-full"></div>
                <p className="text-slate-400 text-[11px] md:text-xs leading-relaxed font-normal pl-6 italic tracking-wide font-serif">
                  {instruction}
                </p>
              </div>
            )}
            {type !== ExerciseType.GRAMMAR && (
              <p className="text-slate-500 font-medium text-lg">{subtitle}</p>
            )}
          </div>
        </div>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {stories.map((story, idx) => {
          const isCompleted = completedStories.has(story.title);
          const result = userResults[story.title];
          
          // Only treat as completed if we have the result data to show the score
          const showAsCompleted = isCompleted && !!result;

          return (
            <div key={idx} className={`relative rounded-2xl transition-all`}>
              <ExerciseCard
                story={story}
                type={type}
                onClick={() => onStartExercise(story, type, 'review')}
                onRetry={() => onStartExercise(story, type, 'retry')}
                isCompleted={showAsCompleted}
                result={result}
                readOnly={readOnly}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
