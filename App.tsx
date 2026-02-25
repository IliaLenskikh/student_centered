
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isTableNotFoundError } from './services/errorMapper';
import { 
  Story, 
  ExerciseType, 
  UserProfile, 
  StudentResult, 
  AttemptDetail
} from './types';
import ExerciseView from './components/ExerciseView';
import { AppRouter } from './components/AppRouter';
import { grammarStories } from './data/grammar';
import { vocabStories } from './data/vocabulary';
import { readingStories } from './data/reading';
import { readingTrueFalseStories } from './data/readingTrueFalse';
import { speakingStories } from './data/speaking';
import { writingStories } from './data/writing';
import { oralStories } from './data/oral';
import { monologueStories } from './data/monologue';
import { listeningStories } from './data/listening';
import { supabase } from './services/supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

import { useAuth } from './contexts/AuthContext';
import { useToast } from './contexts/ToastContext';
import { getErrorMessage } from './utils/errorHandling';

const allReadingStories = [...readingStories, ...readingTrueFalseStories];
const allOralStories = [...oralStories, ...monologueStories];

const allStories: (Story & { type: ExerciseType })[] = [
  ...grammarStories.map(s => ({ ...s, type: ExerciseType.GRAMMAR })),
  ...vocabStories.map(s => ({ ...s, type: ExerciseType.VOCABULARY })),
  ...allReadingStories.map(s => ({ ...s, type: ExerciseType.READING })),
  ...speakingStories.map(s => ({ ...s, type: ExerciseType.SPEAKING })),
  ...allOralStories.map(s => ({ ...s, type: ExerciseType.ORAL_SPEECH })),
  ...writingStories.map(s => ({ ...s, type: ExerciseType.WRITING })),
  ...listeningStories.map(s => ({ ...s, type: ExerciseType.LISTENING })),
];

