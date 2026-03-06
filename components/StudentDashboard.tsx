import React, { useState } from 'react';
import { UserProfile, Story, ExerciseType } from '../types';
import { CategoryCard } from './CategoryCard';
import { grammarStories } from '../data/grammar';
import { vocabStories } from '../data/vocabulary';
import { readingStories } from '../data/reading';
import { readingTrueFalseStories } from '../data/readingTrueFalse';
import { listeningStories } from '../data/listening';
import { speakingStories } from '../data/speaking';
import { writingStories } from '../data/writing';
import { oralStories } from '../data/oral';
import { monologueStories } from '../data/monologue';
import { generateProgressReport } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';

interface StudentDashboardProps {
  userProfile: UserProfile;
  stats: {
    progressPercentage: number;
    totalCompleted: number;
    totalTasks: number;
  };
  onNavigate: {
    toCategory: (type: string) => void;
  };
  readOnly?: boolean;
  completedStories: Set<string>;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  userProfile,
  stats,
  onNavigate,
  readOnly,
  completedStories
}) => {
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [progressReport, setProgressReport] = useState<{ strengths: string[], weaknesses: string[], recommendations: string } | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  const allReadingStories = [...readingStories, ...readingTrueFalseStories];
  const allOralStories = [...oralStories, ...monologueStories];

  const getCategoryStats = (stories: Story[]) => {
      const completed = stories.filter(s => completedStories.has(s.title)).length;
      return { completed, total: stories.length };
  };

  const handleCategoryClick = (type: string) => {
    // Allow navigation even in readOnly mode (for teachers to view progress)
    onNavigate.toCategory(type);
  };

  const handleGenerateReport = async () => {
      setIsGeneratingReport(true);
      setShowReportModal(true);
      try {
          // Fetch recent results
          const { data: results, error } = await supabase
              .from('student_results')
              .select('*')
              .eq('student_id', userProfile.id) // Assuming userProfile has id, if not we might need to fetch it or pass it
              .order('created_at', { ascending: false })
              .limit(20);

          if (error) throw error;
          
          if (!results || results.length === 0) {
              setProgressReport({ strengths: [], weaknesses: ["No data available yet"], recommendations: "Complete some exercises first!" });
          } else {
              const report = await generateProgressReport(results);
              setProgressReport(report);
          }
      } catch (err) {
          console.error(err);
          setProgressReport({ strengths: [], weaknesses: ["Error generating report"], recommendations: "Please try again later." });
      } finally {
          setIsGeneratingReport(false);
      }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 w-full">
        {showReportModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowReportModal(false)}>
                <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col animate-fade-in-up" onClick={e => e.stopPropagation()}>
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                            <svg className="w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            ИИ Анализ Прогресса
                        </h3>
                        <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <div className="p-8 overflow-y-auto custom-scrollbar">
                        {isGeneratingReport ? (
                            <div className="flex flex-col items-center justify-center py-12 space-y-6">
                                <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                                <div className="text-center">
                                    <p className="text-lg font-bold text-slate-700 mb-2">Анализируем ваши результаты...</p>
                                    <p className="text-slate-500 text-sm">Изучаем последние задания и выявляем закономерности.</p>
                                </div>
                            </div>
                        ) : progressReport ? (
                            <div className="space-y-8">
                                <div>
                                    <h4 className="text-sm font-bold text-emerald-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        Ваши сильные стороны
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {progressReport.strengths.length > 0 ? progressReport.strengths.map((s, i) => (
                                            <span key={i} className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium border border-emerald-100">{s}</span>
                                        )) : <span className="text-slate-400 italic">Продолжайте заниматься, чтобы укрепить свои навыки!</span>}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-sm font-bold text-rose-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        Области для улучшения
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {progressReport.weaknesses.length > 0 ? progressReport.weaknesses.map((w, i) => (
                                            <span key={i} className="px-3 py-1 bg-rose-50 text-rose-700 rounded-full text-sm font-medium border border-rose-100">{w}</span>
                                        )) : <span className="text-slate-400 italic">Серьезных пробелов не обнаружено!</span>}
                                    </div>
                                </div>

                                <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100">
                                    <h4 className="text-sm font-bold text-indigo-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        Рекомендация ИИ
                                    </h4>
                                    <p className="text-indigo-900/80 leading-relaxed">{progressReport.recommendations}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-slate-500">Отчет недоступен.</div>
                        )}
                    </div>
                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                        <button onClick={() => setShowReportModal(false)} className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors">Закрыть</button>
                    </div>
                </div>
            </div>
        )}

        <div className="mb-8 flex flex-col md:flex-row items-end justify-between gap-4">
            <div>
                <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-2 tracking-tight">
                Привет, {userProfile.name || 'Студент'}! 👋
                </h1>
                <p className="text-slate-500 font-medium max-w-3xl leading-relaxed">
                Все материалы, представленные здесь, являются официальными материалами, одобренными ФИПИ для подготовки к Основному государственному экзамену (ОГЭ) по английскому языку.
                </p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Total Progress Card - Purple Gradient */}
            <div className="md:col-span-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[160px]">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-400/20 rounded-full -ml-10 -mb-10 blur-xl"></div>
                
                <div className="relative z-10 flex items-start justify-between">
                    <div>
                        <h2 className="text-xl font-bold mb-1">Ваш прогресс</h2>
                        <p className="text-indigo-100 text-xs font-medium opacity-90">Продолжайте в том же духе!</p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                        <span className="text-[10px] font-bold tracking-wider uppercase">{stats.progressPercentage}% Завершено</span>
                    </div>
                </div>

                <div className="relative z-10 mt-4">
                    <div className="flex items-end gap-2 mb-2">
                        <span className="text-4xl font-bold">{stats.totalCompleted}</span>
                        <span className="text-sm text-indigo-200 font-medium mb-1.5">/ {stats.totalTasks} заданий</span>
                    </div>
                    <div className="w-full bg-black/20 rounded-full h-1.5 overflow-hidden">
                        <div 
                            className="bg-white h-full rounded-full transition-all duration-1000 ease-out" 
                            style={{ width: `${stats.progressPercentage}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* AI Analysis Card - White with colorful accents */}
            <button 
                onClick={handleGenerateReport}
                className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all group relative overflow-hidden text-left flex flex-col justify-between min-h-[160px]"
            >
                <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity group-hover:scale-110 duration-300">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </div>
                </div>
                
                <div>
                    <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-500 mb-3">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-0.5">ИИ Анализ</h3>
                    <p className="text-slate-500 text-xs">Получите персональные рекомендации</p>
                </div>

                <div className="mt-2 flex items-center gap-2 text-indigo-600 font-bold text-xs group-hover:translate-x-1 transition-transform">
                    Посмотреть отчет
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </div>
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <CategoryCard 
                title="Грамматическая сторона речи" 
                subtitle="Прочитайте текст и выполните задания." 
                stats={getCategoryStats(grammarStories)} 
                onClick={() => handleCategoryClick('grammar')}
                colorClass="text-indigo-600 bg-indigo-50"
                delay={0}
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>}
                readOnly={readOnly}
            />
            <CategoryCard 
                title="Лексическая сторона речи" 
                subtitle="Словообразование" 
                stats={getCategoryStats(vocabStories)}
                onClick={() => handleCategoryClick('vocabulary')}
                colorClass="text-teal-600 bg-teal-50"
                delay={100}
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.638 1.638 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.638 1.638 0 00-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.401.604-.401.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0c.31 0 .555-.26.532-.57a48.039 48.039 0 01-.642-5.056c-1.518-.19-3.057-.309-4.616-.354a.64.64 0 00-.657.643v0z" /></svg>}
                readOnly={readOnly}
            />
            <CategoryCard 
                title="Смысловое чтение" 
                subtitle="Понимание текста" 
                stats={getCategoryStats(allReadingStories)}
                onClick={() => handleCategoryClick('reading')}
                colorClass="text-amber-600 bg-amber-50"
                delay={200}
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>}
                readOnly={readOnly}
            />
            <CategoryCard 
                title="Аудирование" 
                subtitle="Задания по аудированию" 
                stats={getCategoryStats(listeningStories)}
                onClick={() => handleCategoryClick('listening')}
                colorClass="text-cyan-600 bg-cyan-50"
                delay={250}
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>}
                readOnly={readOnly}
            />
            <CategoryCard 
                title="Фонетическая сторона речи" 
                subtitle="Чтение вслух" 
                stats={getCategoryStats(speakingStories)}
                onClick={() => handleCategoryClick('speaking')}
                colorClass="text-rose-600 bg-rose-50"
                delay={300}
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>}
                readOnly={readOnly}
            />
            <CategoryCard 
                title="Говорение" 
                subtitle="Дайте развернутый ответ." 
                stats={getCategoryStats(allOralStories)}
                onClick={() => handleCategoryClick('oral')}
                colorClass="text-purple-600 bg-purple-50"
                delay={400}
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" /></svg>}
                readOnly={readOnly}
            />
            <CategoryCard 
                title="Письменная речь" 
                subtitle="Личное электронное письмо" 
                stats={getCategoryStats(writingStories)}
                onClick={() => handleCategoryClick('writing')}
                colorClass="text-blue-600 bg-blue-50"
                delay={500}
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>}
                readOnly={readOnly}
            />
            <CategoryCard 
                title="Тестовый экзамен" 
                subtitle="Полный вариант ОГЭ" 
                stats={{ completed: 0, total: 1 }}
                onClick={() => handleCategoryClick('exam')}
                colorClass="text-slate-600 bg-slate-100"
                delay={600}
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                readOnly={readOnly}
            />
        </div>
    </div>
  );
};
