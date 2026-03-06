
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { listeningStories } from '../data/listening';
import { readingStories } from '../data/reading';
import { readingTrueFalseStories } from '../data/readingTrueFalse';
import { grammarStories } from '../data/grammar';
import { vocabStories } from '../data/vocabulary';
import { writingStories } from '../data/writing';
import { speakingStories } from '../data/speaking';
import { oralStories } from '../data/oral';
import { monologueStories } from '../data/monologue';
import { Story } from '../types';
import { SpeakingSection } from './SpeakingSection';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const PaperPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-white shadow-2xl w-full aspect-[1/1.414] p-[8%] flex flex-col relative border border-slate-300 overflow-hidden text-black font-serif select-none">
    {/* Content */}
    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 text-[14px] leading-tight">
      {children}
    </div>
  </div>
);

export const ExamView: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isReadOnly = !!id;

  const [examData, setExamData] = useState<{
    listening: Story;
    readingMatching: Story;
    readingTF: Story;
    grammar: Story;
    vocab: Story;
    writing: Story;
    speakingTask1: Story;
    speakingTask2: Story;
    speakingTask3: Story;
  } | null>(() => {
    if (isReadOnly) return null;
    const saved = localStorage.getItem('exam_data');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved exam data", e);
        return null;
      }
    }
    return null;
  });
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    if (isReadOnly) return {};
    const saved = localStorage.getItem('exam_answers');
    return saved ? JSON.parse(saved) : {};
  });
  const [audioAnswers, setAudioAnswers] = useState<Record<string, Blob>>({});
  const [speakingUrls, setSpeakingUrls] = useState<Record<string, string>>({});
  const [currentSpread, setCurrentSpread] = useState(() => {
    if (isReadOnly) return 0;
    const saved = localStorage.getItem('exam_current_spread');
    return saved ? parseInt(saved, 10) : 0;
  }); // 0: 3-4, 1: 5-6, 2: 7-8, 3: 9-10, 4: 11-12, 5: 13-14, 6: 15-16, 7: 17-18
  const [examTimeRemaining, setExamTimeRemaining] = useState(() => {
    if (isReadOnly) return 0;
    const saved = localStorage.getItem('exam_time_remaining');
    return saved ? parseInt(saved, 10) : 135 * 60; // 135 minutes
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(isReadOnly);
  const { userProfile } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (isReadOnly) return;
    localStorage.setItem('exam_answers', JSON.stringify(answers));
  }, [answers, isReadOnly]);

  useEffect(() => {
    if (isReadOnly) return;
    localStorage.setItem('exam_current_spread', currentSpread.toString());
  }, [currentSpread, isReadOnly]);

  useEffect(() => {
    if (isReadOnly) return;
    const timer = setInterval(() => {
      setExamTimeRemaining((prev) => {
        const newTime = prev > 0 ? prev - 1 : 0;
        localStorage.setItem('exam_time_remaining', newTime.toString());
        return newTime;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isReadOnly]);

  const formatExamTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const loadPastExam = async () => {
      if (!id) return;
      try {
        const { data, error } = await supabase
          .from('exam_submissions')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        
        setExamData(data.exam_data);
        setAnswers(data.answers || {});
        if (data.speaking_urls) {
          setSpeakingUrls(data.speaking_urls);
        }
      } catch (error) {
        console.error('Error loading past exam:', error);
        showToast('Ошибка при загрузке экзамена', 'error');
        navigate('/exam');
      } finally {
        setIsLoading(false);
      }
    };

    if (isReadOnly) {
      loadPastExam();
    } else if (!examData) {
      const newData = {
        listening: listeningStories[Math.floor(Math.random() * listeningStories.length)],
        readingMatching: readingStories[Math.floor(Math.random() * readingStories.length)],
        readingTF: readingTrueFalseStories[Math.floor(Math.random() * readingTrueFalseStories.length)],
        grammar: grammarStories[Math.floor(Math.random() * grammarStories.length)],
        vocab: vocabStories[Math.floor(Math.random() * vocabStories.length)],
        writing: writingStories[Math.floor(Math.random() * writingStories.length)],
        speakingTask1: speakingStories[Math.floor(Math.random() * speakingStories.length)],
        speakingTask2: oralStories[Math.floor(Math.random() * oralStories.length)],
        speakingTask3: monologueStories[Math.floor(Math.random() * monologueStories.length)],
      };
      setExamData(newData);
      localStorage.setItem('exam_data', JSON.stringify(newData));
    }
  }, [id, isReadOnly]);

  if (isLoading || !examData) {
    return (
      <div className="min-h-screen bg-slate-300 py-8 px-4 flex justify-center items-center">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  const handleInputChange = (inputId: string, value: string) => {
    if (isReadOnly) return;
    setAnswers(prev => ({ ...prev, [inputId]: value.toUpperCase() }));
  };

  const handleAudioRecorded = (taskId: string, blob: Blob) => {
    setAudioAnswers(prev => ({ ...prev, [taskId]: blob }));
  };

  const handleSubmitExam = async () => {
    if (!userProfile?.id) {
      showToast("Пожалуйста, войдите в систему, чтобы сохранить результаты.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Upload audio files
      const speakingUrls: Record<string, string> = {};
      
      for (const [taskId, blob] of Object.entries(audioAnswers)) {
        const fileName = `${userProfile.id}/${Date.now()}_${taskId}.webm`;
        const { data, error } = await supabase.storage
          .from('audio-responses')
          .upload(fileName, blob, {
            contentType: 'audio/webm',
            upsert: false
          });
          
        if (error) {
          console.error("Error uploading audio:", error);
          continue;
        }
        
        if (data) {
          const { data: { publicUrl } } = supabase.storage
            .from('audio-responses')
            .getPublicUrl(fileName);
          speakingUrls[taskId] = publicUrl;
        }
      }

      // 2. Save exam submission
      const { error } = await supabase
        .from('exam_submissions')
        .insert({
          student_id: userProfile.id,
          exam_data: examData,
          answers: answers,
          speaking_urls: speakingUrls
        });

      if (error) throw error;

      // Clear local storage on successful submission
      localStorage.removeItem('exam_answers');
      localStorage.removeItem('exam_current_spread');
      localStorage.removeItem('exam_time_remaining');
      localStorage.removeItem('exam_data');

      showToast("Экзамен успешно сдан!", "success");
      navigate('/');
    } catch (error: any) {
      console.error("Error submitting exam:", error);
      showToast("Произошла ошибка при отправке экзамена.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderListening = () => {
    const { listening } = examData;
    if (!listening.subStories) return null;
    const part1 = listening.subStories[0];
    const part2 = listening.subStories[1];
    const part3 = listening.subStories[2];

    if (currentSpread === 0) {
      return (
        <>
          <PaperPage>
            <div className="text-center mb-8">
              <h2 className="text-[16px] font-bold leading-tight">Демонстрационный вариант</h2>
              <h2 className="text-[16px] font-bold leading-tight">контрольных измерительных материалов</h2>
              <h2 className="text-[16px] font-bold leading-tight">основного государственного экзамена 2026 года</h2>
              <h2 className="text-[16px] font-bold leading-tight">по АНГЛИЙСКОМУ ЯЗЫКУ</h2>
              <h3 className="text-[15px] font-bold mt-6">ПИСЬМЕННАЯ ЧАСТЬ</h3>
            </div>
            <div className="space-y-3 text-justify leading-normal text-[13px]">
              <h4 className="font-bold text-center mb-4">Инструкция по выполнению работы</h4>
              <p>Письменная часть экзаменационной работы по английскому языку состоит из четырёх разделов, включающих в себя 35 заданий.</p>
              <p>На выполнение заданий письменной части экзаменационной работы отводится 2 часа (120 минут).</p>
              <p>В разделе 1 (задания по аудированию) предлагается прослушать несколько текстов и выполнить 11 заданий на понимание прослушанных текстов. Рекомендуемое время на выполнение заданий данного раздела – 30 минут.</p>
              <p>Раздел 2 (задания по чтению) содержит 8 заданий на понимание прочитанных текстов. Рекомендуемое время на выполнение заданий раздела – 30 минут.</p>
              <p>Раздел 3 (задания по грамматике и лексике) состоит из 15 заданий. Рекомендуемое время на выполнение заданий раздела – 30 минут.</p>
              <p>Ответы к заданиям 5 и 12 записываются в виде последовательности цифр. Эту последовательность цифр запишите в поле ответа в тексте работы, а затем перенесите в бланк ответов № 1.</p>
              <p>Ответы к заданиям 1–4 и 13–19 записываются в виде одной цифры, которая соответствует номеру правильного ответа. Эту цифру запишите в поле ответа в тексте работы, а затем перенесите в бланк ответов № 1.</p>
              <p>Ответы к заданиям 6–11 записываются в виде одного слова, а к заданиям 20–34 – в виде одного или нескольких слов. Ответ запишите в поле ответа в тексте работы, а затем перенесите в бланк ответов № 1.</p>
              <p>В разделе 4 (задание по письму) дано 1 задание, предлагающее написать электронное письмо. Задание выполняется на бланке ответов № 2. Рекомендуемое время на выполнение задания – 30 минут.</p>
              <p>Все бланки заполняются яркими чёрными чернилами. Допускается использование гелевой или капиллярной ручки.</p>
              <p>При выполнении заданий можно пользоваться черновиком. <b>Записи в черновике, а также в тексте контрольных измерительных материалов не учитываются при оценивании работы.</b></p>
              <p>Баллы, полученные Вами за выполненные задания, суммируются. Постарайтесь выполнить как можно больше заданий и набрать наибольшее количество баллов.</p>
              <p>После завершения работы проверьте, чтобы ответ на каждое задание в бланках ответов № 1 и № 2 был записан под правильным номером.</p>
              <p className="text-center italic font-bold mt-6">Желаем успеха!</p>
            </div>
          </PaperPage>
          <PaperPage>
            <div className="text-center mb-6">
              <h2 className="text-[15px] font-bold">Раздел 1 (задания по аудированию)</h2>
            </div>
            <div className="border border-black p-3 mb-6 italic text-[13px] leading-tight text-justify">
              Вы услышите четыре коротких текста, обозначенных буквами <b>A, B, C, D</b>. В заданиях <b>1–4</b> запишите в поле ответа цифру <b>1, 2</b> или <b>3</b>, соответствующую выбранному Вами варианту ответа. Вы услышите запись дважды.
            </div>
            <div className="space-y-8">
              {part1.questions?.map((q) => (
                <div key={q.id} className="relative pl-14">
                  <div className="absolute left-0 top-0 w-10 h-8 border border-black flex items-center justify-center font-bold text-[16px]">
                    {q.id}
                  </div>
                  <p className="mb-3 font-normal text-[15px] leading-snug">{q.text}</p>
                  <div className="space-y-1 ml-2 text-[14px]">
                    {q.options.map((opt, i) => (
                      <p key={i}>{i + 1}) {opt}</p>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-3 text-[15px]">
                    <span>Ответ:</span>
                    <input 
                      type="text" 
                      maxLength={1}
                      className="w-10 h-10 border border-black text-center outline-none focus:bg-slate-100 font-bold text-[18px]"
                      value={answers[`q${q.id}`] || ''}
                      onChange={(e) => handleInputChange(`q${q.id}`, e.target.value)}
                      readOnly={isReadOnly}
                    />
                  </div>
                </div>
              ))}
            </div>
          </PaperPage>
        </>
      );
    }

    return (
      <>
        <PaperPage>
          <div className="relative pl-14 mb-6">
            <div className="absolute left-0 top-0 w-10 h-8 border border-black flex items-center justify-center font-bold text-[16px]">
              5
            </div>
            <div className="border border-black p-3 italic text-[13px] leading-tight text-justify">
              Вы готовите тематическую радиопередачу с высказываниями пяти разных людей, обозначенных буквами <b>A, B, C, D, E</b>. Подберите к каждому высказыванию соответствующую его содержанию рубрику из списка <b>1–6</b>. Используйте каждую рубрику из списка только один раз. В списке есть <b>одна лишняя рубрика</b>. Вы услышите запись дважды.
            </div>
          </div>
          <div className="ml-14 space-y-1 mb-6 text-[14px]">
            {part2.template.map((heading, i) => (
              <p key={i} className="font-bold">{i + 1}. {heading}</p>
            ))}
          </div>
          <p className="ml-14 mb-4 text-[14px]">Запишите в таблицу выбранные цифры под соответствующими буквами.</p>
          <div className="ml-14">
            <table className="w-full border-collapse border border-black text-center text-[14px]">
              <thead>
                <tr>
                  <th className="border border-black p-2 font-normal w-1/4">Говорящий</th>
                  <th className="border border-black p-2 font-normal">A</th>
                  <th className="border border-black p-2 font-normal">B</th>
                  <th className="border border-black p-2 font-normal">C</th>
                  <th className="border border-black p-2 font-normal">D</th>
                  <th className="border border-black p-2 font-normal">E</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-black p-2 font-normal">Рубрика</td>
                  {['A', 'B', 'C', 'D', 'E'].map(letter => (
                    <td key={letter} className="border border-black p-0">
                      <input 
                        type="text" 
                        maxLength={1}
                        className="w-full h-12 text-center outline-none focus:bg-slate-100 font-bold text-[18px]"
                        value={answers[`matching_${letter}`] || ''}
                        onChange={(e) => handleInputChange(`matching_${letter}`, e.target.value)}
                        readOnly={isReadOnly}
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </PaperPage>
        <PaperPage>
          <div className="border border-black p-4 mb-8 italic text-[13px] leading-tight text-justify">
            Вы помогаете своему другу, юному радиожурналисту, проанализировать подготовленное им для передачи интервью. Прослушайте аудиозапись интервью и занесите данные в таблицу. Вы можете вписать <b>не более одного слова</b> (без артиклей) из прозвучавшего текста. Числа необходимо записывать буквами. Вы услышите запись дважды.
          </div>
          <div className="space-y-3 mb-10">
            {part3.tasks.map((task, idx) => {
              const qNum = 6 + idx;
              return (
                <div key={qNum} className="flex items-center gap-4">
                  <div className="w-10 h-8 border border-black flex items-center justify-center font-bold shrink-0 text-[16px]">
                    {qNum}
                  </div>
                  <div className="flex-1 border border-black p-2 flex justify-between items-center min-h-[40px]">
                    <span className="font-normal text-[14px]">{task.word}</span>
                    <input 
                      type="text" 
                      className="flex-1 ml-4 border-b border-black/30 outline-none bg-transparent px-2 font-bold text-[16px] text-indigo-900"
                      value={answers[`q${qNum}`] || ''}
                      onChange={(e) => handleInputChange(`q${qNum}`, e.target.value)}
                      readOnly={isReadOnly}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border border-black p-4 italic text-[12px] leading-tight bg-slate-50 text-justify">
            По окончании выполнения заданий <b>1–11</b> не забудьте перенести свои ответы в <b>БЛАНК ОТВЕТОВ № 1</b>! Запишите ответ справа от номера соответствующего задания, начиная с первой клеточки. При переносе ответов на задания <b>5</b> и <b>6–11</b> цифры или буквы записываются <u>без пробелов, запятых и других дополнительных символов</u>. Каждую цифру или букву пишите в отдельной клеточке в соответствии с приведёнными в бланке образцами.
          </div>
        </PaperPage>
      </>
    );
  };

  const renderReading = () => {
    const { readingMatching, readingTF } = examData;

    if (currentSpread === 2) {
      return (
        <>
          <PaperPage>
            <div className="text-center mb-6">
              <h2 className="text-[15px] font-bold">Раздел 2 (задания по чтению)</h2>
            </div>
            <div className="relative pl-14 mb-6">
              <div className="absolute left-0 top-0 w-10 h-8 border border-black flex items-center justify-center font-bold text-[16px]">
                12
              </div>
              <div className="border border-black p-3 italic text-[13px] leading-tight text-justify">
                Вы проводите информационный поиск в ходе выполнения проектной работы. Определите, в каком из текстов <b>A–F</b> содержатся ответы на интересующие Вас вопросы <b>1–7</b>. Один из вопросов останется без ответа. Занесите Ваши ответы в таблицу.
              </div>
            </div>
            <div className="ml-14 space-y-1 mb-6 text-[13px]">
              {readingMatching.template.map((q, i) => (
                <p key={i} className="font-bold">{q}</p>
              ))}
            </div>
            <div className="space-y-4 text-[13px] leading-snug text-justify">
              {readingMatching.texts?.slice(0, 4).map((t) => (
                <p key={t.letter}><b>{t.letter}.</b> {t.content}</p>
              ))}
            </div>
          </PaperPage>
          <PaperPage>
            <div className="space-y-4 text-[13px] leading-snug text-justify mb-8">
              {readingMatching.texts?.slice(4).map((t) => (
                <p key={t.letter}><b>{t.letter}.</b> {t.content}</p>
              ))}
            </div>
            <p className="mb-4 text-[14px]">Запишите в таблицу выбранные цифры под соответствующими буквами.</p>
            <div className="">
              <table className="w-full border-collapse border border-black text-center text-[14px]">
                <thead>
                  <tr>
                    <th className="border border-black p-2 font-normal w-1/4">Текст</th>
                    <th className="border border-black p-2 font-normal">A</th>
                    <th className="border border-black p-2 font-normal">B</th>
                    <th className="border border-black p-2 font-normal">C</th>
                    <th className="border border-black p-2 font-normal">D</th>
                    <th className="border border-black p-2 font-normal">E</th>
                    <th className="border border-black p-2 font-normal">F</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-black p-2 font-normal">Вопрос</td>
                    {['A', 'B', 'C', 'D', 'E', 'F'].map(letter => (
                      <td key={letter} className="border border-black p-0">
                        <input 
                          type="text" 
                          maxLength={1}
                          className="w-full h-12 text-center outline-none focus:bg-slate-100 font-bold text-[18px]"
                          value={answers[`reading_matching_${letter}`] || ''}
                          onChange={(e) => handleInputChange(`reading_matching_${letter}`, e.target.value)}
                          readOnly={isReadOnly}
                        />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </PaperPage>
        </>
      );
    }

    return (
      <>
        <PaperPage>
          <div className="border border-black p-3 mb-6 italic text-[13px] leading-tight text-justify">
            Прочитайте текст. Определите, какие из приведённых утверждений <b>13–19</b> соответствуют содержанию текста (<b>1 – True</b>), какие не соответствуют (<b>2 – False</b>) и о чём в тексте не сказано, то есть на основании текста нельзя дать ни положительного, ни отрицательного ответа (<b>3 – Not stated</b>). Запишите в поле ответа цифру <b>1, 2</b> или <b>3</b>, соответствующую выбранному Вами варианту ответа.
          </div>
          <div className="text-center mb-4">
            <h3 className="font-bold text-[16px]">{readingTF.title}</h3>
          </div>
          <div className="text-[13px] leading-snug text-justify whitespace-pre-wrap italic">
            {readingTF.text}
          </div>
        </PaperPage>
        <PaperPage>
          <div className="space-y-6">
            {readingTF.questions?.map((q, idx) => {
              const qNum = 13 + idx;
              return (
                <div key={q.id} className="relative pl-14">
                  <div className="absolute left-0 top-0 w-10 h-8 border border-black flex items-center justify-center font-bold text-[16px]">
                    {qNum}
                  </div>
                  <p className="mb-2 font-normal text-[15px] leading-snug">{q.text}</p>
                  <div className="space-y-1 ml-2 text-[14px]">
                    <p>1) True</p>
                    <p>2) False</p>
                    <p>3) Not stated</p>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[15px]">
                    <span>Ответ:</span>
                    <input 
                      type="text" 
                      maxLength={1}
                      className="w-10 h-10 border border-black text-center outline-none focus:bg-slate-100 font-bold text-[18px]"
                      value={answers[`q${qNum}`] || ''}
                      onChange={(e) => handleInputChange(`q${qNum}`, e.target.value)}
                      readOnly={isReadOnly}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-8 border border-black p-4 italic text-[12px] leading-tight bg-slate-50 text-justify">
            По окончании выполнения заданий <b>12–19</b> не забудьте перенести свои ответы в <b>БЛАНК ОТВЕТОВ № 1</b>! Запишите ответ справа от номера соответствующего задания, начиная с первой клеточки. При переносе ответа на задание <b>12</b> цифры записываются <u>без пробелов, запятых и других дополнительных символов</u>. Каждую цифру пишите в отдельной клеточке в соответствии с приведёнными в бланке образцами.
          </div>
        </PaperPage>
      </>
    );
  };

  const renderGrammarAndVocab = () => {
    const { grammar, vocab } = examData;

    return (
      <>
        <PaperPage>
          <div className="text-center mb-6">
            <h2 className="text-[15px] font-bold">Раздел 3 (задания по грамматике и лексике)</h2>
          </div>
          <div className="border border-black p-3 mb-6 italic text-[13px] leading-tight text-justify">
            Прочитайте приведённый ниже текст. Преобразуйте слова, напечатанные заглавными буквами в конце строк, обозначенных номерами <b>20–28</b>, так, чтобы они грамматически соответствовали содержанию текста. Заполните пропуски полученными словами. Каждый пропуск соответствует отдельному заданию <b>20–28</b>.
          </div>
          <div className="space-y-6">
            {grammar.template.map((paragraph, pIdx) => {
              const parts = paragraph.split(/(\{\d+\})/);
              const matches = paragraph.match(/\{(\d+)\}/g);
              return (
                <div key={pIdx} className="flex gap-6 items-start">
                  <div className="flex-1">
                    <p className="text-[14px] leading-[2.8] text-justify">
                      {parts.map((part, i) => {
                        const match = part.match(/\{(\d+)\}/);
                        if (match) {
                          const taskIdx = parseInt(match[1]);
                          const qNum = 20 + taskIdx;
                          return (
                            <span key={i} className="inline-block relative w-28 mx-1 align-bottom">
                              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-400">{qNum}</span>
                              <input 
                                type="text"
                                className="w-full border-b border-black outline-none text-center font-bold text-indigo-900 bg-transparent h-6"
                                value={answers[`q${qNum}`] || ''}
                                onChange={(e) => handleInputChange(`q${qNum}`, e.target.value)}
                                readOnly={isReadOnly}
                              />
                            </span>
                          );
                        }
                        return part;
                      })}
                    </p>
                  </div>
                  {matches && (
                    <div className="w-28 flex flex-col gap-4 pt-2 shrink-0">
                      {matches.map((m) => {
                        const idx = parseInt(m.match(/\d+/)![0]);
                        return (
                          <div key={idx} className="border border-black text-[11px] font-bold bg-slate-50 p-1 text-center uppercase break-all">
                            {grammar.tasks[idx].word}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </PaperPage>
        <PaperPage>
          <div className="border border-black p-3 mb-6 italic text-[13px] leading-tight text-justify">
            Прочитайте приведённый ниже текст. Преобразуйте слова, напечатанные заглавными буквами в конце строк, обозначенных номерами <b>29–34</b>, так, чтобы они грамматически и лексически соответствовали содержанию текста. Заполните пропуски полученными словами. Каждый пропуск соответствует отдельному заданию <b>29–34</b>.
          </div>
          <div className="space-y-6">
            {vocab.template.map((paragraph, pIdx) => {
              const parts = paragraph.split(/(\{\d+\})/);
              const matches = paragraph.match(/\{(\d+)\}/g);
              return (
                <div key={pIdx} className="flex gap-6 items-start">
                  <div className="flex-1">
                    <p className="text-[14px] leading-[2.8] text-justify">
                      {parts.map((part, i) => {
                        const match = part.match(/\{(\d+)\}/);
                        if (match) {
                          const taskIdx = parseInt(match[1]);
                          const qNum = 29 + taskIdx;
                          return (
                            <span key={i} className="inline-block relative w-28 mx-1 align-bottom">
                              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-400">{qNum}</span>
                              <input 
                                type="text"
                                className="w-full border-b border-black outline-none text-center font-bold text-indigo-900 bg-transparent h-6"
                                value={answers[`q${qNum}`] || ''}
                                onChange={(e) => handleInputChange(`q${qNum}`, e.target.value)}
                                readOnly={isReadOnly}
                              />
                            </span>
                          );
                        }
                        return part;
                      })}
                    </p>
                  </div>
                  {matches && (
                    <div className="w-28 flex flex-col gap-4 pt-2 shrink-0">
                      {matches.map((m) => {
                        const idx = parseInt(m.match(/\d+/)![0]);
                        return (
                          <div key={idx} className="border border-black text-[11px] font-bold bg-slate-50 p-1 text-center uppercase break-all">
                            {vocab.tasks[idx].word}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-8 border border-black p-4 italic text-[12px] leading-tight bg-slate-50 text-justify">
            По окончании выполнения заданий <b>20–34</b> не забудьте перенести свои ответы в <b>БЛАНК ОТВЕТОВ № 1</b>! Запишите ответ справа от номера соответствующего задания, начиная с первой клеточки. При переносе ответов буквы записываются <u>без пробелов, запятых и других дополнительных символов</u>. Каждую букву пишите в отдельной клеточке в соответствии с приведёнными в бланке образцами.
          </div>
        </PaperPage>
      </>
    );
  };

  const renderWriting = () => {
    const { writing } = examData;

    return (
      <>
        <PaperPage>
          <div className="text-center mb-6">
            <h2 className="text-[15px] font-bold">Раздел 4 (задание по письму)</h2>
          </div>
          <div className="border border-black p-3 mb-6 italic text-[12px] leading-tight text-justify">
            Для ответа на задание <b>35</b> используйте БЛАНК ОТВЕТОВ № 2. При выполнении задания <b>35</b> особое внимание обратите на то, что Ваши ответы будут оцениваться только по записям, сделанным на БЛАНКЕ ОТВЕТОВ № 2. Никакие записи черновика не будут учитываться экспертом. Обратите внимание также на необходимость соблюдения указанного объёма электронного письма. Письмо недостаточного объёма, а также часть текста электронного письма, превышающая требуемый объём, не оцениваются. Соблюдайте нормы письменной речи, записывайте ответы аккуратно и разборчиво. Укажите номер задания <b>35</b> в БЛАНКЕ ОТВЕТОВ № 2 и напишите текст своего ответного электронного письма зарубежному другу по переписке.
          </div>
          
          <div className="flex gap-4 items-start mb-6">
            <div className="w-10 h-8 border border-black flex items-center justify-center font-bold shrink-0 text-[16px]">
              35
            </div>
            <div className="flex-1">
              <p className="text-[14px] mb-4">You have received an email message from your English-speaking pen-friend {writing.emailSender?.split('@')[0]}:</p>
              <div className="border border-black text-[13px]">
                <div className="border-b border-black p-1 px-2"><b>From:</b> {writing.emailSender}</div>
                <div className="border-b border-black p-1 px-2"><b>To:</b> Russian_friend@oge.ru</div>
                <div className="border-b border-black p-1 px-2"><b>Subject:</b> {writing.emailSubject}</div>
                <div className="p-2 italic whitespace-pre-wrap leading-relaxed">
                  {writing.emailBody}
                </div>
              </div>
            </div>
          </div>

          <div className="ml-14 space-y-4 text-[14px]">
            <p>{writing.text?.split('\n\n')[0]}</p>
            <p className="font-bold">{writing.text?.split('\n\n')[1]}</p>
            <p>{writing.text?.split('\n\n')[2]}</p>
          </div>
        </PaperPage>
        <PaperPage>
          <div className="flex justify-between items-center mb-4 border-b-2 border-black pb-2">
            <h3 className="font-bold text-[16px]">БЛАНК ОТВЕТОВ № 2</h3>
            <div className="flex items-center gap-2">
              <span className="text-[12px]">Задание:</span>
              <div className="w-10 h-8 border border-black flex items-center justify-center font-bold">35</div>
            </div>
          </div>
          <div className="relative h-[85%] w-full">
            {/* Lined paper effect */}
            <div className="absolute inset-0 pointer-events-none opacity-20" style={{ 
              backgroundImage: 'linear-gradient(#000 1px, transparent 1px)',
              backgroundSize: '100% 28px'
            }}></div>
            <textarea 
              className="w-full h-full bg-transparent outline-none resize-none font-serif text-[16px] leading-[28px] p-0 relative z-10"
              placeholder={isReadOnly ? "" : "Write your email here..."}
              value={answers['q35'] || ''}
              onChange={(e) => handleInputChange('q35', e.target.value)}
              readOnly={isReadOnly}
            ></textarea>
          </div>
          <div className="mt-4 flex justify-end text-[11px] font-bold text-slate-400">
            <span>Recommended: 100-120 words</span>
          </div>
        </PaperPage>
      </>
    );
  };

  const renderContent = () => {
    if (currentSpread < 2) return renderListening();
    if (currentSpread < 4) return renderReading();
    if (currentSpread === 4) return renderGrammarAndVocab();
    if (currentSpread === 5) return renderWriting();
    
    if (currentSpread === 6 || currentSpread === 7) {
      return (
        <SpeakingSection 
          spread={currentSpread}
          task1={examData.speakingTask1} 
          task2={examData.speakingTask2} 
          task3={examData.speakingTask3} 
          onAudioRecorded={handleAudioRecorded}
          onSubmit={handleSubmitExam}
          isSubmitting={isSubmitting}
          isReadOnly={isReadOnly}
          speakingUrls={speakingUrls}
        />
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-300 py-8 px-4 flex flex-col items-center">
      
      {/* Top Bar */}
      <div className="w-full max-w-[1400px] mb-6 bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-white/40 flex flex-col gap-4">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')}
              className="p-2 hover:bg-slate-200 rounded-full transition-colors"
            >
              <svg className="w-6 h-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                Режим экзамена: {
                  currentSpread < 2 ? 'Аудирование' : 
                  currentSpread < 4 ? 'Чтение' : 
                  currentSpread === 4 ? 'Грамматика и лексика' : 
                  currentSpread === 5 ? 'Письмо' :
                  'Устная часть'
                }
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {currentSpread < 2 && (
              <div className="flex items-center gap-3 bg-slate-100 px-4 py-2 rounded-xl shadow-inner border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Аудиозапись:</span>
                <audio controls className="h-8 w-48">
                  <source src={examData.listening.audioUrl} type="audio/mpeg" />
                </audio>
              </div>
            )}
            {!isReadOnly && (
              <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl border border-slate-200">
                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-mono font-bold text-lg text-slate-700">
                  {formatExamTime(examTimeRemaining)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end items-center gap-4">
          {!isReadOnly && currentSpread !== 7 && (
            <button 
              onClick={handleSubmitExam}
              disabled={isSubmitting}
              className={`px-6 py-2 bg-slate-900 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-800'}`}
            >
              {isSubmitting ? 'Отправка...' : 'Сдать работу'}
            </button>
          )}
        </div>
      </div>

      {/* Double Page Layout */}
      <div className="w-full max-w-[1400px] grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {renderContent()}
      </div>

      {/* Bottom Navigation */}
      <div className="w-full max-w-[1400px] mt-6 bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-white/40 flex justify-between items-center">
        <button
          onClick={() => {
            setCurrentSpread(prev => Math.max(0, prev - 1));
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          disabled={currentSpread === 0}
          className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${currentSpread === 0 ? 'opacity-50 cursor-not-allowed bg-slate-200 text-slate-500' : 'bg-white text-slate-700 hover:bg-slate-100 shadow-md border border-slate-200'}`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Назад
        </button>
        
        <div className="text-slate-500 font-bold text-sm">
          Разворот {currentSpread + 1} из 8
        </div>

        <button
          onClick={() => {
            setCurrentSpread(prev => Math.min(7, prev + 1));
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          disabled={currentSpread === 7}
          className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${currentSpread === 7 ? 'opacity-50 cursor-not-allowed bg-slate-200 text-slate-500' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md'}`}
        >
          Вперед
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>
  );
};
