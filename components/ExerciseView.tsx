
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Story, ExerciseType, UserProgress, ValidationState, UserProfile, AttemptDetail, StudentResult } from '../types';
import { getExplanation, getWritingSuggestions, getSpeakingSuggestion, evaluateSpeaking, evaluateReadAloud } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import { saveInputs, loadInputs, saveAudioAttempt, loadAudioAttempts, clearAudioAttempts, clearInputs } from '../services/storageService';
import { ResultReview } from './ResultReview';

interface ExerciseViewProps {
  story: Story;
  type: ExerciseType;
  onBack: () => void;
  onComplete: (score: number, maxScore: number, details: AttemptDetail[]) => void;
  userProfile?: UserProfile;
  readOnly?: boolean;
  initialInputs?: Record<string, string>;
  isLiveMonitoring?: boolean;
  history?: StudentResult[];
  initialMode?: 'review' | 'retry';
}

const ExerciseView: React.FC<ExerciseViewProps> = ({ story, type, onBack, onComplete, userProfile, readOnly, initialInputs, isLiveMonitoring, history = [], initialMode = 'review' }) => {
  // --- Safety Guard: Ensure story exists ---
  if (!story) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
        <div className="bg-rose-50 text-rose-600 p-6 rounded-2xl border border-rose-100 shadow-sm max-w-md">
          <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          <h3 className="text-lg font-bold mb-2">Exercise Data Missing</h3>
          <p className="text-sm mb-6">We couldn't load the details for this exercise. It might have been removed or there was a connection error.</p>
          <button onClick={onBack} className="bg-rose-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-rose-700 transition-colors">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const [inputs, setInputs] = useState<UserProgress>(initialInputs || {});
  const [validation, setValidation] = useState<ValidationState>({});
  const [showResults, setShowResults] = useState(false);
  
  // History / Retry Logic
  const [viewingResult, setViewingResult] = useState<StudentResult | null>(null);
  
  // History Dropdown State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const historyDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (historyDropdownRef.current && !historyDropdownRef.current.contains(event.target as Node)) {
        setIsHistoryOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
      // On mount or history change, decide what to show
      if (history && history.length > 0) {
          if (initialMode === 'retry') {
              setViewingResult(null);
          } else {
              setViewingResult(history[0]);
          }
      } else {
          setViewingResult(null);
      }
  }, [history, initialMode]);

  useEffect(() => {
      if (initialInputs) {
          setInputs(initialInputs);
      } else if (!readOnly && !viewingResult) {
          // Load saved progress
          const savedInputs = loadInputs(story.title);
          if (savedInputs) {
              setInputs(prev => ({ ...prev, ...savedInputs }));
              if (savedInputs.email) setEmailContent(savedInputs.email);
          }

          loadAudioAttempts(story.title).then(savedAttempts => {
              if (savedAttempts && savedAttempts.length > 0) {
                  const loadedAttempts = savedAttempts.map(att => ({
                      blob: att.blob,
                      url: URL.createObjectURL(att.blob),
                      timestamp: att.timestamp
                  }));
                  setAttempts(loadedAttempts);
                  if (loadedAttempts.length > 0) {
                      setSpeakingPhase('REVIEW');
                      // If we have attempts, select the first one by default
                      setSelectedAttemptIndex(0);
                  }
              }
          });
      }
  }, [initialInputs, story.title, readOnly, viewingResult]);

  // If viewingResult is present, we are in review mode
  const isReviewMode = !!viewingResult;
  const effectiveReadOnly = readOnly || isReviewMode;

  const [score, setScore] = useState(0);
  const [loadingExplanation, setLoadingExplanation] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<{[key: string]: string}>({});
  const [checkedSections, setCheckedSections] = useState<{[key: number]: boolean}>({});
  const [showTranscript, setShowTranscript] = useState<{[key: number]: boolean}>({});
  
  // Speaking State - General
  const [speakingPhase, setSpeakingPhase] = useState<'IDLE' | 'PREPARING' | 'COUNTDOWN' | 'RECORDING' | 'REVIEW' | 'FINISHED' | 'UPLOADING'>('IDLE');
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<number | null>(null);

  const [attempts, setAttempts] = useState<{ blob: Blob; url: string; timestamp: string }[]>([]);
  const [selectedAttemptIndex, setSelectedAttemptIndex] = useState<number | null>(null);

  // Populate state from viewingResult for Review Mode
  useEffect(() => {
      if (viewingResult && viewingResult.details) {
          const newInputs: UserProgress = {};
          const newValidation: ValidationState = {};
          const newAttempts: { blob: Blob; url: string; timestamp: string }[] = [];
          
          let detailIndex = 0;
          const details = viewingResult.details;

          // Helper to process a story/substory
          const processStory = (s: Story, prefix: string = '') => {
              if (s.texts && s.readingAnswers) {
                   s.texts.forEach(text => {
                       const key = prefix + text.letter;
                       const detail = details[detailIndex++];
                       if (detail) {
                           // detail.userAnswer is like "1. Heading" -> extract "1"
                           const match = detail.userAnswer.match(/^(\d+)\./);
                           if (match) {
                               newInputs[key] = match[1];
                           }
                           newValidation[key] = detail.isCorrect;
                       }
                   });
              } else if (s.questions) {
                  s.questions.forEach(q => {
                      const key = prefix + q.id;
                      const detail = details[detailIndex++];
                      if (detail) {
                          // detail.userAnswer is the label text -> find index
                          const idx = q.options?.findIndex(opt => opt === detail.userAnswer);
                          if (idx !== undefined && idx !== -1) {
                               newInputs[key] = (idx + 1).toString();
                          }
                          newValidation[key] = detail.isCorrect;
                      }
                  });
              } else if (s.tasks) {
                  s.tasks.forEach((task, idx) => {
                      const key = prefix + idx;
                      const detail = details[detailIndex++];
                      if (detail) {
                          newInputs[key] = detail.userAnswer;
                          newValidation[key] = detail.isCorrect;
                      }
                  });
              }
          };

          if (type === ExerciseType.SPEAKING || type === ExerciseType.ORAL_SPEECH) {
              // For speaking, details contain audioUrl
              details.forEach((d) => {
                  if (d.audioUrl) {
                      newAttempts.push({
                          blob: new Blob(), // Dummy blob
                          url: d.audioUrl,
                          timestamp: new Date(viewingResult.created_at).toLocaleTimeString()
                      });
                  }
              });
              setAttempts(newAttempts);
              setSpeakingPhase('REVIEW');
          } else {
              if (story.subStories) {
                  story.subStories.forEach((sub, idx) => processStory(sub, `section_${idx}_`));
                  const checked: any = {};
                  story.subStories.forEach((_, i) => checked[i] = true);
                  setCheckedSections(checked);
              } else {
                  processStory(story);
              }
              setInputs(newInputs);
              setValidation(newValidation);
              setShowResults(true);
              setScore(viewingResult.score);
          }
      } else if (!viewingResult) {
          // Reset for new attempt
          setInputs({});
          setValidation({});
          setShowResults(false);
          setScore(0);
          setAttempts([]);
          setSpeakingPhase('IDLE');
          setEmailContent('');
          setWordCount(0);
          setCheckedSections({});
      }
  }, [viewingResult, story, type]);

  // Interview Specific State
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false); 
  const [isPaused, setIsPaused] = useState(false); // Track pause state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Listening Sticky Player State
  const [currentAudioTime, setCurrentAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const stickyAudioRef = useRef<HTMLAudioElement | null>(null);

  // Derive listening audio URL directly from story, independent of type
  const listeningAudioUrl = useMemo(() => {
      // Safe access for nested properties
      return story.audioUrl || story.subStories?.[0]?.audioUrl || null;
  }, [story]);

  // Audio Recording State
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [mimeType, setMimeType] = useState<string>(''); 
  const [recordingError, setRecordingError] = useState<string | null>(null);
  
  // Writing State
  const [emailContent, setEmailContent] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [isSubmittingWriting, setIsSubmittingWriting] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');

  // AI State
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<{score?: number, feedback?: string, mistakes?: string[]} | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [highlightedField, setHighlightedField] = useState<string | null>(null);

  useEffect(() => {
    if (highlightedField) {
        const timer = setTimeout(() => setHighlightedField(null), 2000);
        return () => clearTimeout(timer);
    }
  }, [highlightedField]);

  // --- Real-time Broadcasting Logic ---
  const broadcastChannelRef = useRef<any>(null);
  const lastBroadcastRef = useRef<number>(0);

  useEffect(() => {
    // Only broadcast if user is a student and has a profile
    if (typeof window !== 'undefined' && userProfile?.id) {
        const channel = supabase.channel('live_sessions_all');
        
        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                try {
                    await channel.send({
                        type: 'broadcast',
                        event: `student_${userProfile.id}_started`,
                        payload: {
                            studentId: userProfile.id,
                            studentName: userProfile.name,
                            exerciseTitle: story.title,
                            exerciseType: type,
                            startedAt: new Date().toISOString()
                        }
                    });
                } catch (e) {
                    console.error("Failed to broadcast start", e);
                }
            }
        });

        broadcastChannelRef.current = channel;

        return () => {
            if (broadcastChannelRef.current) {
                try {
                    broadcastChannelRef.current.send({
                        type: 'broadcast',
                        event: `student_${userProfile.id}_ended`,
                        payload: { studentId: userProfile.id, endedAt: new Date().toISOString() }
                    });
                } catch (e) { /* ignore cleanup errors */ }
                supabase.removeChannel(broadcastChannelRef.current);
            }
        };
    }
  }, [userProfile, story.title, type]);

  // Load writing draft (SSR Safe)
  useEffect(() => {
      if (typeof window !== 'undefined' && type === ExerciseType.WRITING) {
          try {
            const draftKey = `draft_${story.title}`;
            const saved = localStorage.getItem(draftKey);
            if (saved) {
                setEmailContent(saved);
                setWordCount(saved.trim().split(/\s+/).filter(w => w.length > 0).length);
            }
          } catch (e) {
              console.warn("LocalStorage access failed", e);
          }
      }
  }, [type, story.title]);

  // Auto-save writing draft (SSR Safe)
  useEffect(() => {
      if (typeof window !== 'undefined' && type === ExerciseType.WRITING && emailContent) {
          const timer = setTimeout(() => {
              try {
                const draftKey = `draft_${story.title}`;
                localStorage.setItem(draftKey, emailContent);
                setLastSaved(new Date().toLocaleTimeString());
              } catch (e) { /* ignore */ }
          }, 2000); 
          return () => clearTimeout(timer);
      }
  }, [emailContent, type, story.title]);

  const broadcastTyping = (questionId: string, currentInput: string, allInputs: UserProgress, isCorrect: boolean | null) => {
      if (!broadcastChannelRef.current || !userProfile?.id) return;

      const now = Date.now();
      if (now - lastBroadcastRef.current > 300) {
          const progressPercentage = Math.min(100, Math.round((Object.keys(allInputs).length / 10) * 10)); 

          broadcastChannelRef.current.send({
              type: 'broadcast',
              event: `student_${userProfile.id}_typing`,
              payload: {
                  studentId: userProfile.id,
                  questionId,
                  input: currentInput, 
                  allAnswers: allInputs, 
                  isCorrect,
                  timestamp: now,
                  progressPercentage
              }
          }).catch((err: any) => console.error("Broadcast typing error", err));
          lastBroadcastRef.current = now;
      }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!navigator.mediaDevices || !window.MediaRecorder) {
        setRecordingError("Audio recording is not supported in this browser. Please use a modern browser like Chrome or Firefox.");
        return;
    }

    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4', 
      'audio/ogg;codecs=opus',
      'audio/wav'
    ];
    
    try {
        const supported = types.find(t => MediaRecorder.isTypeSupported(t));
        if (supported) {
            setMimeType(supported);
        } else {
            setRecordingError("No supported audio recording format found.");
        }
    } catch (e) {
        console.error("MediaRecorder check failed", e);
        setRecordingError("Audio recording feature unavailable.");
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopMediaTracks();
    };
  }, [type, story, listeningAudioUrl]);

  const stopMediaTracks = () => {
      if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
      }
  };

  // Force load audio when URL changes to prevent stale state errors
  useEffect(() => {
      if (stickyAudioRef.current && listeningAudioUrl) {
          try {
            stickyAudioRef.current.load();
            setAudioError(null);
            setIsAudioPlaying(false);
          } catch(e) {
              console.error("Audio load error", e);
              setAudioError("Failed to load audio source.");
          }
      }
  }, [listeningAudioUrl]);

  // --- Sticky Player Logic ---
  
  const handlePlayPause = () => {
      if (!stickyAudioRef.current || !listeningAudioUrl) return;

      if (isAudioPlaying) {
          stickyAudioRef.current.pause();
          setIsAudioPlaying(false);
      } else {
          setAudioError(null);
          const playPromise = stickyAudioRef.current.play();
          if (playPromise !== undefined) {
              playPromise
                .then(() => setIsAudioPlaying(true))
                .catch(error => {
                  console.error("Play failed:", error);
                  setIsAudioPlaying(false);
                  setAudioError("Playback failed. Please check your connection.");
              });
          }
      }
  };

  const handleSeek = (seconds: number) => {
      if (!stickyAudioRef.current) return;
      const newTime = stickyAudioRef.current.currentTime + seconds;
      if (!isNaN(stickyAudioRef.current.duration)) {
          stickyAudioRef.current.currentTime = Math.max(0, Math.min(newTime, stickyAudioRef.current.duration));
      }
  };

  const handleSeekToTime = (time: number) => {
      if (stickyAudioRef.current) {
          stickyAudioRef.current.currentTime = time;
          if (!isAudioPlaying) {
              stickyAudioRef.current.play().then(() => setIsAudioPlaying(true)).catch(e => console.error(e));
          }
      }
  };

  const handleTimeUpdate = () => {
      if (stickyAudioRef.current) {
          setCurrentAudioTime(stickyAudioRef.current.currentTime);
          if (!isNaN(stickyAudioRef.current.duration) && stickyAudioRef.current.duration !== Infinity) {
            setAudioDuration(stickyAudioRef.current.duration);
          }
      }
  };

  const formatAudioTime = (time: number) => {
      if (!time || isNaN(time)) return "0:00";
      const m = Math.floor(time / 60);
      const s = Math.floor(time % 60);
      return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const toggleTranscript = (index: number) => {
      setShowTranscript(prev => ({ ...prev, [index]: !prev[index] }));
  };

  // --- Unified Audio Recording Logic ---

  const startRecordingSystem = async () => {
      try {
          if (!mimeType) throw new Error("No supported audio type found.");
          if (!navigator.mediaDevices) throw new Error("Audio input not supported.");
          
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;
          
          const mediaRecorder = new MediaRecorder(stream, { mimeType });
          mediaRecorderRef.current = mediaRecorder;
          audioChunksRef.current = [];

          mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                  audioChunksRef.current.push(event.data);
              }
          };

          mediaRecorder.onstop = () => {
              const blob = new Blob(audioChunksRef.current, { type: mimeType });
              if (blob.size < 100) {
                  setRecordingError("Recording too short or empty. Please try again.");
                  setSpeakingPhase('IDLE');
                  return;
              }
              const url = URL.createObjectURL(blob);
              const timestamp = new Date().toLocaleTimeString();
              
              // Save to IndexedDB
              saveAudioAttempt(story.title, blob, timestamp);

              setAttempts(prev => {
                  const newAttempts = [...prev, { blob, url, timestamp }];
                  if (newAttempts.length === 1) setSelectedAttemptIndex(0);
                  return newAttempts;
              });
              setSpeakingPhase('REVIEW');
          };

          mediaRecorder.start();
          setIsMicActive(true);
          setIsPaused(false);
          setRecordingError(null);
          return true;
      } catch (err: any) {
          console.error("Microphone error:", err);
          let msg = "Could not access microphone.";
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
              msg = "Microphone permission denied. Please allow access in browser settings.";
          }
          setRecordingError(msg);
          setIsMicActive(false);
          setIsPaused(false);
          return false;
      }
  };

  const stopRecordingSystem = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
      }
      stopMediaTracks();
      setIsMicActive(false);
      setIsPaused(false);
  };

  // --- Specific Task Flows ---

  const startReadAloudPreparation = () => {
    setSpeakingPhase('PREPARING');
    setTimer(90); 
    startTimer(90, () => {
        setSpeakingPhase('IDLE'); 
    }); 
  };

  const startReadAloudCountdown = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSpeakingPhase('COUNTDOWN');
    startTimer(5, startReadAloudRecording);
  };

  const startReadAloudRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const started = await startRecordingSystem();
    if (started) {
        setSpeakingPhase('RECORDING');
        setTimer(120); 
        startTimer(120, () => finishSpeaking());
    }
  };

  const startMonologuePreparation = () => {
      setSpeakingPhase('PREPARING');
      setTimer(90); 
      startTimer(90, () => setSpeakingPhase('IDLE')); 
  }

  const startMonologueCountdown = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSpeakingPhase('COUNTDOWN');
    startTimer(5, startMonologueRecordingSession);
  };

  const startMonologueRecordingSession = async () => {
      if (timerRef.current) clearInterval(timerRef.current);
      const started = await startRecordingSystem();
      if (started) {
          setSpeakingPhase('RECORDING');
          setTimer(120); 
          startTimer(120, () => stopRecording()); 
      }
  };

  const startInterviewRecording = async () => {
      audioChunksRef.current = []; 
      const started = await startRecordingSystem();
      if (started) {
          if (timerRef.current) clearInterval(timerRef.current);
          setTimer(0);
          timerRef.current = window.setInterval(() => {
              setTimer(t => t + 1);
          }, 1000);
      }
  };

  const handlePauseInterview = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.pause();
          setIsPaused(true);
          if (timerRef.current) clearInterval(timerRef.current);
      }
  };

  const handleResumeInterview = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
          mediaRecorderRef.current.resume();
          setIsPaused(false);
          timerRef.current = window.setInterval(() => {
              setTimer(t => t + 1);
          }, 1000);
      }
  };

  const handleFinishInterview = async () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopRecordingSystem();
  };

  const handleAudioUpload = async () => {
      setSpeakingPhase('UPLOADING');
      
      const blobsToUpload: { blob: Blob; label: string }[] = [];
      if (selectedAttemptIndex !== null) {
          blobsToUpload.push({ blob: attempts[selectedAttemptIndex].blob, label: 'Selected Attempt' });
      } else {
          // If none selected, upload all attempts
          attempts.forEach((att, idx) => {
              blobsToUpload.push({ blob: att.blob, label: `Attempt ${idx + 1}` });
          });
      }

      if (blobsToUpload.length === 0) {
          setRecordingError("No recordings to upload.");
          setSpeakingPhase('IDLE');
          return;
      }

      const taskLabel = story.speakingType === 'monologue' 
        ? `Monologue: ${story.title}` 
        : story.speakingType === 'read-aloud' ? `Read Aloud: ${story.title}`
        : 'Interview Session';

      let contextText = "";
      if (story.speakingType === 'read-aloud' && story.text) {
          contextText = story.text;
      } else if (story.speakingQuestions && story.speakingQuestions.length > 0) {
          contextText = story.speakingQuestions.map((q, i) => `${i + 1}) ${q}`).join('\n');
      }

      const details: AttemptDetail[] = [];

      try {
          for (const item of blobsToUpload) {
              const timestamp = new Date().getTime() + Math.random();
              const userIdentifier = userProfile?.email || 'anonymous';
              const cleanTitle = story.title.replace(/[^a-zA-Z0-9]/g, '_');
              
              let extension = 'webm';
              if (mimeType.includes('mp4')) extension = 'mp4';
              if (mimeType.includes('wav')) extension = 'wav';
              if (mimeType.includes('ogg')) extension = 'ogg';

              const fileName = `${userIdentifier}/${cleanTitle}/${timestamp}.${extension}`;

              const { error } = await supabase.storage
                  .from('audio-responses')
                  .upload(fileName, item.blob, {
                      upsert: true,
                      contentType: mimeType
                  });

              if (error) throw error;

              const { data: urlData } = supabase.storage
                  .from('audio-responses')
                  .getPublicUrl(fileName);
              
              details.push({
                  question: `${taskLabel} (${item.label})`,
                  userAnswer: "Audio Response Recorded",
                  correctAnswer: "Teacher Review",
                  isCorrect: null, 
                  audioUrl: urlData.publicUrl,
                  context: contextText
              });
          }

          setSpeakingPhase('FINISHED');
          onComplete(10, 10, details);
          
          // Clear storage after successful submission
          clearAudioAttempts(story.title);
          clearInputs(story.title);

      } catch (e: any) {
          console.error("Upload error", e);
          setRecordingError("Failed to upload audio. Please try again.");
          setSpeakingPhase('REVIEW'); 
      }
  };

  const startTimer = (duration: number, onComplete: () => void) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimer(duration);
    timerRef.current = window.setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopRecordingSystem();
  };

  const finishSpeaking = () => {
    stopRecording();
  };

  const handleInputChange = (key: string, value: string) => {
    const newInputs = { ...inputs, [key]: value };
    setInputs(newInputs);
    if (!readOnly) {
        setSaveStatus('saving');
        saveInputs(story.title, newInputs);
        setTimeout(() => setSaveStatus('saved'), 500);
        setTimeout(() => setSaveStatus('idle'), 2000);
    }
    broadcastTyping(key, value, newInputs, null);
    if (validation[key] !== undefined) {
      setValidation(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleReadingSelection = (key: string, value: string) => {
    handleInputChange(key, value);
  };

  const handleTrueFalseSelection = (questionId: number, optionIndex: number) => {
    handleInputChange(questionId.toString(), (optionIndex + 1).toString());
  };

  const renderSpeakingReview = () => {
      const canRerecord = attempts.length < 2;
      
      return (
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 mb-8 w-full max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-800">Ваши записи</h3>
                  <div className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold uppercase tracking-wider">
                      {attempts.length} {attempts.length === 1 ? 'Попытка' : 'Попытки'}
                  </div>
              </div>
              
              <div className="space-y-3 mb-8">
                  {attempts.map((att, idx) => (
                      <div 
                          key={idx} 
                          className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 group ${selectedAttemptIndex === idx ? 'border-indigo-500 bg-indigo-50/50 shadow-sm' : 'border-slate-100 hover:border-slate-300 bg-white'}`}
                          onClick={() => setSelectedAttemptIndex(idx)}
                      >
                          <div className="flex items-center gap-4">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${selectedAttemptIndex === idx ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}>
                                  {selectedAttemptIndex === idx ? (
                                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                                  ) : (
                                      <span className="text-xs font-bold">{idx + 1}</span>
                                  )}
                              </div>
                              <div>
                                  <p className={`text-sm font-bold ${selectedAttemptIndex === idx ? 'text-indigo-900' : 'text-slate-700'}`}>Попытка {idx + 1}</p>
                                  <p className="text-[10px] text-slate-400 font-medium">{att.timestamp}</p>
                              </div>
                          </div>
                          <audio src={att.url} controls className="h-8 w-32 md:w-48 opacity-80 hover:opacity-100 transition-opacity" />
                      </div>
                  ))}
              </div>

              <div className="flex flex-col gap-3">
                  {!readOnly && (
                      <div className="flex gap-3">
                          {canRerecord ? (
                              <button 
                                  onClick={() => {
                                      setSpeakingPhase('IDLE');
                                      setTimer(0);
                                  }}
                                  className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
                              >
                                  Перезаписать
                              </button>
                          ) : (
                              <div className="flex-1 bg-slate-50 text-slate-400 px-4 py-3 rounded-xl font-bold text-sm text-center border border-dashed border-slate-200 cursor-not-allowed">
                                  Попытки исчерпаны
                              </div>
                          )}
                          <button 
                              onClick={handleAudioUpload}
                              className="flex-[2] bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-3 rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                          >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              Отправить учителю
                          </button>
                      </div>
                  )}
                  {story.speakingType === 'read-aloud' && !readOnly && (
                      <button 
                          onClick={handleEvaluateSpeaking}
                          className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-4 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          Проверить с ИИ (Beta)
                      </button>
                  )}
                  
                  <div className="mt-2 text-center">
                      <p className="text-[10px] text-slate-400">
                          {canRerecord ? "Доступна 1 перезапись." : "Лимит перезаписей исчерпан."}
                      </p>
                  </div>
              </div>
          </div>
      );
  };

  const handleEmailChange = (text: string) => {
      setEmailContent(text);
      const newInputs = { ...inputs, email: text };
      if (!readOnly) {
          setSaveStatus('saving');
          saveInputs(story.title, newInputs);
          setTimeout(() => setSaveStatus('saved'), 500);
          setTimeout(() => setSaveStatus('idle'), 2000);
      }
      broadcastTyping("email", text, newInputs, null);
      const count = text.trim() === '' ? 0 : text.trim().split(/\s+/).filter(w => w.length > 0).length;
      setWordCount(count);
  }

  const handleSubmitWriting = async () => {
    setIsSubmittingWriting(true);
    
    if (wordCount < 30) {
        if (!confirm("Your email is very short. Are you sure you want to submit?")) {
            setIsSubmittingWriting(false);
            return;
        }
    }

    try {
        const details: AttemptDetail[] = [{
            question: 'Email Writing Task',
            userAnswer: emailContent,
            correctAnswer: 'Pending Review',
            isCorrect: null,
            context: story.text || story.emailBody,
            wordCount: wordCount,
        }];

        if (typeof window !== 'undefined') {
            localStorage.removeItem(`draft_${story.title}`);
        }
        
        onComplete(0, 10, details);
        setSpeakingPhase('FINISHED'); 
        clearInputs(story.title);
    } catch (e) {
        console.error("Submission failed", e);
        alert("Failed to submit. Please try again.");
    } finally {
        setIsSubmittingWriting(false);
    }
  };

  const checkAnswers = () => {
    if (type === ExerciseType.WRITING || type === ExerciseType.SPEAKING || type === ExerciseType.ORAL_SPEECH) {
        return;
    }

    let missingKey: string | null = null;

    const checkStoryInputs = (s: Story, prefix: string = '') => {
        if (missingKey) return;

        if (s.texts && s.readingAnswers) {
            for (const text of s.texts) {
                const key = prefix + text.letter;
                if (!inputs[key]) {
                    missingKey = key;
                    return;
                }
            }
        } else if (s.questions) {
            for (const q of s.questions) {
                const key = prefix + q.id;
                if (!inputs[key]) {
                    missingKey = key;
                    return;
                }
            }
        } else if (s.tasks) {
            for (let i = 0; i < s.tasks.length; i++) {
                const key = prefix + i.toString();
                if (!inputs[key] || inputs[key].trim() === '') {
                    missingKey = key;
                    return;
                }
            }
        }
    };

    if (story.subStories) {
        story.subStories.forEach((subStory, index) => {
            checkStoryInputs(subStory, `section_${index}_`);
        });
    } else {
        checkStoryInputs(story);
    }

    if (missingKey) {
        setHighlightedField(missingKey);
        const element = document.getElementById(`input-${missingKey}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }

    let correctCount = 0;
    let maxScore = 0;
    const newValidation: ValidationState = {};
    const attemptDetails: AttemptDetail[] = [];

    const checkStory = (s: Story, prefix: string = '') => {
        if (s.texts && s.readingAnswers) {
            maxScore += s.texts.length;
            s.texts.forEach((text) => {
                const key = prefix + text.letter;
                const userChoice = inputs[key];
                const correctAnswers = s.readingAnswers![text.letter] || [];
                const userNum = parseInt(userChoice || "-1");
                const isCorrect = correctAnswers.includes(userNum);
                newValidation[key] = isCorrect;
                if (isCorrect) correctCount++;

                const getHeading = (idx: number) => s.template ? s.template[idx - 1] || "Unknown" : "Unknown";
                attemptDetails.push({
                    question: `Item ${text.letter} (${text.content.substring(0,20)}...)`,
                    userAnswer: userNum > 0 ? `${userNum}. ${getHeading(userNum)}` : "No Answer",
                    correctAnswer: `${correctAnswers[0]}. ${getHeading(correctAnswers[0])}`,
                    isCorrect: isCorrect,
                    context: "Matching Task"
                });
            });
        } 
        else if (s.questions) {
            maxScore += s.questions.length;
            s.questions.forEach(q => {
                const key = prefix + q.id.toString();
                const userVal = parseInt(inputs[key] || "0");
                const isCorrect = userVal === q.answer;
                newValidation[key] = isCorrect;
                if(isCorrect) correctCount++;

                const label = q.options ? q.options[userVal - 1] || "No Answer" : "No Answer";
                const correctLabel = q.options ? q.options[q.answer - 1] || "" : "";
                attemptDetails.push({
                    question: q.text,
                    userAnswer: label,
                    correctAnswer: correctLabel,
                    isCorrect: isCorrect,
                    context: "Multiple Choice Task"
                });
            });
        }
        else if (s.tasks) {
            maxScore += s.tasks.length;
            s.tasks.forEach((task, index) => {
                const key = prefix + index.toString();
                const userVal = inputs[key]?.trim() || "";
                const correctVal = task.answer;
                const isCorrect = userVal.toLowerCase() === correctVal.toLowerCase();
                newValidation[key] = isCorrect;
                if (isCorrect) correctCount++;

                attemptDetails.push({
                    question: type === ExerciseType.LISTENING ? task.word : `Transform: ${task.word}`,
                    userAnswer: userVal,
                    correctAnswer: correctVal,
                    isCorrect: isCorrect,
                    context: "Gap Fill / Transformation"
                });
            });
        }
    };

    if (story.subStories) {
        story.subStories.forEach((subStory, index) => {
            checkStory(subStory, `section_${index}_`);
        });
    } else {
        checkStory(story);
    }

    setScore(correctCount);
    setValidation(newValidation);
    setShowResults(true);
    onComplete(correctCount, maxScore, attemptDetails);
  };

  const handleCheckSection = (index: number) => {
      const subStory = story.subStories![index];
      const prefix = `section_${index}_`;
      
      let missingKey: string | null = null;
      if (subStory.texts && subStory.readingAnswers) {
          for (const text of subStory.texts) {
              const key = prefix + text.letter;
              if (!inputs[key]) {
                  missingKey = key;
                  break;
              }
          }
      } else if (subStory.questions) {
          for (const q of subStory.questions) {
              const key = prefix + q.id;
              if (!inputs[key]) {
                  missingKey = key;
                  break;
              }
          }
      } else if (subStory.tasks) {
          for (let i = 0; i < subStory.tasks.length; i++) {
              const key = prefix + i.toString();
              if (!inputs[key] || inputs[key].trim() === '') {
                  missingKey = key;
                  break;
              }
          }
      }

      if (missingKey) {
          setHighlightedField(missingKey);
          const element = document.getElementById(`input-${missingKey}`);
          if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
      }

      const newValidation = { ...validation };

      if (subStory.texts && subStory.readingAnswers) {
          subStory.texts.forEach((text) => {
              const key = prefix + text.letter;
              const userChoice = inputs[key];
              const correctAnswers = subStory.readingAnswers![text.letter];
              const userNum = parseInt(userChoice || "-1");
              const isCorrect = correctAnswers.includes(userNum);
              newValidation[key] = isCorrect;
          });
      } else if (subStory.questions) {
          subStory.questions.forEach(q => {
              const key = prefix + q.id.toString();
              const userVal = parseInt(inputs[key] || "0");
              const isCorrect = userVal === q.answer;
              newValidation[key] = isCorrect;
          });
      } else if (subStory.tasks) {
          subStory.tasks.forEach((task, idx) => {
              const key = prefix + idx.toString();
              const userVal = inputs[key]?.trim() || "";
              const correctVal = task.answer;
              const isCorrect = userVal.toLowerCase() === correctVal.toLowerCase();
              newValidation[key] = isCorrect;
          });
      }

      setValidation(newValidation);
      setCheckedSections(prev => ({ ...prev, [index]: true }));
      const totalCorrect = Object.values(newValidation).filter(v => v === true).length;
      setScore(totalCorrect);
  };

  const handleAskAI = async (key: string, storyRef: Story) => {
    setLoadingExplanation(key);
    let explanation = "";
    if (type === ExerciseType.READING && storyRef.questions) {
        const qId = key.replace(/section_\d+_/, '');
        const q = storyRef.questions.find(q => q.id.toString() === qId);
        if (q && storyRef.text) {
            const userVal = parseInt(inputs[key] || "0");
            const options = ["True", "False", "Not Stated"];
            const userLabel = userVal > 0 ? options[userVal-1] : "No Answer";
            const correctLabel = options[q.answer-1];
            const statementStr = `Statement: "${q.text}" | Student chose: ${userLabel}`;
            explanation = await getExplanation(storyRef.text, "True/False Task", statementStr, correctLabel, type);
        }
    } else {
       explanation = await getExplanation("Context not available", "Task", "Incorrect", "Correct", type);
    }
    setExplanations(prev => ({ ...prev, [key]: explanation }));
    setLoadingExplanation(null);
  };

  const handleGetWritingSuggestion = async (type: 'greeting' | 'body' | 'closing' | 'rewrite' | 'level') => {
    setIsAiLoading(true);
    setAiSuggestion(null);
    setShowAiModal(true);
    try {
      const suggestion = await getWritingSuggestions(emailContent || "Start writing...", type);
      setAiSuggestion(suggestion);
    } catch (error) {
      setAiSuggestion("Failed to get suggestion. Please try again.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleGetSpeakingSuggestion = async () => {
    setIsAiLoading(true);
    setAiSuggestion(null);
    setShowAiModal(true);
    try {
      const context = story.text || story.speakingQuestions?.join('\n') || story.title;
      const suggestion = await getSpeakingSuggestion(context);
      setAiSuggestion(suggestion);
    } catch (error) {
      setAiSuggestion("Failed to get suggestion.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleEvaluateSpeaking = async () => {
    // Since we don't have real audio transcription, we'll ask the user to type what they said or evaluate the task context
    // For Read Aloud, we can evaluate the text difficulty
    if (story.speakingType === 'read-aloud' && story.text) {
        setIsAiLoading(true);
        setAiFeedback(null);
        setShowAiModal(true);
        try {
            const result = await evaluateReadAloud(story.text);
            setAiFeedback({
                score: result.pronunciationScore, // Using pronunciation score as main score
                feedback: result.feedback,
                mistakes: [] // No specific mistakes for read aloud simulation
            });
        } catch (e) {
            setAiFeedback({ feedback: "Evaluation failed." });
        } finally {
            setIsAiLoading(false);
        }
    } else {
        // For other types, we might need a transcript. 
        // For now, let's just show a placeholder or ask for text input in a future iteration.
        alert("AI Evaluation for this task type requires a transcript. Feature coming soon!");
    }
  };

  const renderAiModal = () => {
    if (!showAiModal) return null;
    
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col overflow-hidden animate-fade-in-up">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              AI Assistant
            </h3>
            <button onClick={() => setShowAiModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          <div className="p-6 overflow-y-auto custom-scrollbar">
            {isAiLoading ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="text-slate-500 font-medium animate-pulse">Thinking...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {aiSuggestion && (
                  <div className="prose prose-sm max-w-none text-slate-600 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                    <p className="whitespace-pre-wrap leading-relaxed">{aiSuggestion}</p>
                  </div>
                )}
                
                {aiFeedback && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(aiFeedback.score || 0) * 10}%` }}></div>
                        </div>
                        <span className="font-bold text-emerald-600">{aiFeedback.score}/10</span>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-emerald-800 text-sm">
                        {aiFeedback.feedback}
                    </div>
                    {aiFeedback.mistakes && aiFeedback.mistakes.length > 0 && (
                        <div>
                            <h4 className="font-bold text-slate-700 mb-2 text-xs uppercase">Areas for Improvement</h4>
                            <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                                {aiFeedback.mistakes.map((m, i) => <li key={i}>{m}</li>)}
                            </ul>
                        </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
             {aiSuggestion && (
                 <button 
                    onClick={() => {
                        if (type === ExerciseType.WRITING) {
                            handleEmailChange(emailContent + "\n\n" + aiSuggestion);
                            setShowAiModal(false);
                        } else {
                            navigator.clipboard.writeText(aiSuggestion);
                            alert("Copied to clipboard!");
                        }
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-colors"
                 >
                    {type === ExerciseType.WRITING ? "Insert" : "Copy"}
                 </button>
             )}
             <button onClick={() => setShowAiModal(false)} className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium text-sm">Close</button>
          </div>
        </div>
      </div>
    );
  };

  const renderWritingLayout = () => {
      // Fallback if text/body missing
      const taskText = story.text || story.emailBody || "Write your response below.";
      
      const wordCountClass = wordCount < 90 ? 'text-amber-500' : wordCount > 132 ? 'text-rose-500' : 'text-emerald-500';
      
      return (
          <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[600px] lg:h-[calc(100vh-200px)]">
             <div className="lg:w-1/3 order-2 lg:order-1 flex flex-col gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex-1 flex flex-col">
                   <h3 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wide">Task</h3>
                   <div className="prose prose-sm text-slate-600 mb-6 flex-1 overflow-y-auto custom-scrollbar">
                      <p className="whitespace-pre-line leading-relaxed">{taskText}</p>
                   </div>
                   
                   <div className="border-t border-slate-100 pt-4 mt-auto">
                      <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-slate-800 text-xs uppercase">Stats</h4>
                          {lastSaved && <span className="text-[10px] text-slate-400">Saved: {lastSaved}</span>}
                      </div>
                      <div className="space-y-3">
                          <div className="flex items-center gap-3 text-sm text-slate-600">
                             <div className={`w-3 h-3 rounded-full ${wordCount >= 100 && wordCount <= 120 ? 'bg-emerald-500' : (wordCount >= 90 && wordCount <= 132 ? 'bg-amber-400' : 'bg-slate-300')}`} />
                             <span className="flex-1">Word count: <span className={`font-mono font-bold ${wordCountClass}`}>{wordCount}</span> / 100-120</span>
                          </div>
                       </div>
                       
                       {!readOnly && (
                           <button 
                            onClick={handleSubmitWriting} 
                            disabled={isSubmittingWriting}
                            className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
                           >
                               {isSubmittingWriting ? (
                                   <>
                                   <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                   Sending...
                                   </>
                               ) : "Submit to Teacher"}
                           </button>
                       )}
                   </div>
                </div>
             </div>

             <div className="lg:w-2/3 order-1 lg:order-2 flex flex-col bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
                <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                   <h2 className="text-lg font-bold text-slate-800">{story.emailSubject || "New Email"}</h2>
                   <span className="text-xs text-slate-400">Draft - Auto-saving</span>
                </div>
                <div className="flex-1 overflow-y-auto bg-white custom-scrollbar p-6">
                   <div className="mb-8 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex justify-between items-baseline mb-2">
                         <span className="font-bold text-slate-900">{story.emailSender || "Friend"}</span>
                         <span className="text-xs text-slate-400">Received recently</span>
                      </div>
                      <p className="text-slate-700 whitespace-pre-line leading-relaxed">{story.emailBody}</p>
                   </div>

                   <div className="relative group h-full flex flex-col">
                      <div className="mb-2 text-xs text-slate-400 flex justify-between items-center">
                         <span>To: Teacher</span>
                         {!readOnly && (
                             <div className="flex gap-2">
                                <button onClick={() => handleGetWritingSuggestion('greeting')} className="text-indigo-500 hover:text-indigo-700 font-bold text-[10px] uppercase tracking-wide bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors">Greeting</button>
                                <button onClick={() => handleGetWritingSuggestion('body')} className="text-indigo-500 hover:text-indigo-700 font-bold text-[10px] uppercase tracking-wide bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors">Body</button>
                                <button onClick={() => handleGetWritingSuggestion('closing')} className="text-indigo-500 hover:text-indigo-700 font-bold text-[10px] uppercase tracking-wide bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors">Closing</button>
                                <button onClick={() => handleGetWritingSuggestion('rewrite')} className="text-emerald-500 hover:text-emerald-700 font-bold text-[10px] uppercase tracking-wide bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded transition-colors">Rewrite</button>
                             </div>
                         )}
                      </div>
                      <textarea
                         className={`w-full flex-1 p-4 text-slate-800 text-lg leading-relaxed outline-none resize-none border-2 border-transparent focus:border-indigo-100 rounded-xl transition-all bg-slate-50 focus:bg-white ${readOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
                         placeholder="Write your reply here..."
                         value={emailContent}
                         onChange={(e) => handleEmailChange(e.target.value)}
                         spellCheck={false}
                         disabled={readOnly}
                      />
                   </div>
                </div>
             </div>
          </div>
      )
  };

  const renderSpeaking = () => {
      const subtype = story.speakingType || 'read-aloud';

      if (recordingError) {
          return (
              <div className="max-w-3xl mx-auto py-10">
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 px-6 py-4 rounded-xl flex items-center gap-3">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <div>
                          <p className="font-bold">Microphone Error</p>
                          <p className="text-sm">{recordingError}</p>
                          <button onClick={() => window.location.reload()} className="mt-2 text-xs bg-white border border-rose-300 px-2 py-1 rounded hover:bg-rose-50">Reload Page</button>
                      </div>
                  </div>
              </div>
          )
      }

      if (subtype === 'read-aloud') {
          return (
              <div className="max-w-5xl mx-auto py-10">
                  {speakingPhase === 'REVIEW' ? (
                      renderSpeakingReview()
                  ) : (
                      <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 mb-8 flex flex-col md:flex-row justify-between items-center gap-8">
                      <div className="flex items-center gap-6">
                          <div className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold border-[6px] transition-all duration-500 font-mono
                              ${speakingPhase === 'PREPARING' ? 'border-amber-400 text-amber-600 scale-110' :
                                speakingPhase === 'COUNTDOWN' ? 'border-indigo-500 text-indigo-600 scale-125 animate-pulse' :
                                speakingPhase === 'RECORDING' ? 'border-rose-500 text-rose-600 scale-110 animate-pulse' :
                                speakingPhase === 'FINISHED' ? 'border-emerald-400 text-emerald-600' :
                                'border-slate-100 text-slate-300'}
                          `}>
                              {String(Math.floor(timer/60))}:{String(timer%60).padStart(2,'0')}
                          </div>
                          <div>
                              <div className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-1">Задание 1: Чтение вслух</div>
                              <div className="font-bold text-2xl text-slate-800">
                                  {speakingPhase === 'IDLE' && 'Готовы начать?'}
                                  {speakingPhase === 'PREPARING' && 'Подготовка...'}
                                  {speakingPhase === 'COUNTDOWN' && 'Приготовьтесь!'}
                                  {speakingPhase === 'RECORDING' && 'Запись!'}
                                  {speakingPhase === 'UPLOADING' && 'Сохранение...'}
                                  {speakingPhase === 'FINISHED' && 'Готово'}
                              </div>
                          </div>
                      </div>

                      <div className="flex gap-4">
                          {speakingPhase === 'IDLE' && !readOnly && (
                              <button onClick={startReadAloudPreparation} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-lg active:scale-95">Начать подготовку</button>
                          )}
                          {speakingPhase === 'PREPARING' && !readOnly && (
                              <button onClick={startReadAloudCountdown} className="bg-slate-200 hover:bg-slate-300 text-slate-600 px-6 py-4 rounded-2xl font-bold transition-all">Пропустить</button>
                          )}
                          {speakingPhase === 'COUNTDOWN' && !readOnly && (
                              <div className="text-indigo-600 font-bold px-8 py-4">Начало через {timer}...</div>
                          )}
                          {/* After prep (IDLE again) show Start Recording */}
                          {speakingPhase === 'IDLE' && timer === 0 && !readOnly && (
                              <button onClick={startReadAloudRecording} className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-lg active:scale-95">Начать запись</button>
                          )}
                          {speakingPhase === 'RECORDING' && !readOnly && (
                              <button onClick={() => finishSpeaking()} className="bg-rose-500 hover:bg-rose-600 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-lg active:scale-95">Завершить запись</button>
                          )}
                      </div>
                      </div>
                  )}
                  <div className={`bg-white p-10 md:p-14 rounded-3xl shadow-sm border transition-all duration-500 ${speakingPhase === 'RECORDING' ? 'border-rose-200 ring-4 ring-rose-50' : 'border-slate-100'}`}>
                      <p className="text-lg md:text-xl leading-[2.2] tracking-wide text-slate-800 font-normal max-w-none mx-auto">{story.text}</p>
                  </div>
              </div>
          );
      }

      if (subtype === 'interview') {
          return (
              <div className="max-w-3xl mx-auto py-10">
                  {speakingPhase === 'REVIEW' ? (
                      renderSpeakingReview()
                  ) : (
                      <>
                          {story.audioUrl && (
                      <div className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                          <p className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wider">Audio Question</p>
                          <audio ref={audioRef} controls src={story.audioUrl} className="w-full" />
                      </div>
                  )}
                  
                  <div className="bg-white p-10 rounded-3xl shadow-xl border border-slate-100 mb-8 text-center flex flex-col items-center">
                      <h2 className="text-2xl font-bold text-slate-900 mb-4">{story.title}</h2>
                      <p className="text-slate-500 text-sm mb-8 max-w-lg leading-relaxed">
                          Listen to the question above, then press <b>Record</b> to answer. <br/>You can <b>Pause</b> to listen or think, then <b>Resume</b> to continue answering.
                      </p>

                      {speakingPhase === 'UPLOADING' ? (
                          <div className="animate-pulse py-10 text-slate-500 font-bold">Saving Audio...</div>
                      ) : (
                          <div className="flex flex-col items-center justify-center gap-6 w-full">
                              {!isMicActive && !readOnly ? (
                                <div className="flex flex-col items-center gap-4">
                                    <button 
                                        onClick={startInterviewRecording} 
                                        className="w-32 h-32 rounded-full flex flex-col items-center justify-center border-[6px] border-slate-100 text-rose-500 transition-all duration-300 shadow-xl hover:scale-105 active:scale-95 bg-white hover:border-rose-100"
                                    >
                                        <div className="w-8 h-8 bg-rose-500 rounded-full shadow-sm mb-1"></div>
                                        <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">START</span>
                                    </button>
                                    <button onClick={handleGetSpeakingSuggestion} className="text-indigo-500 hover:text-indigo-700 font-bold text-xs uppercase tracking-wide bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-full transition-colors">
                                        Suggest Answer (AI)
                                    </button>
                                </div>
                              ) : isMicActive && !readOnly ? (
                                  <div className="flex items-center gap-6 animate-fade-in-up">
                                      {/* Pause/Resume Control */}
                                      {isPaused ? (
                                          <button 
                                            onClick={handleResumeInterview}
                                            className="w-20 h-20 rounded-full flex flex-col items-center justify-center border-4 border-indigo-200 bg-indigo-50 text-indigo-600 hover:scale-105 transition-all shadow-lg"
                                            title="Resume Recording"
                                          >
                                              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M8 5v14l11-7z"/></svg>
                                              <span className="text-[9px] font-bold uppercase mt-1">Resume</span>
                                          </button>
                                      ) : (
                                          <button 
                                            onClick={handlePauseInterview}
                                            className="w-20 h-20 rounded-full flex flex-col items-center justify-center border-4 border-amber-200 bg-amber-50 text-amber-600 hover:scale-105 transition-all shadow-lg"
                                            title="Pause Recording"
                                          >
                                              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                                              <span className="text-[9px] font-bold uppercase mt-1">Pause</span>
                                          </button>
                                      )}

                                      {/* Main Recording Indicator */}
                                      <div className={`w-32 h-32 rounded-full flex flex-col items-center justify-center border-[6px] transition-all duration-500 shadow-xl ${isPaused ? 'border-amber-200 bg-amber-50' : 'border-rose-200 bg-rose-50 animate-pulse'}`}>
                                          <div className={`text-2xl font-mono font-bold ${isPaused ? 'text-amber-600' : 'text-rose-600'}`}>
                                              {String(Math.floor(timer/60))}:{String(timer%60).padStart(2,'0')}
                                          </div>
                                          <span className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${isPaused ? 'text-amber-400' : 'text-rose-400'}`}>
                                              {isPaused ? 'PAUSED' : 'RECORDING'}
                                          </span>
                                      </div>

                                      {/* Finish Button */}
                                      <button 
                                        onClick={handleFinishInterview}
                                        className="w-20 h-20 rounded-full flex flex-col items-center justify-center border-4 border-emerald-200 bg-emerald-50 text-emerald-600 hover:scale-105 transition-all shadow-lg"
                                        title="Finish & Save"
                                      >
                                          <div className="w-6 h-6 bg-emerald-600 rounded-md shadow-sm mb-1"></div>
                                          <span className="text-[9px] font-bold uppercase">Finish</span>
                                      </button>
                                  </div>
                              ) : null}
                          </div>
                      )}
                  </div>
                  </>
                  )}
              </div>
          );
      }

      if (subtype === 'monologue') {
          return (
              <div className="max-w-4xl mx-auto py-10">
                  {speakingPhase === 'REVIEW' ? (
                      renderSpeakingReview()
                  ) : (
                      <div className="grid md:grid-cols-2 gap-8">
                          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                      <h2 className="text-xl font-bold text-slate-900 mb-4">{story.title}</h2>
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                          <p className="text-slate-700 font-medium mb-4">{story.text}</p>
                          <ul className="space-y-2">
                              {story.speakingQuestions?.map((q, idx) => (
                                  <li key={idx} className="flex items-start gap-2 text-slate-700 text-sm">
                                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">{idx + 1}</span>
                                      {q}
                                  </li>
                              ))}
                          </ul>
                      </div>
                  </div>
                  <div className="flex flex-col justify-center gap-6 bg-white p-8 rounded-3xl shadow-xl border border-slate-100 text-center">
                      <div className={`text-4xl font-bold font-mono mb-6 transition-all duration-300 ${speakingPhase === 'COUNTDOWN' ? 'text-indigo-600 scale-150' : 'text-slate-900'}`}>
                          {String(Math.floor(timer/60))}:{String(timer%60).padStart(2,'0')}
                      </div>
                      
                      {speakingPhase === 'UPLOADING' && <div className="text-slate-500 font-bold animate-pulse">Uploading...</div>}
                      {speakingPhase === 'COUNTDOWN' && <div className="text-indigo-600 font-bold animate-bounce mb-4">Get ready!</div>}

                      {speakingPhase === 'IDLE' && !readOnly && (
                          <div className="flex flex-col gap-3 w-full">
                              <button onClick={startMonologuePreparation} className="bg-indigo-600 text-white px-6 py-4 rounded-2xl font-bold shadow-lg w-full">Start Preparation</button>
                              <button onClick={handleGetSpeakingSuggestion} className="bg-indigo-50 text-indigo-600 px-6 py-3 rounded-2xl font-bold hover:bg-indigo-100 transition-colors w-full text-sm">Suggest Answer (AI)</button>
                          </div>
                      )}
                      
                      {speakingPhase === 'PREPARING' && !readOnly && (
                          <button onClick={startMonologueCountdown} className="bg-slate-200 text-slate-600 px-6 py-4 rounded-2xl font-bold shadow-sm">Skip & Ready</button>
                      )}
                      
                      {speakingPhase === 'IDLE' && timer === 0 && !readOnly && (
                           <button onClick={startMonologueRecordingSession} className="bg-emerald-500 text-white px-6 py-4 rounded-2xl font-bold shadow-lg">Start Recording</button>
                      )}
                      
                      {speakingPhase === 'RECORDING' && !readOnly && (
                          <button onClick={() => stopRecording()} className="bg-rose-500 text-white px-6 py-4 rounded-2xl font-bold shadow-lg">Finish & Save</button>
                      )}
                  </div>
                  </div>
                  )}
              </div>
          );
      }
      
      return (
          <div className="p-8 text-center text-slate-500">
              <p>Speaking Type "{subtype}" is not implemented yet.</p>
          </div>
      );
  }

  const renderSingleListeningTask = (subStory: Story, index: number) => {
      const prefix = `section_${index}_`;
      const isSectionChecked = checkedSections[index] || showResults;
      const isTranscriptVisible = showTranscript[index];

      return (
          <div key={index} className={`bg-white rounded-3xl p-8 shadow-sm border mb-10 border-slate-100`} id={`task-${index}`}>
              <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                  <div>
                      <h3 className="text-xl font-extrabold text-slate-900">{subStory.title}</h3>
                      <p className="text-slate-500 text-sm mt-1">{subStory.text}</p>
                  </div>
              </div>

              {subStory.transcript && (
                  <div className="mb-8">
                      <button 
                          onClick={() => toggleTranscript(index)}
                          className="flex items-center gap-2 text-indigo-600 font-bold text-sm hover:bg-indigo-50 px-4 py-2 rounded-xl transition-all border border-indigo-100"
                      >
                          <svg className={`w-4 h-4 transition-transform ${isTranscriptVisible ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                          {isTranscriptVisible ? "Hide Transcript" : "Show Transcript"}
                      </button>

                      {isTranscriptVisible && (
                          <div className="mt-4 bg-slate-50 rounded-2xl border border-slate-200 p-6 max-h-[400px] overflow-y-auto custom-scrollbar">
                              <div className="space-y-6">
                                  {subStory.transcript.items?.map((item, iIdx) => (
                                      <div key={iIdx} className="space-y-2">
                                          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 border-b border-slate-200 pb-1">
                                              Part {item.text_id}
                                          </div>
                                          {item.segments?.map((seg, sIdx) => {
                                              const isActive = currentAudioTime >= seg.time && 
                                                  (sIdx < (item.segments?.length || 0) - 1 
                                                      ? currentAudioTime < (item.segments?.[sIdx+1]?.time || Infinity)
                                                      : currentAudioTime < item.end);

                                              return (
                                                  <div 
                                                      key={sIdx} 
                                                      onClick={() => handleSeekToTime(seg.time)}
                                                      className={`cursor-pointer transition-colors p-2 rounded-lg text-sm leading-relaxed ${
                                                          isActive 
                                                              ? 'bg-indigo-100 text-indigo-900 font-medium' 
                                                              : 'hover:bg-white text-slate-600'
                                                      }`}
                                                  >
                                                      <span className="text-xs text-slate-400 font-mono mr-2 select-none">
                                                          {formatAudioTime(seg.time)}
                                                      </span>
                                                      <span>{seg.text}</span>
                                                  </div>
                                              );
                                          })}
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
              )}

              {subStory.questions && (
                  <div className="grid gap-6">
                      {subStory.questions.map((q) => {
                          const key = prefix + q.id;
                          return (
                              <div id={`input-${key}`} key={q.id} className={`bg-slate-50 p-6 rounded-2xl border border-slate-100 ${highlightedField === key ? 'ring-4 ring-rose-100 border-rose-500 animate-pulse' : ''}`}>
                                  <div className="flex gap-4 mb-4">
                                      <span className="font-bold text-cyan-500 text-lg">{q.id}.</span>
                                      <p className="font-medium text-slate-800">{q.text}</p>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
                                      {q.options?.map((opt, idx) => {
                                          const isSelected = inputs[key] === (idx + 1).toString();
                                          const isThisCorrectOption = (idx + 1) === q.answer;
                                          let btnClass = "bg-white text-slate-600 border-slate-200 hover:border-cyan-300";
                                          
                                          if (isSectionChecked) {
                                              if (isSelected && isThisCorrectOption) btnClass = "bg-emerald-500 border-emerald-500 text-white";
                                              else if (isSelected) btnClass = "bg-rose-500 border-rose-500 text-white";
                                              else if (isThisCorrectOption) btnClass = "bg-transparent border-2 border-emerald-500 text-emerald-600";
                                              else btnClass = "opacity-50";
                                          } else if (isSelected) {
                                              btnClass = "bg-cyan-50 border-cyan-500 text-cyan-700 ring-1 ring-cyan-200";
                                          }

                                          return (
                                              <button
                                                  key={idx}
                                                  onClick={() => handleInputChange(key, (idx + 1).toString())}
                                                  disabled={isSectionChecked || effectiveReadOnly}
                                                  className={`py-3 px-4 rounded-xl text-sm font-bold transition-all border-2 text-left flex items-center gap-3 ${btnClass} ${effectiveReadOnly ? 'cursor-not-allowed opacity-70' : ''}`}
                                              >
                                                  <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs opacity-70 shrink-0">
                                                      {idx + 1}
                                                  </span>
                                                  {opt}
                                              </button>
                                          );
                                      })}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              )}

              {subStory.texts && subStory.readingAnswers && subStory.template && (
                  <div className="flex flex-col lg:flex-row gap-8">
                      <div className="lg:w-1/2">
                          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 sticky top-4">
                              <h4 className="font-bold text-slate-400 text-xs uppercase tracking-wider mb-3">Options</h4>
                              <div className="grid gap-2">
                                  {subStory.template.map((rubric, idx) => (
                                      <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-700">
                                          <span className="font-bold text-cyan-600 mr-2">{idx + 1}.</span> {rubric}
                                      </div>
                                  ))}
                              </div>
                          </div>
                      </div>
                      <div className="lg:w-1/2 grid gap-4">
                          {subStory.texts.map((speakerItem) => {
                              const key = prefix + speakerItem.letter;
                              const correctAnswers = subStory.readingAnswers![speakerItem.letter] || [];

                              return (
                                  <div id={`input-${key}`} key={speakerItem.letter} className={`bg-white rounded-xl p-4 shadow-sm border border-slate-200 ${highlightedField === key ? 'ring-4 ring-rose-100 border-rose-500 animate-pulse' : ''}`}>
                                      <div className="flex items-center justify-between mb-3">
                                          <div className="font-bold text-slate-800 flex items-center gap-3">
                                              <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-sm">
                                                  {speakerItem.letter}
                                              </div>
                                              {speakerItem.content}
                                          </div>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                          {subStory.template.map((_, idx) => {
                                              const num = (idx + 1).toString();
                                              const isSelected = inputs[key] === num;
                                              const isThisCorrect = correctAnswers.includes(idx + 1);
                                              
                                              let btnClass = "bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200";
                                              if (isSectionChecked) {
                                                  if (isSelected && isThisCorrect) btnClass = "bg-emerald-500 text-white border-emerald-500";
                                                  else if (isSelected) btnClass = "bg-rose-500 text-white border-rose-500";
                                                  else if (isThisCorrect && !isSelected) btnClass = "text-emerald-600 border-emerald-500 border-2";
                                                  else btnClass = "opacity-30";
                                              } else if (isSelected) {
                                                  btnClass = "bg-cyan-600 text-white border-cyan-600";
                                              }

                                              return (
                                                  <button
                                                      key={num}
                                                      onClick={() => handleInputChange(key, num)}
                                                      disabled={isSectionChecked || effectiveReadOnly}
                                                      className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${btnClass} ${effectiveReadOnly ? 'cursor-not-allowed opacity-70' : ''}`}
                                                  >
                                                      {num}
                                                  </button>
                                              );
                                          })}
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  </div>
              )}

              {subStory.tasks && (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-left">
                          <thead className="bg-slate-50">
                              <tr>
                                  <th className="p-4 font-bold text-slate-600 border-b border-slate-200 w-1/2">Category</th>
                                  <th className="p-4 font-bold text-slate-600 border-b border-slate-200">Your Answer</th>
                              </tr>
                          </thead>
                          <tbody>
                              {subStory.tasks.map((task, idx) => {
                                  const key = prefix + idx.toString();
                                  const isCorrect = validation[key];
                                  return (
                                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                          <td className="p-4 text-slate-800 font-medium">{task.word}</td>
                                          <td className="p-4 relative">
                                              <input
                                                  id={`input-${key}`}
                                                  type="text"
                                                  value={inputs[key] || ''}
                                                  onChange={(e) => handleInputChange(key, e.target.value)}
                                                  disabled={isSectionChecked || effectiveReadOnly}
                                                  className={`w-full px-3 py-2 rounded-lg border-2 outline-none font-bold transition-all ${
                                                      isCorrect === true ? 'border-emerald-400 bg-emerald-50 text-emerald-800' :
                                                      isCorrect === false ? 'border-rose-400 bg-rose-50 text-rose-800' :
                                                      highlightedField === key ? 'border-rose-500 ring-4 ring-rose-100 bg-rose-50 animate-pulse' :
                                                      'border-slate-200 focus:border-cyan-500 focus:bg-white'
                                                  } ${effectiveReadOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
                                              />
                                              {isSectionChecked && !isCorrect && (
                                                  <div className="text-xs text-emerald-600 mt-1 font-bold">
                                                      Answer: {task.answer}
                                                  </div>
                                              )}
                                          </td>
                                      </tr>
                                  )
                              })}
                          </tbody>
                      </table>
                  </div>
              )}

              <div className="mt-6 flex justify-end">
                  {!isSectionChecked && !readOnly && (
                      <button 
                          onClick={() => handleCheckSection(index)}
                          className={`${highlightedField ? 'bg-rose-500 animate-pulse ring-4 ring-rose-200' : 'bg-cyan-600 hover:bg-cyan-700'} text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md active:scale-95`}
                      >
                          {highlightedField ? 'Complete Section' : 'Check This Section'}
                      </button>
                  )}
                  {isSectionChecked && !showResults && (
                      <div className="text-emerald-600 font-bold text-sm bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100">
                          Section Checked
                      </div>
                  )}
              </div>
          </div>
      );
  };

  const renderListening = () => {
      return (
          <div className="flex flex-col gap-4 max-w-5xl mx-auto pb-40 relative">
              {listeningAudioUrl && (
                <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl p-4 z-50">
                    <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-6 relative">
                        {audioError && (
                            <div className="absolute -top-12 left-0 right-0 bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-bold text-center border border-red-200 shadow-sm">
                                {audioError}
                            </div>
                        )}
                        
                        <audio 
                            ref={stickyAudioRef} 
                            key={listeningAudioUrl} 
                            src={listeningAudioUrl}
                            crossOrigin="anonymous" 
                            onTimeUpdate={handleTimeUpdate}
                            onEnded={() => setIsAudioPlaying(false)}
                            onLoadedMetadata={handleTimeUpdate}
                            onError={(e) => {
                                const error = e.currentTarget.error;
                                let errorMsg = "Error playing audio.";
                                if (error) {
                                    if (error.code === 2) errorMsg = "Network error. Check connection.";
                                    if (error.code === 3) errorMsg = "Audio decoding failed.";
                                    if (error.code === 4) errorMsg = "Audio source not supported or not found (404).";
                                }
                                setAudioError(errorMsg);
                                setIsAudioPlaying(false);
                            }}
                            preload="auto"
                        />
                        
                        <div className="flex items-center gap-4 md:gap-6 order-2 md:order-1">
                            <button onClick={() => handleSeek(-15)} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 font-bold text-xs flex flex-col items-center gap-1 transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                                -15s
                            </button>
                            <button onClick={() => handleSeek(-5)} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 font-bold text-xs flex flex-col items-center gap-1 transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                -5s
                            </button>
                            <button onClick={handlePlayPause} className="w-16 h-16 rounded-full bg-slate-900 hover:bg-indigo-600 text-white flex items-center justify-center hover:scale-105 transition-all shadow-lg shrink-0">
                                {isAudioPlaying ? (
                                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6" /></svg>
                                ) : (
                                    <svg className="w-8 h-8 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
                                )}
                            </button>
                            <button onClick={() => handleSeek(5)} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 font-bold text-xs flex flex-col items-center gap-1 transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                                +5s
                            </button>
                            <button onClick={() => handleSeek(15)} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 font-bold text-xs flex flex-col items-center gap-1 transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                                +15s
                            </button>
                        </div>

                        <div className="flex-1 w-full order-1 md:order-2 px-2">
                            <div className="flex justify-between text-xs font-bold text-slate-400 mb-2">
                                <span>{formatAudioTime(currentAudioTime)}</span>
                                <span>{formatAudioTime(audioDuration)}</span>
                            </div>
                            <div className="h-3 bg-slate-100 rounded-full overflow-hidden relative group cursor-pointer border border-slate-200">
                                <div className="absolute top-0 left-0 bottom-0 bg-indigo-500 transition-all duration-100" style={{ width: `${(currentAudioTime / (audioDuration || 1)) * 100}%` }} />
                                <input type="range" min="0" max={audioDuration || 100} value={currentAudioTime} 
                                    onChange={(e) => { if (stickyAudioRef.current) stickyAudioRef.current.currentTime = Number(e.target.value); }}
                                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-20" 
                                />
                            </div>
                        </div>
                    </div>
                </div>
              )}
              {story.subStories ? story.subStories.map((sub, idx) => renderSingleListeningTask(sub, idx)) : renderSingleListeningTask(story, 0)}
          </div>
      );
  };

  const renderGrammarTemplate = () => {
    return (
      <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 p-8 md:p-12 leading-[3.5rem] text-lg text-slate-700 max-w-7xl mx-auto relative">
        {story.template?.map((sentence, index) => {
          const parts = sentence.split(/\{(\d+)\}/);
          return (
            <span key={index}>
              {parts.map((part, partIndex) => {
                if (partIndex % 2 === 0) {
                  return <span key={partIndex}>{part}</span>;
                } else {
                  const taskIndex = parseInt(part);
                  const task = story.tasks?.[taskIndex];
                  if (!task) return null;
                  
                  const taskId = taskIndex.toString();
                  const isCorrect = validation[taskId];
                  const userAnswer = inputs[taskId] || '';
                  const hasValue = userAnswer.length > 0;
                  
                  // Calculate a static width based on the prompt word length to prevent layout shift while typing
                  // 14px per character + 45px buffer for padding/icon (increased from previous)
                  const staticWidth = Math.max(150, task.word.length * 15 + 45);

                  return (
                    <span key={partIndex} className="inline-block relative group align-middle mx-1.5">
                        <input 
                            id={`input-${taskId}`}
                            type="text" 
                            value={userAnswer} 
                            onChange={(e) => handleInputChange(taskIndex.toString(), e.target.value)} 
                            placeholder={task.word}
                            style={{ width: `${staticWidth}px` }}
                            className={`h-10 px-3 text-center font-bold rounded-xl outline-none transition-all duration-200 placeholder:text-indigo-300 placeholder:font-bold placeholder:uppercase placeholder:tracking-wider ${
                                isCorrect === true 
                                    ? 'bg-emerald-100 text-emerald-800 border-2 border-emerald-100' 
                                    : isCorrect === false 
                                        ? 'bg-rose-100 text-rose-800 border-2 border-rose-100' 
                                        : highlightedField === taskId
                                            ? 'bg-rose-50 border-2 border-rose-500 ring-4 ring-rose-100 animate-pulse'
                                            : hasValue
                                                ? 'bg-indigo-50 text-indigo-700 border-2 border-indigo-100'
                                                : 'bg-white text-slate-700 border-2 border-indigo-100 shadow-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10'
                            } ${effectiveReadOnly ? 'opacity-90 cursor-default' : ''}`}
                            disabled={showResults || effectiveReadOnly} 
                            autoComplete="off" 
                            spellCheck="false"
                        />
                        {showResults && !isCorrect && (
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-20 hidden group-hover:block w-max max-w-[200px]">
                                <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-sm text-center">
                                    <p className="font-bold mb-1 text-emerald-400">{task.answer}</p>
                                    <button onClick={() => handleAskAI(taskId, story)} className="text-[10px] text-slate-400 hover:text-white underline">
                                        {loadingExplanation === taskId ? 'Thinking...' : 'Why?'}
                                    </button>
                                </div>
                                <div className="w-3 h-3 bg-slate-900 transform rotate-45 absolute -bottom-1.5 left-1/2 -translate-x-1/2"></div>
                            </div>
                        )}
                    </span>
                  );
                }
              })}
              {' '}
            </span>
          );
        })}
        
        {!showResults && !effectiveReadOnly && (
            <div className="mt-12 flex justify-end">
                <button 
                    onClick={checkAnswers} 
                    className={`${highlightedField ? 'bg-rose-500 animate-pulse ring-4 ring-rose-200' : 'bg-slate-900 hover:bg-slate-800'} text-white px-8 py-3 rounded-xl font-bold text-base transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center gap-2`}
                >
                    <span>{highlightedField ? 'Complete All Fields' : 'Check Answers'}</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </button>
            </div>
        )}
      </div>
    );
  };

  const renderReadingMatching = () => {
    return (
      <div className="flex flex-col lg:flex-row gap-8 max-w-7xl mx-auto">
        <div className="lg:w-1/3 order-1 lg:order-2">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:sticky lg:top-24">
                <h3 className="font-bold text-slate-800 mb-4 uppercase text-xs tracking-wider">Headings</h3>
                <div className="grid gap-3">
                    {story.template?.map((heading, idx) => (
                        <div key={idx} className="bg-amber-50 p-3 rounded-xl border border-amber-100 text-amber-900 text-sm font-medium">
                            <span className="font-bold mr-2 text-amber-600">{idx + 1}.</span> {heading}
                        </div>
                    ))}
                </div>
            </div>
        </div>
        <div className="lg:w-2/3 order-2 lg:order-1 grid gap-8">
            {story.texts?.map((textItem) => {
                const isCorrect = validation[textItem.letter];
                const correctAnswers = story.readingAnswers![textItem.letter] || [];
                return (
                    <div id={`input-${textItem.letter}`} key={textItem.letter} className={`bg-white rounded-2xl p-8 shadow-sm border border-slate-100 relative group hover:shadow-md transition-shadow ${highlightedField === textItem.letter ? 'ring-4 ring-rose-100 border-rose-500 animate-pulse' : ''}`}>
                        <div className="absolute -left-4 -top-4 w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center font-bold text-lg shadow-lg rotate-3 group-hover:rotate-6 transition-transform">
                            {textItem.letter}
                        </div>
                        <p className="text-slate-700 leading-relaxed text-lg mb-6">{textItem.content}</p>
                        <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-50">
                            <span className="text-xs font-bold text-slate-400 uppercase">Match:</span>
                            <div className="flex gap-2 flex-wrap justify-end">
                                {story.template?.map((_, idx) => {
                                    const num = (idx + 1).toString();
                                    const isSelected = inputs[textItem.letter] === num;
                                    const isThisCorrect = correctAnswers.includes(idx + 1);
                                    let btnClass = "bg-slate-100 text-slate-500 hover:bg-slate-100 border-2 border-transparent";
                                    if (showResults) {
                                        if (isSelected && isThisCorrect) btnClass = "bg-emerald-500 text-white border-emerald-500";
                                        else if (isSelected) btnClass = "bg-rose-500 text-white border-rose-500";
                                        else if (isThisCorrect && !isSelected) btnClass = "text-emerald-600 border-emerald-500 border-2";
                                        else btnClass = "opacity-30";
                                    } else if (isSelected) {
                                        btnClass = "bg-indigo-600 text-white shadow-md ring-2 ring-indigo-200 border-indigo-600";
                                    }
                                    return (
                                        <button key={num} onClick={() => handleReadingSelection(textItem.letter, num)} disabled={showResults || effectiveReadOnly} className={`w-10 h-10 rounded-xl text-sm font-bold transition-all flex items-center justify-center ${btnClass} ${effectiveReadOnly ? 'opacity-70 cursor-not-allowed' : ''}`}>
                                            {num}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
    );
  };

  const renderTrueFalse = () => {
      return (
          <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-140px)]">
              <div className="lg:w-1/2 h-full flex flex-col">
                  <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 h-full overflow-y-auto custom-scrollbar">
                      <div className="prose prose-lg text-slate-700 leading-loose max-w-none">
                          <p className="whitespace-pre-line">{story.text}</p>
                      </div>
                  </div>
              </div>
              <div className="lg:w-1/2 flex flex-col gap-4 overflow-y-auto custom-scrollbar pb-10">
                  {story.questions?.map((q) => {
                      return (
                          <div id={`input-${q.id}`} key={q.id} className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-100 ${highlightedField === q.id.toString() ? 'ring-4 ring-rose-100 border-rose-500 animate-pulse' : ''}`}>
                              <div className="flex gap-4 mb-4">
                                  <span className="font-bold text-indigo-100 text-xl">{q.id}.</span>
                                  <p className="font-medium text-slate-800 text-lg">{q.text}</p>
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                  {q.options?.map((opt, idx) => {
                                      const isSelected = inputs[q.id.toString()] === (idx + 1).toString();
                                      const isThisCorrectOption = (idx + 1) === q.answer;
                                      let btnClass = "bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-300 hover:bg-white";
                                      if (showResults) {
                                          if (isSelected && isThisCorrectOption) btnClass = "bg-emerald-500 border-emerald-500 text-white shadow-md";
                                          else if (isSelected) btnClass = "bg-rose-500 border-rose-500 text-white shadow-md";
                                          else if (isThisCorrectOption && !isSelected) btnClass = "bg-transparent border-2 border-emerald-500 text-emerald-600 font-bold";
                                          else btnClass = "opacity-50";
                                      } else if (isSelected) {
                                          btnClass = "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm ring-1 ring-indigo-200";
                                      }
                                      return (
                                          <button key={idx} onClick={() => handleTrueFalseSelection(q.id, idx)} disabled={showResults || effectiveReadOnly} className={`py-3 rounded-xl text-sm font-bold transition-all border-2 flex items-center justify-center gap-2 ${btnClass} ${effectiveReadOnly ? 'opacity-70 cursor-not-allowed' : ''}`}>
                                              {opt}
                                          </button>
                                      );
                                  })}
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  };

  return (
    <div className="pb-10 min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <button 
                    onClick={onBack} 
                    className="p-2 -ml-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all"
                    title="Back to Menu"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                </button>
                
                <div className="flex flex-col">
                    <h1 className="text-sm font-bold text-slate-800 leading-tight line-clamp-1 md:text-base">{story.title}</h1>
                    <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <span>{type.replace('_', ' ')}</span>
                        {saveStatus !== 'idle' && (
                            <span className={`flex items-center gap-1 transition-opacity duration-300 ${saveStatus === 'saving' ? 'opacity-100' : 'opacity-100'}`}>
                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                {saveStatus === 'saving' ? (
                                    <span className="text-indigo-500 flex items-center gap-1">
                                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Saving...
                                    </span>
                                ) : (
                                    <span className="text-emerald-500 flex items-center gap-1 animate-in fade-in slide-in-from-left-1 duration-300">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                        Saved
                                    </span>
                                )}
                            </span>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
               {(showResults || isReviewMode) && (
                   <div className="relative" ref={historyDropdownRef}>
                       <button 
                           onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                           className="flex items-center gap-2 bg-slate-50 pl-3 pr-2 py-1.5 rounded-full border border-slate-200 hover:border-indigo-200 hover:bg-white transition-all group"
                       >
                           <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${score === (viewingResult?.max_score || Object.keys(validation).length) ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-200 text-slate-700'}`}>
                               {(type !== ExerciseType.WRITING && type !== ExerciseType.SPEAKING && type !== ExerciseType.ORAL_SPEECH) 
                                   ? `${score}/${viewingResult?.max_score || Object.keys(validation).length}`
                                   : "Готово"}
                           </span>
                           <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isHistoryOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                               <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                           </svg>
                       </button>

                   {isHistoryOpen && (
                       <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                           <div className="flex items-center justify-between px-3 py-2 mb-1">
                               <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">История попыток</span>
                               <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{history.length} всего</span>
                           </div>
                           
                           <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-1 mb-2 pr-1">
                               {history.map((res, idx) => {
                                   const isSelected = viewingResult?.id === res.id;
                                   const attemptNum = history.length - idx;
                                   const date = new Date(res.created_at).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' });
                                   
                                   return (
                                       <button
                                           key={res.id}
                                           onClick={() => {
                                               setViewingResult(res);
                                               setIsHistoryOpen(false);
                                           }}
                                           className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-between group ${
                                               isSelected 
                                                   ? 'bg-indigo-50 text-indigo-900 border border-indigo-100' 
                                                   : 'hover:bg-slate-50 text-slate-600 border border-transparent'
                                           }`}
                                       >
                                           <div className="flex flex-col">
                                               <span className="font-bold">Попытка {attemptNum}</span>
                                               <span className="text-[10px] text-slate-400 font-medium">{date}</span>
                                           </div>
                                           <div className="flex items-center gap-2">
                                               <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                                                   res.score === res.max_score 
                                                       ? 'bg-emerald-100 text-emerald-700' 
                                                       : 'bg-slate-100 text-slate-500'
                                               }`}>
                                                   {(type !== ExerciseType.WRITING && type !== ExerciseType.SPEAKING && type !== ExerciseType.ORAL_SPEECH)
                                                       ? `${res.score}/${res.max_score}`
                                                       : "Done"}
                                               </span>
                                               {isSelected && <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                           </div>
                                       </button>
                                   );
                               })}
                           </div>
                           
                           <div className="border-t border-slate-100 my-2 pt-2">
                               <button
                                   onClick={() => {
                                       setViewingResult(null);
                                       setIsHistoryOpen(false);
                                   }}
                                   className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-95 ${
                                       !viewingResult 
                                           ? 'bg-emerald-500 text-white ring-2 ring-emerald-200 ring-offset-1' 
                                           : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100'
                                   }`}
                               >
                                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                   Повторить
                               </button>
                           </div>
                       </div>
                   )}
               </div>
           )}

        </div>
      </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 mb-8 text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">{story.title}</h2>
        <div className="h-1 w-20 bg-indigo-500 rounded-full mx-auto opacity-20"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        {isReviewMode && viewingResult ? (
            <div className="max-w-5xl mx-auto">
                {!(type === ExerciseType.GRAMMAR || type === ExerciseType.VOCABULARY) && (
                    <div className="mb-10">
                        <ResultReview 
                            details={viewingResult.details} 
                            score={viewingResult.score} 
                            maxScore={viewingResult.max_score} 
                            type={type} 
                        />
                    </div>
                )}
                <div className="space-y-6">
                    {(type === ExerciseType.GRAMMAR || type === ExerciseType.VOCABULARY) ? (
                        renderGrammarTemplate()
                    ) : (
                        <div className="bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-slate-100">
                            {type === ExerciseType.WRITING && (
                                <div className="prose prose-slate max-w-none">
                                    <p className="whitespace-pre-wrap leading-relaxed text-lg text-slate-700">{story.emailBody}</p>
                                </div>
                            )}
                            {type === ExerciseType.READING && (story.questions ? renderTrueFalse() : renderReadingMatching())}
                            {type === ExerciseType.LISTENING && renderListening()}
                        </div>
                    )}
                </div>
            </div>
        ) : (
            <>
                {!showResults && type !== ExerciseType.WRITING && type !== ExerciseType.SPEAKING && type !== ExerciseType.ORAL_SPEECH && type !== ExerciseType.LISTENING && type !== ExerciseType.GRAMMAR && (
                    <div className="mb-8 bg-indigo-50 border border-indigo-100 rounded-2xl p-5 flex items-start gap-4">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600 mt-1">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <div>
                            <h4 className="font-bold text-indigo-900 text-sm mb-1">Instructions</h4>
                            <p className="text-indigo-800/80 text-sm leading-relaxed">
                                {type === ExerciseType.VOCABULARY ? "Form new words from the capitalized ones to fit the context." :
                                type === ExerciseType.READING ? "Read the text carefully and answer the questions or match headings." :
                                "Follow the task guidelines."}
                            </p>
                        </div>
                    </div>
                )}
                
                {type === ExerciseType.WRITING && renderWritingLayout()}
                {(type === ExerciseType.SPEAKING || type === ExerciseType.ORAL_SPEECH) && renderSpeaking()}
                
                {(type === ExerciseType.GRAMMAR || type === ExerciseType.VOCABULARY) && renderGrammarTemplate()}
                
                {type === ExerciseType.READING && (
                    story.questions ? renderTrueFalse() : renderReadingMatching()
                )}

                {type === ExerciseType.LISTENING && renderListening()}

                {!showResults && !effectiveReadOnly && type !== ExerciseType.WRITING && type !== ExerciseType.SPEAKING && type !== ExerciseType.ORAL_SPEECH && type !== ExerciseType.LISTENING && type !== ExerciseType.GRAMMAR && type !== ExerciseType.VOCABULARY && (
                    <div className="mt-12 flex justify-center pb-20">
                        <button 
                            onClick={checkAnswers} 
                            className={`${highlightedField ? 'bg-rose-500 animate-pulse ring-4 ring-rose-200' : 'bg-slate-900 hover:bg-slate-800'} text-white px-10 py-4 rounded-2xl font-bold text-lg transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:scale-95 flex items-center gap-3`}
                        >
                            <span>{highlightedField ? 'Complete All Fields' : 'Check Answers'}</span>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </button>
                    </div>
                )}
                
                {/* Fallback for unknown types */}
                {!Object.values(ExerciseType).includes(type) && (
                    <div className="text-center p-10 text-slate-400">
                        Unknown exercise type. Please contact support.
                    </div>
                )}
            </>
        )}
      </div>
      {renderAiModal()}
    </div>
  );
};

export default ExerciseView;