export default function App() {
  const {
    userProfile: authProfile,
    isAuthChecking,
    isProfileLoading,
    authError,
    authSuccessMsg,
    handleAuth: contextHandleAuth,
    handleLogout: contextHandleLogout,
    handlePasswordReset: contextHandlePasswordReset,
    setAuthError,
    setAuthSuccessMsg,
    setUserProfile,
    profileError,
    retryProfileLoad
  } = useAuth();

  const userProfile = authProfile || { name: '', email: '' };

  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(false);
  const [completedStories, setCompletedStories] = useState<Set<string>>(new Set());
  
  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState(''); 
  const [fullName, setFullName] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(false);
  
  const totalTasks = allStories.length;

  useEffect(() => {
    if (authSuccessMsg === "Please set a new password below.") {
      navigate('/settings');
    }
  }, [authSuccessMsg, navigate]);

  useEffect(() => {
    if (isAuthChecking || isProfileLoading || profileError) return;

    const currentPath = location.pathname;

    if (!authProfile) {
      if (currentPath !== '/auth' && currentPath !== '/forgot-password') {
        navigate('/auth');
      }
    } else {
      if (currentPath === '/auth' || currentPath === '/forgot-password') {
        navigate('/');
      }
    }
  }, [authProfile?.id, isAuthChecking, isProfileLoading, navigate, location.pathname]);

  useEffect(() => {
    if (authProfile?.id) {
      setCompletedStories(new Set(authProfile.completed_stories || []));
    }
  }, [authProfile?.id]);



  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    setLoading(true);
    try {
      await contextHandleAuth(email, password, isLoginMode);
    } catch (error: any) {
      // Error is handled in context
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await contextHandlePasswordReset(email);
    } catch (error: any) {
      // Error handled in context
    } finally {
      setLoading(false);
    }
  };



  const handleSettingsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            full_name: userProfile.name
          }, { onConflict: 'id' });

        if (error) throw error;

        setUserProfile(prev => prev ? { ...prev, name: userProfile.name } : null);

        if (newPassword) {
            const { error: pwdError } = await supabase.auth.updateUser({ password: newPassword });
            if (pwdError) throw pwdError;
            setNewPassword('');
            showToast("Settings and Password updated!", "success");
        } else {
            showToast("Settings saved!", "success");
        }
      }
    } catch (error: any) {
      showToast(getErrorMessage(error), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleStoryComplete = async (title: string, type: ExerciseType, score: number, maxScore: number, details: AttemptDetail[]) => {
    const newSet = new Set(completedStories);
    newSet.add(title);
    setCompletedStories(newSet);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').upsert({
            id: user.id,
            completed_stories: Array.from(newSet)
        }, { onConflict: 'id' });

        if (title) {
            await supabase.from('student_results').insert({
                student_id: user.id,
                exercise_title: title,
                exercise_type: type,
                score: score,
                max_score: maxScore,
                details: details
            });
        }
      }
    } catch (error) {
      console.error('Failed to save progress', error);
    }
  };

  const startExercise = (story: Story, type: ExerciseType) => {
    navigate(`/exercise/${type}/${encodeURIComponent(story.title)}`);
  };

  const goHome = () => {
    navigate('/');
  };

  const handleLogoutSubmit = async () => {
    await contextHandleLogout();
    navigate('/auth');
    setCompletedStories(new Set());
    setEmail('');
    setPassword('');
    setFullName('');
  };

  const totalCompleted = completedStories.size;
  const progressPercentage = Math.round((totalCompleted / totalTasks) * 100) || 0;

  const getCategoryStats = (stories: Story[]) => {
      const total = stories.length;
      const completed = stories.filter(s => completedStories.has(s.title)).length;
      return { completed, total };
  };
  
  const learningBackground = {
    backgroundColor: '#f8fafc',
    backgroundImage: `
      linear-gradient(rgba(99, 102, 241, 0.05) 1px, transparent 1px), 
      linear-gradient(90deg, rgba(99, 102, 241, 0.05) 1px, transparent 1px)
    `,
    backgroundSize: '30px 30px',
    backgroundPosition: 'center center'
  };

  if (isAuthChecking || isProfileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" style={learningBackground}>
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-10 w-10 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-slate-500 font-medium animate-pulse">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" style={learningBackground}>
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-rose-100">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Connection Error</h2>
          <p className="text-slate-500 mb-6">{profileError}</p>
          <button 
            onClick={() => retryProfileLoad()}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg active:scale-95 w-full"
          >
            Retry Connection
          </button>
          <button 
            onClick={() => contextHandleLogout()}
            className="mt-4 text-slate-400 hover:text-slate-600 text-sm font-medium"
          >
            Log Out
          </button>
        </div>
      </div>
    );
  }

  return (
      <div className="min-h-screen flex flex-col font-sans text-slate-900 bg-slate-50 relative overflow-hidden" style={learningBackground}>
          
          <div className="flex-1 overflow-y-auto relative z-10 flex flex-col">
            <AppRouter
              userProfile={userProfile}
              setUserProfile={setUserProfile}
              loading={loading}
              authError={authError}
              authSuccessMsg={authSuccessMsg}
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              newPassword={newPassword}
              setNewPassword={setNewPassword}
              isLoginMode={isLoginMode}
              setIsLoginMode={setIsLoginMode}
              handleAuthSubmit={handleAuthSubmit}
              handlePasswordResetSubmit={handlePasswordResetSubmit}
              handleSettingsSave={handleSettingsSave}
              handleLogoutSubmit={handleLogoutSubmit}
              goHome={goHome}
              startExercise={startExercise}
              completedStories={completedStories}
              handleStoryComplete={handleStoryComplete}
              progressPercentage={progressPercentage}
              totalCompleted={totalCompleted}
              totalTasks={totalTasks}
            />
          </div>

          {userProfile.id && !location.pathname.includes('/exercise/') && location.pathname !== '/settings' && location.pathname !== '/auth' && location.pathname !== '/forgot-password' && (
             <div className="fixed bottom-6 left-6 z-50">
                 <button 
                    onClick={() => navigate('/settings')}
                    className="w-12 h-12 bg-white/90 backdrop-blur rounded-full shadow-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-all hover:scale-110 active:scale-95"
                    title="Settings"
                 >
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                 </button>
             </div>
          )}
      </div>
  );
}
