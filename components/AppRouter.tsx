import React from 'react';
import { Routes, Route, Navigate, useParams, useLocation, useNavigate } from 'react-router-dom';
import { 
  Story, 
  ExerciseType, 
  UserProfile, 
  AttemptDetail
} from '../types';
import ExerciseView from './ExerciseView';
import { StudentDashboard } from './StudentDashboard';
import { grammarStories } from '../data/grammar';
import { vocabStories } from '../data/vocabulary';
import { readingStories } from '../data/reading';
import { readingTrueFalseStories } from '../data/readingTrueFalse';
import { speakingStories } from '../data/speaking';
import { writingStories } from '../data/writing';
import { oralStories } from '../data/oral';
import { monologueStories } from '../data/monologue';
import { listeningStories } from '../data/listening';
import { CategoryCard } from './CategoryCard';
import { ExerciseList } from './ExerciseList';
import { getErrorMessage } from '../utils/errorHandling';

const allReadingStories = [...readingStories, ...readingTrueFalseStories];
const allOralStories = [...oralStories, ...monologueStories];

const allStories = [
  ...grammarStories.map(s => ({ ...s, type: ExerciseType.GRAMMAR })),
  ...vocabStories.map(s => ({ ...s, type: ExerciseType.VOCABULARY })),
  ...allReadingStories.map(s => ({ ...s, type: ExerciseType.READING })),
  ...speakingStories.map(s => ({ ...s, type: ExerciseType.SPEAKING })),
  ...allOralStories.map(s => ({ ...s, type: ExerciseType.ORAL_SPEECH })),
  ...writingStories.map(s => ({ ...s, type: ExerciseType.WRITING })),
  ...listeningStories.map(s => ({ ...s, type: ExerciseType.LISTENING })),
];

interface AppRouterProps {
  userProfile: UserProfile;
  setUserProfile: (profile: UserProfile | null) => void;
  loading: boolean;
  
  // Auth props
  authError: string | null;
  authSuccessMsg: string | null;
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  newPassword: string;
  setNewPassword: (password: string) => void;
  isLoginMode: boolean;
  setIsLoginMode: (mode: boolean) => void;
  handleAuthSubmit: (e: React.FormEvent) => Promise<void>;
  handlePasswordResetSubmit: (e: React.FormEvent) => Promise<void>;
  handleSettingsSave: (e: React.FormEvent) => Promise<void>;
  handleLogoutSubmit: () => Promise<void>;
  
  // Navigation/Exercise props
  goHome: () => void;
  startExercise: (story: Story, type: ExerciseType) => void;
  completedStories: Set<string>;
  userResults: Record<string, StudentResult>;
  handleStoryComplete: (title: string, type: ExerciseType, score: number, maxScore: number, details: AttemptDetail[]) => Promise<void>;
  
  // Stats
  progressPercentage: number;
  totalCompleted: number;
  totalTasks: number;
}

import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { StudentResult } from '../types';

