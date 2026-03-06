import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export const ExamDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { showToast } = useToast();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasActiveExam, setHasActiveExam] = useState(false);

  useEffect(() => {
    const activeExam = localStorage.getItem('exam_data');
    if (activeExam) {
      setHasActiveExam(true);
    }
    
    const fetchSubmissions = async () => {
      if (!userProfile?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('exam_submissions')
          .select('*')
          .eq('student_id', userProfile.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setSubmissions(data || []);
      } catch (error) {
        console.error('Error fetching exam submissions:', error);
        showToast('Ошибка при загрузке истории экзаменов', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissions();
  }, [userProfile?.id]);

  const handleStartNewExam = () => {
    if (hasActiveExam) {
      const confirm = window.confirm("У вас есть незаконченный экзамен. Вы уверены, что хотите начать новый? Текущий прогресс будет потерян.");
      if (!confirm) return;
    }
    // Clear any existing exam state before starting a new one
    localStorage.removeItem('exam_answers');
    localStorage.removeItem('exam_current_spread');
    localStorage.removeItem('exam_time_remaining');
    localStorage.removeItem('exam_data');
    navigate('/exam/start');
  };

  const handleContinueExam = () => {
    navigate('/exam/start');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 w-full">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate('/')}
          className="p-2 hover:bg-slate-200 rounded-full transition-colors"
        >
          <svg className="w-6 h-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="text-3xl font-bold text-slate-900">Тестовые экзамены</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Continue Exam Card */}
        {hasActiveExam && (
          <div 
            onClick={handleContinueExam}
            className="bg-amber-50 border-2 border-dashed border-amber-300 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-amber-100 hover:border-amber-400 transition-all min-h-[200px]"
          >
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-amber-900 mb-2">Продолжить экзамен</h3>
            <p className="text-amber-700 text-sm">У вас есть незаконченный вариант</p>
          </div>
        )}

        {/* Start New Exam Card */}
        <div 
          onClick={handleStartNewExam}
          className="bg-indigo-50 border-2 border-dashed border-indigo-300 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-indigo-100 hover:border-indigo-400 transition-all min-h-[200px]"
        >
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-indigo-900 mb-2">Начать новый экзамен</h3>
          <p className="text-indigo-700 text-sm">Случайный вариант из базы заданий</p>
        </div>

        {/* Past Exams */}
        {loading ? (
          <div className="col-span-1 md:col-span-2 lg:col-span-2 flex justify-center items-center">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          submissions.map((sub, index) => (
            <div 
              key={sub.id}
              className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col min-h-[200px]"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center font-bold text-xl">
                  #{submissions.length - index}
                </div>
                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                  Завершен
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">
                Вариант от {new Date(sub.created_at).toLocaleDateString('ru-RU')}
              </h3>
              <p className="text-slate-500 text-sm mb-auto">
                {new Date(sub.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </p>
              <button 
                onClick={() => navigate(`/exam/${sub.id}`)}
                className="mt-4 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
              >
                Посмотреть результаты
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
