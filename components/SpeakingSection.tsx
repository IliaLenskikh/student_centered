import React, { useState, useRef, useEffect } from 'react';
import { Story } from '../types';
import { Mic, Square, CheckCircle } from 'lucide-react';

interface SpeakingSectionProps {
  task1: Story;
  task2: Story;
  task3: Story;
  spread: number;
  onAudioRecorded: (taskId: string, blob: Blob) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  isReadOnly?: boolean;
  speakingUrls?: Record<string, string>;
}

export const SpeakingSection: React.FC<SpeakingSectionProps> = ({ task1, task2, task3, spread, onAudioRecorded, onSubmit, isSubmitting, isReadOnly, speakingUrls }) => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start();
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Не удалось получить доступ к микрофону. Пожалуйста, разрешите доступ в настройках браузера.");
    }
  };

  const stopRecording = (taskId: string) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        onAudioRecorded(taskId, audioBlob);
        
        // Stop all tracks to release microphone
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current.stop();
    }
  };

  // Task 1 State
  const [t1State, setT1State] = useState<'initial' | 'prep' | 'recording' | 'done'>('initial');
  const [t1Time, setT1Time] = useState(90); // 1.5 mins prep, 2 mins rec
  const t1TimerRef = useRef<NodeJS.Timeout | null>(null);

  // Task 2 State
  const [t2Answers, setT2Answers] = useState<Record<number, boolean>>({});
  const [t2Recording, setT2Recording] = useState<number | null>(null);

  // Task 3 State
  const [t3State, setT3State] = useState<'initial' | 'prep' | 'recording' | 'done'>('initial');
  const [t3Time, setT3Time] = useState(90);
  const t3TimerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to format time
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Task 1 Logic
  const startT1Prep = () => {
    setT1State('prep');
    setT1Time(90);
    if (t1TimerRef.current) clearInterval(t1TimerRef.current);
    t1TimerRef.current = setInterval(() => {
      setT1Time(prev => {
        if (prev <= 1) {
          clearInterval(t1TimerRef.current!);
          startT1Recording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startT1Recording = async () => {
    await startRecording();
    setT1State('recording');
    setT1Time(120);
    if (t1TimerRef.current) clearInterval(t1TimerRef.current);
    t1TimerRef.current = setInterval(() => {
      setT1Time(prev => {
        if (prev <= 1) {
          clearInterval(t1TimerRef.current!);
          stopRecording('task1');
          setT1State('done');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopT1Recording = () => {
    stopRecording('task1');
    if (t1TimerRef.current) clearInterval(t1TimerRef.current);
    setT1State('done');
  };

  // Task 2 Logic
  const toggleT2Recording = async (idx: number) => {
    if (t2Recording === idx) {
      stopRecording(`task2_${idx}`);
      setT2Recording(null);
      setT2Answers(prev => ({ ...prev, [idx]: true }));
    } else {
      if (t2Recording !== null) {
         stopRecording(`task2_${t2Recording}`);
         setT2Answers(prev => ({ ...prev, [t2Recording]: true }));
      }
      await startRecording();
      setT2Recording(idx);
    }
  };

  // Task 3 Logic
  const startT3Prep = () => {
    setT3State('prep');
    setT3Time(90);
    if (t3TimerRef.current) clearInterval(t3TimerRef.current);
    t3TimerRef.current = setInterval(() => {
      setT3Time(prev => {
        if (prev <= 1) {
          clearInterval(t3TimerRef.current!);
          startT3Recording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startT3Recording = async () => {
    await startRecording();
    setT3State('recording');
    setT3Time(120);
    if (t3TimerRef.current) clearInterval(t3TimerRef.current);
    t3TimerRef.current = setInterval(() => {
      setT3Time(prev => {
        if (prev <= 1) {
          clearInterval(t3TimerRef.current!);
          stopRecording('task3');
          setT3State('done');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopT3Recording = () => {
    stopRecording('task3');
    if (t3TimerRef.current) clearInterval(t3TimerRef.current);
    setT3State('done');
  };

  return (
    <>
      {spread === 6 && (
        <>
          {/* Page 15: Instructions */}
          <div className="bg-white shadow-2xl w-full aspect-[1/1.414] p-[8%] flex flex-col relative border border-slate-300 overflow-hidden text-black font-serif select-none">
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 text-[14px] leading-tight">
              <div className="text-center mb-6">
                <h2 className="text-[16px] font-bold leading-tight">Демонстрационный вариант</h2>
                <h2 className="text-[16px] font-bold leading-tight">контрольных измерительных материалов</h2>
                <h2 className="text-[16px] font-bold leading-tight">основного государственного экзамена 2026 года</h2>
                <h2 className="text-[16px] font-bold leading-tight">по АНГЛИЙСКОМУ ЯЗЫКУ</h2>
                <h3 className="text-[15px] font-bold mt-6">УСТНАЯ ЧАСТЬ</h3>
                <h4 className="font-bold mt-4 mb-6">Инструкция по выполнению работы</h4>
              </div>
              
              <div className="space-y-2 text-justify leading-normal text-[13px]">
                <p className="indent-6">Устная часть КИМ ОГЭ по английскому языку включает в себя 3 задания.</p>
                <p className="indent-6"><b>Задание 1</b> предусматривает чтение вслух небольшого текста научно-популярного характера. Время на подготовку – 1,5 минуты.</p>
                <p className="indent-6">В <b>задании 2</b> предлагается принять участие в условном диалоге-расспросе: ответить на шесть услышанных в аудиозаписи вопросов телефонного опроса.</p>
                <p className="indent-6">При выполнении <b>задания 3</b> необходимо построить связное монологическое высказывание на определённую тему с опорой на план. Время на подготовку – 1,5 минуты.</p>
                <p className="indent-6">Общее время ответа одного участника ОГЭ (включая время на подготовку) – 15 минут. Каждое последующее задание выдаётся после окончания выполнения предыдущего задания. Всё время ответа ведётся аудиозапись. Постарайтесь полностью выполнить поставленные задачи, говорить ясно и чётко, не отходить от темы и следовать предложенному плану ответа. Так Вы сможете набрать наибольшее количество баллов.</p>
                <p className="text-center italic font-bold mt-8">Желаем успеха!</p>
              </div>
            </div>
          </div>

          {/* Page 16: Task 1 and Task 2 */}
          <div className="bg-white shadow-2xl w-full aspect-[1/1.414] p-[8%] flex flex-col relative border border-slate-300 overflow-hidden text-black font-serif select-none">
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 text-[14px] leading-tight">
              
              {/* Task 1 */}
              <div className="flex gap-4 items-start mb-8">
                <div className="w-8 h-6 border border-black flex items-center justify-center font-bold shrink-0 text-[14px] mt-1">
                  1
                </div>
                <div className="flex-1">
                  <p className="font-bold text-[13px] mb-4 leading-snug">Task 1. You are going to read the text aloud. You have 1.5 minutes to read the text silently, and then be ready to read it aloud. Remember that you will not have more than 2 minutes for reading aloud.</p>
                  
                  <div className="border border-black p-4 relative min-h-[150px]">
                    {t1State === 'initial' && !isReadOnly && (
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-md z-10 flex flex-col items-center justify-center p-4 text-center">
                        <button 
                          onClick={startT1Prep}
                          className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-md flex items-center gap-2"
                        >
                          <Mic className="w-4 h-4" />
                          Начать подготовку (1.5 мин)
                        </button>
                      </div>
                    )}

                    {isReadOnly && speakingUrls?.task1 && (
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-md z-10 flex flex-col items-center justify-center p-4 text-center">
                        <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-200 flex flex-col items-center gap-2">
                          <span className="font-bold text-slate-700 text-sm">Ваш ответ:</span>
                          <audio controls src={speakingUrls.task1} className="h-10" />
                        </div>
                      </div>
                    )}

                    {(t1State === 'prep' || t1State === 'recording') && (
                      <div className="flex items-center justify-end gap-2 bg-slate-800 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg w-fit ml-auto mb-4">
                        {t1State === 'prep' ? 'Подготовка:' : <><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> Запись:</>}
                        <span className="font-mono text-sm">{formatTime(t1Time)}</span>
                      </div>
                    )}

                    <div className={`text-[13px] leading-relaxed text-justify ${t1State === 'initial' ? 'blur-sm' : ''}`}>
                      {task1.text}
                    </div>

                    {t1State === 'prep' && (
                      <div className="mt-6 flex justify-center">
                        <button 
                          onClick={startT1Recording}
                          className="px-6 py-2 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-colors shadow-md flex items-center gap-2"
                        >
                          <Mic className="w-4 h-4" />
                          Начать запись досрочно
                        </button>
                      </div>
                    )}
                    
                    {t1State === 'recording' && (
                      <div className="mt-6 flex justify-center">
                        <button 
                          onClick={stopT1Recording}
                          className="px-6 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 transition-colors shadow-md flex items-center gap-2"
                        >
                          <Square className="w-4 h-4" />
                          Завершить запись
                        </button>
                      </div>
                    )}

                    {t1State === 'done' && (
                      <div className="mt-6 flex justify-center text-green-600 font-bold flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        Ответ записан
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Task 2 */}
              <div className="flex gap-4 items-start">
                <div className="w-8 h-6 border border-black flex items-center justify-center font-bold shrink-0 text-[14px] mt-1">
                  2
                </div>
                <div className="flex-1">
                  <p className="font-bold text-[13px] mb-2 leading-snug">Task 2. You are going to take part in a telephone survey. You have to answer six questions. Give full answers to the questions.</p>
                  <p className="font-bold text-[13px] mb-4 leading-snug">Remember that you have 40 seconds to answer each question.</p>
                  
                  <div className="border border-black p-4">
                    <div className="flex items-center gap-3 bg-slate-100 px-4 py-2 rounded-xl shadow-inner border border-slate-200 mb-6">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Аудиозапись:</span>
                      <audio controls className="h-8 w-full max-w-[300px]">
                        <source src={task2.audioUrl} type="audio/mpeg" />
                      </audio>
                    </div>
                    
                    <div className="space-y-4 text-[13px]">
                      {task2.speakingQuestions?.map((q, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">Student (Question {idx + 1}):</span>
                            <div className="flex-1 border-b border-black/30 h-5 flex items-end pb-1 relative">
                              {isReadOnly && speakingUrls?.[`task2_${idx}`] ? (
                                <audio controls src={speakingUrls[`task2_${idx}`]} className="h-6 w-full max-w-[200px] absolute bottom-0" />
                              ) : t2Answers[idx] ? (
                                <span className="text-green-600 font-bold text-[10px] flex items-center gap-1 absolute bottom-0">
                                  <CheckCircle className="w-3 h-3" /> Записано
                                </span>
                              ) : (
                                <span className="text-slate-400 italic text-[10px] absolute bottom-0">Ваш ответ...</span>
                              )}
                            </div>
                            {!isReadOnly && (
                              <button
                                onClick={() => toggleT2Recording(idx)}
                                className={`w-6 h-6 rounded-full flex items-center justify-center transition-all shadow-sm shrink-0 ${
                                  t2Recording === idx 
                                    ? 'bg-red-500 text-white animate-pulse' 
                                    : t2Answers[idx] 
                                      ? 'bg-slate-100 text-slate-400' 
                                      : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                                }`}
                              >
                                {t2Recording === idx ? <Square className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </>
      )}

      {spread === 7 && (
        <>
          {/* Page 17: Task 3 */}
          <div className="bg-white shadow-2xl w-full aspect-[1/1.414] p-[8%] flex flex-col relative border border-slate-300 overflow-hidden text-black font-serif select-none">
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 text-[14px] leading-tight">
              {/* Task 3 */}
              <div className="flex gap-4 items-start">
                <div className="w-8 h-6 border border-black flex items-center justify-center font-bold shrink-0 text-[14px] mt-1">
                  3
                </div>
                <div className="flex-1">
                  <p className="font-bold text-[14px] mb-2 leading-snug">{task3.text}</p>
                  
                  <div className="relative min-h-[150px]">
                    {t3State === 'initial' && !isReadOnly && (
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-md z-10 flex flex-col items-center justify-center p-4 text-center">
                        <button 
                          onClick={startT3Prep}
                          className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-md flex items-center gap-2"
                        >
                          <Mic className="w-4 h-4" />
                          Начать подготовку (1.5 мин)
                        </button>
                      </div>
                    )}

                    {isReadOnly && speakingUrls?.task3 && (
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-md z-10 flex flex-col items-center justify-center p-4 text-center">
                        <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-200 flex flex-col items-center gap-2">
                          <span className="font-bold text-slate-700 text-sm">Ваш ответ:</span>
                          <audio controls src={speakingUrls.task3} className="h-10" />
                        </div>
                      </div>
                    )}

                    {(t3State === 'prep' || t3State === 'recording') && (
                      <div className="flex items-center justify-end gap-2 bg-slate-800 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg w-fit ml-auto mb-4">
                        {t3State === 'prep' ? 'Подготовка:' : <><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> Запись:</>}
                        <span className="font-mono text-sm">{formatTime(t3Time)}</span>
                      </div>
                    )}

                    <div className={`text-[14px] leading-relaxed ${t3State === 'initial' ? 'blur-sm' : ''}`}>
                      <p className="font-bold mb-2">Remember to say:</p>
                      <ul className="list-disc pl-5 space-y-1 mb-6">
                        {task3.speakingQuestions?.map((q, idx) => (
                          <li key={idx}>{q}</li>
                        ))}
                      </ul>
                      <p className="font-bold">You have to talk continuously.</p>
                    </div>

                    {t3State === 'prep' && (
                      <div className="mt-8 flex justify-center">
                        <button 
                          onClick={startT3Recording}
                          className="px-6 py-2 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-colors shadow-md flex items-center gap-2"
                        >
                          <Mic className="w-4 h-4" />
                          Начать запись досрочно
                        </button>
                      </div>
                    )}
                    
                    {t3State === 'recording' && (
                      <div className="mt-8 flex justify-center">
                        <button 
                          onClick={stopT3Recording}
                          className="px-6 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 transition-colors shadow-md flex items-center gap-2"
                        >
                          <Square className="w-4 h-4" />
                          Завершить запись
                        </button>
                      </div>
                    )}

                    {t3State === 'done' && (
                      <div className="mt-8 flex justify-center text-green-600 font-bold flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        Ответ записан
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Page 18: End of Exam */}
          <div className="bg-white shadow-2xl w-full aspect-[1/1.414] p-[8%] flex flex-col relative border border-slate-300 overflow-hidden text-black font-serif select-none">
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-24 h-24 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-6">
                <CheckCircle className="w-12 h-12" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-4">Все задания выполнены</h2>
              <p className="text-slate-500 max-w-xs mb-8">Вы завершили письменную и устную части экзамена. Нажмите кнопку ниже, чтобы сдать работу.</p>
              
              {!isReadOnly && (
                <button 
                  onClick={onSubmit}
                  disabled={isSubmitting}
                  className={`px-8 py-4 bg-slate-900 text-white rounded-xl font-bold text-lg transition-all shadow-xl active:scale-95 flex items-center gap-3 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-800'}`}
                >
                  {isSubmitting ? 'Отправка...' : 'Сдать экзамен'}
                </button>
              )}
              {isReadOnly && (
                <button 
                  onClick={() => window.history.back()}
                  className="px-8 py-4 bg-slate-100 text-slate-700 rounded-xl font-bold text-lg hover:bg-slate-200 transition-all shadow-md active:scale-95 flex items-center gap-3"
                >
                  Вернуться к списку
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};