const ExerciseRouteWrapper: React.FC<AppRouterProps> = (props) => {
  const { type, title } = useParams<{ type: string; title: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const source = location.state?.source || 'CATALOG';

  const decodedTitle = decodeURIComponent(title || '');
  const exerciseType = type as ExerciseType;
  
  const story = allStories.find(s => s.title === decodedTitle && s.type === exerciseType);

  const [previousResult, setPreviousResult] = useState<StudentResult | null>(null);

  useEffect(() => {
      const fetchResult = async () => {
          if (!props.userProfile?.id || !story) return;
          
          const targetStudentId = props.userProfile.id;

          const { data } = await supabase
              .from('student_results')
              .select('*')
              .eq('student_id', targetStudentId)
              .eq('exercise_title', story.title)
              .eq('exercise_type', exerciseType)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();
          
          if (data) {
              setPreviousResult(data as StudentResult);
          } else {
              setPreviousResult(null);
          }
      };
      
      fetchResult();
  }, [story, exerciseType, props.userProfile.id]);

  if (!story) return <div className="p-8 text-center text-slate-500">Story not found</div>;

  return (
    <ExerciseView 
      story={story} 
      type={exerciseType}
      onBack={() => {
        navigate(`/exercise/${type}`);
      }}
      onComplete={(score, maxScore, details) => props.handleStoryComplete(story.title, exerciseType, score, maxScore, details)}
      userProfile={props.userProfile}
      readOnly={false}
      previousResult={previousResult}
    />
  );
};

export const AppRouter: React.FC<AppRouterProps> = (props) => {
  const navigate = useNavigate();
  const {
    userProfile,
    setUserProfile,
    loading,
    authError,
    authSuccessMsg,
    email,
    setEmail,
    password,
    setPassword,
    newPassword,
    setNewPassword,
    isLoginMode,
    setIsLoginMode,
    handleAuthSubmit,
    handlePasswordResetSubmit,
    handleSettingsSave,
    handleLogoutSubmit,
    goHome,
    startExercise,
    completedStories,
    userResults,
    handleStoryComplete,
    progressPercentage,
    totalCompleted,
    totalTasks
  } = props;

  const renderExerciseList = (stories: Story[], type: ExerciseType) => {
    return (
      <ExerciseList 
        stories={stories} 
        type={type} 
        completedStories={completedStories} 
        userResults={userResults}
        onStartExercise={startExercise} 
        onGoHome={goHome} 
        readOnly={false}
      />
    );
  };

  return (
    <Routes>
      <Route path="/auth" element={
        userProfile.id ? <Navigate to="/" /> : (
        <div className="flex items-center justify-center min-h-[calc(100vh-60px)] p-4">
          <div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl w-full max-w-md border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
            <div className="text-center mb-10">
              <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Welcome Back</h1>
              <p className="text-slate-500">Sign in to continue your progress</p>
            </div>
            
            {authError && (
              <div className="bg-rose-50 text-rose-600 p-4 rounded-xl mb-6 text-sm flex items-center gap-2 border border-rose-100">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {authError}
              </div>
            )}
            {authSuccessMsg && (
              <div className="bg-emerald-50 text-emerald-600 p-4 rounded-xl mb-6 text-sm flex items-center gap-2 border border-emerald-100">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {authSuccessMsg}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-5">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>
                </div>
                <input 
                  type="email" 
                  placeholder="Email" 
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2V-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <input 
                  type="password" 
                  placeholder="Password" 
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-all shadow-lg active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                {isLoginMode ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <div className="mt-8 text-center space-y-3">
              <button onClick={() => setIsLoginMode(!isLoginMode)} className="text-slate-500 hover:text-slate-800 text-sm font-medium transition-colors">
                {isLoginMode ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
              </button>
              <div className="block">
                <button onClick={() => navigate('/forgot-password')} className="text-indigo-500 hover:text-indigo-700 text-xs font-bold transition-colors">
                  Forgot Password?
                </button>
              </div>
            </div>
          </div>
        </div>
        )
      } />

      <Route path="/forgot-password" element={
        <div className="flex items-center justify-center min-h-[calc(100vh-60px)] p-4">
          <div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl w-full max-w-md border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
            <div className="text-center mb-10">
              <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Reset Password</h1>
              <p className="text-slate-500">Enter your email to receive a reset link</p>
            </div>
            
            {authError && (
              <div className="bg-rose-50 text-rose-600 p-4 rounded-xl mb-6 text-sm flex items-center gap-2 border border-rose-100">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {authError}
              </div>
            )}
            {authSuccessMsg && (
              <div className="bg-emerald-50 text-emerald-600 p-4 rounded-xl mb-6 text-sm flex items-center gap-2 border border-emerald-100">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {authSuccessMsg}
              </div>
            )}

            <form onSubmit={handlePasswordResetSubmit} className="space-y-5">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>
                </div>
                <input 
                  type="email" 
                  placeholder="Email" 
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-all shadow-lg active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                Send Reset Link
              </button>
            </form>

            <div className="mt-8 text-center space-y-3">
              <button onClick={() => navigate('/auth')} className="text-slate-500 hover:text-slate-800 text-sm font-medium transition-colors">
                Back to Sign In
              </button>
            </div>
          </div>
        </div>
      } />

      <Route path="/role-selection" element={<Navigate to="/" replace />} />

      <Route path="/settings" element={
        <div className="flex items-center justify-center min-h-[calc(100vh-60px)] p-4">
          <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-lg border border-slate-100">
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-slate-900">Settings</h2>
                <button onClick={goHome} className="text-slate-400 hover:text-slate-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            
            <form onSubmit={handleSettingsSave} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Full Name</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-medium"
                  value={userProfile.name}
                  onChange={(e) => setUserProfile({...userProfile, name: e.target.value})}
                />
              </div>
              
              <div className="pt-4 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Change Password</label>
                  <input 
                    type="password" 
                    placeholder="New Password"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none font-medium"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
              </div>

              <div className="flex gap-4 pt-4">
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg active:scale-95"
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button 
                    type="button"
                    onClick={handleLogoutSubmit}
                    className="px-6 py-3 bg-rose-50 text-rose-600 font-bold rounded-xl hover:bg-rose-100 transition-colors"
                  >
                    Log Out
                  </button>
              </div>
            </form>
          </div>
        </div>
      } />

      <Route path="/" element={
        !userProfile.id ? <Navigate to="/auth" /> :
        (
          <div className="max-w-7xl mx-auto px-4 py-8 w-full">
            <StudentDashboard 
                userProfile={userProfile}
                stats={{
                    progressPercentage: progressPercentage,
                    totalCompleted: totalCompleted,
                    totalTasks: totalTasks
                }}
                completedStories={completedStories}
                onNavigate={{
                    toCategory: (type) => navigate(`/exercise/${type}`)
                }}
            />
          </div>
        )
      } />

      <Route path="/exercise/grammar" element={renderExerciseList(grammarStories, ExerciseType.GRAMMAR)} />
      <Route path="/exercise/vocabulary" element={renderExerciseList(vocabStories, ExerciseType.VOCABULARY)} />
      <Route path="/exercise/reading" element={renderExerciseList(allReadingStories, ExerciseType.READING)} />
      <Route path="/exercise/listening" element={renderExerciseList(listeningStories, ExerciseType.LISTENING)} />
      <Route path="/exercise/speaking" element={renderExerciseList(speakingStories, ExerciseType.SPEAKING)} />
      <Route path="/exercise/oral" element={renderExerciseList(allOralStories, ExerciseType.ORAL_SPEECH)} />
      <Route path="/exercise/writing" element={renderExerciseList(writingStories, ExerciseType.WRITING)} />

      <Route path="/exercise/:type/:title" element={<ExerciseRouteWrapper {...props} />} />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};
