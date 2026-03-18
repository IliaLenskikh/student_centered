import React, { useState, useRef, useEffect } from 'react';
import { Send, CheckCircle2, Clock, Mail, PenLine, Sparkles, Loader2, X } from 'lucide-react';
import OpenAI from "openai";
import { Story, UserProfile } from '../types';

const BLOCK_DEFS = [
  { id: 'greeting', title: '1. Обращение', hint: 'Dear [Name],' },
  { id: 'intro', title: '2. Благодарность за письмо', hint: 'Thanks for the email! It was great to hear from you. I’m glad you’re OK...' },
  { id: 'body', title: '3. Основная часть (Ответы на вопросы)', hint: 'In your email you asked me about... (Убедитесь, что ответили на все 3 вопроса и добавили аргументацию)' },
  { id: 'conclusion', title: '4. Заключение', hint: 'Well, I’d better go now as I have to do my homework. Please write to me again soon.' },
  { id: 'signoff', title: '5. Завершающая фраза и подпись', hint: 'Best wishes,\n[Your Name]' }
];

interface WritingTaskSectionProps {
  story: Story;
  userProfile: UserProfile;
  onComplete: (score: number, maxScore: number, details: any[]) => void;
  readOnly?: boolean;
  initialContent?: string;
  initialEvaluation?: any;
  onEvaluationChange?: (evaluation: any) => void;
  onContentChange?: (content: string) => void;
}

const AutoTextarea = ({ value, onChange, onFocus, onBlur, placeholder, className, showScaffolding, disabled }: any) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  }, [value, showScaffolding]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
      disabled={disabled}
      placeholder={placeholder}
      className={`resize-none outline-none bg-transparent w-full overflow-hidden ${className}`}
      spellCheck="false"
      rows={1}
    />
  );
};

export const WritingTaskSection: React.FC<WritingTaskSectionProps> = ({ 
  story, 
  userProfile, 
  onComplete, 
  readOnly = false,
  initialContent = "",
  initialEvaluation = null,
  onEvaluationChange,
  onContentChange
}) => {
  const [showHints, setShowHints] = useState(false);
  const [singleText, setSingleText] = useState(initialContent);
  const [blocks, setBlocks] = useState(BLOCK_DEFS.map(def => ({ id: def.id, text: '' })));
  const [focusedBlock, setFocusedBlock] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<Record<string, boolean>>({});
  const [isRewriting, setIsRewriting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [evaluation, setEvaluation] = useState<any>(initialEvaluation);
  const [showEvaluationModal, setShowEvaluationModal] = useState(false);

  // Initialize blocks from initialContent if provided
  useEffect(() => {
    if (initialContent && blocks.every(b => !b.text)) {
        setSingleText(initialContent);
    }
  }, [initialContent]);

  useEffect(() => {
    if (initialEvaluation) {
      setEvaluation(initialEvaluation);
    }
  }, [initialEvaluation]);

  const currentText = showHints 
    ? blocks.map(b => b.text).join('\n\n') 
    : singleText;

  useEffect(() => {
    if (onContentChange) {
      onContentChange(currentText);
    }
  }, [currentText, onContentChange]);

  const handleRewrite = async () => {
    const textToProcess = currentText;
    if (!textToProcess.trim()) return;
    
    setIsRewriting(true);
    try {
      const openai = new OpenAI({ apiKey: import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.OPENAI_API_KEY || '', dangerouslyAllowBrowser: true });
      const prompt = `Rewrite and polish the following email reply. Fix grammar, improve flow, and make it sound natural. Keep the same meaning and approximate length. Do not include markdown.\n\nOriginal text:\n${textToProcess}`;
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      });
      
      const rewrittenText = response.choices[0]?.message?.content?.trim() || "";
      setShowHints(false);
      setSingleText(rewrittenText);
    } catch (error) {
      console.error("Failed to rewrite:", error);
    } finally {
      setIsRewriting(false);
    }
  };

  const handleSend = async () => {
    const textToProcess = currentText;
    if (!textToProcess.trim()) return;
    
    setIsSending(true);
    try {
      const openai = new OpenAI({ apiKey: import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.OPENAI_API_KEY || '', dangerouslyAllowBrowser: true });
      const prompt = `Ты — опытный эксперт-экзаменатор ОГЭ/ЕГЭ по английскому языку. Оцени ответ ученика на email (письмо другу).
Задание: ${story.text || ''}
Оригинальное письмо: ${story.emailBody || ''}

Ответ ученика:
${textToProcess}

КРИТЕРИИ ОЦЕНКИ (ОГЭ/ЕГЭ):
1. Решение коммуникативной задачи (РКЗ): Даны ли полные ответы на все 3 вопроса? Соблюден ли объем (100-120 слов)? Соблюден ли неформальный стиль?
2. Организация текста: Логичность, использование слов-связок, правильное деление на абзацы, наличие обращения, благодарности, ссылки на будущие контакты и завершающей фразы.
3. Языковое оформление: Отсутствие грамматических, лексических и пунктуационных ошибок.

Дай подробную оценку на РУССКОМ ЯЗЫКЕ. Структура ответа:
1. Оценка: [Балл] из 10. (Если в тексте нет грамматических, лексических или пунктуационных ошибок, и соблюдены все условия задания — ответы на 3 вопроса, объем, стиль — ты ОБЯЗАН поставить 10 из 10. Не занижай балл за простоту конструкций, если они верны).
2. Выполнение задачи: Подробно по каждому вопросу.
3. Разбор ошибок: Если ошибок нет, обязательно похвали. Если есть — объясни и исправь.
4. Рекомендации: Как сделать текст еще лучше (стилистические советы, которые не влияют на оценку).
Пиши без markdown-заголовков.`;
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      });
      
      const evaluationText = response.choices[0]?.message?.content || "";
      
      // Try to extract score
      let score = 0;
      const scoreMatch = evaluationText.match(/Оценка:\s*(\d+)/i);
      if (scoreMatch) {
        score = parseInt(scoreMatch[1]);
      }

      const data = {
        text: evaluationText,
        score: score
      };
      setEvaluation(data);
      if (onEvaluationChange) {
        onEvaluationChange(data);
      }
      setShowEvaluationModal(true);
      
      if (onComplete) {
        onComplete(data.score, 10, [data]);
      }
    } catch (error) {
      console.error("Failed to evaluate:", error);
      // Fallback
      setEvaluation({
        score: 0,
        text: "Произошла ошибка при генерации оценки. Пожалуйста, попробуйте еще раз."
      });
      setShowEvaluationModal(true);
    } finally {
      setIsSending(false);
    }
  };

  const handleGenerateBlock = async (blockId: string, index: number) => {
    setIsGenerating(prev => ({ ...prev, [blockId]: true }));
    try {
      const openai = new OpenAI({ apiKey: import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.OPENAI_API_KEY || '', dangerouslyAllowBrowser: true });
      
      const blockDef = BLOCK_DEFS[index];
      let blockInstruction = "";
      switch(blockId) {
        case 'greeting': 
          blockInstruction = `Write ONLY the greeting. Use the hint as a template: '${blockDef.hint}'. Do NOT write anything else.`; 
          break;
        case 'intro': 
          blockInstruction = `Write ONLY the introduction (thanking for the email and reacting to the news). 1-2 sentences. Use the hint as a starting point: '${blockDef.hint}'. DO NOT include a greeting and DO NOT include a signature.`; 
          break;
        case 'body': 
          blockInstruction = `Write ONLY the main body paragraph answering the 3 questions. Write about 50-70 words. Use the hint as a guide: '${blockDef.hint}'. DO NOT include a greeting or signature.`; 
          break;
        case 'conclusion': 
          blockInstruction = `Write ONLY the conclusion (reason to leave and asking to write back). 1-2 sentences. Use the hint as a template: '${blockDef.hint}'. DO NOT include a greeting or signature.`; 
          break;
        case 'signoff': 
          blockInstruction = `Write ONLY the sign-off and signature. Use the hint as a template: '${blockDef.hint}'. Do NOT write the rest of the email.`; 
          break;
      }

      const prompt = `You are an English student taking the OGE/EGE exam (Russian State Exam, B1 level).
Task: ${story.text || ''}
Incoming Email from ${story.emailSender || 'Jim@mail.uk'}:
"${story.emailBody || ''}"
Student Name: ${userProfile.name || 'Student'}

CRITICAL INSTRUCTION:
${blockInstruction}

REQUIREMENTS:
- Use B1 level vocabulary and grammar.
- Maintain a friendly, informal tone.
- Follow the provided hint/template closely.
- Ensure the text is natural but strictly within B1 exam standards.
- WARNING: You are generating ONLY one specific part of the email. Do NOT write a full email. Output ONLY the exact text for this block. No markdown, no quotes, no extra conversational filler.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      });

      const generatedText = response.choices[0]?.message?.content?.trim() || "";
      
      const newBlocks = [...blocks];
      newBlocks[index].text = generatedText;
      setBlocks(newBlocks);
    } catch (error) {
      console.error("Failed to generate:", error);
    } finally {
      setIsGenerating(prev => ({ ...prev, [blockId]: false }));
    }
  };
  
  const wordCount = currentText.trim().split(/\s+/).filter(w => w.length > 0).length;
  
  let wordCountStatus = 'text-slate-500';
  let wordCountIndicator = 'bg-slate-200';
  
  if (wordCount > 0 && wordCount < 100) {
    wordCountStatus = 'text-amber-600';
    wordCountIndicator = 'bg-amber-500';
  } else if (wordCount >= 100 && wordCount <= 120) {
    wordCountStatus = 'text-emerald-600';
    wordCountIndicator = 'bg-emerald-500';
  } else if (wordCount > 120) {
    wordCountStatus = 'text-red-600';
    wordCountIndicator = 'bg-red-500';
  }

  const handleToggleHints = (checked: boolean) => {
    setShowHints(checked);
    if (checked) {
      const parts = singleText.split(/\n\s*\n/);
      const newBlocks = BLOCK_DEFS.map(def => ({ id: def.id, text: '' }));
      let partIndex = 0;
      
      parts.forEach((part) => {
        if (part.trim() === '') return;
        if (partIndex < 5) {
          newBlocks[partIndex].text = part.trim();
        } else {
          newBlocks[4].text += '\n\n' + part.trim();
        }
        partIndex++;
      });
      setBlocks(newBlocks);
    } else {
      setSingleText(blocks.map(b => b.text.trim()).filter(t => t.length > 0).join('\n\n'));
    }
  };

  return (
    <div className="w-full font-sans text-slate-800 flex justify-center items-start relative">
      <div className="w-full max-w-[1400px] grid grid-cols-1 lg:grid-cols-12 gap-6 items-start relative z-10">
        
        {/* Left Column: Task & Stats */}
        <div className="lg:col-span-3 flex flex-col gap-6 sticky top-8">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-7 flex flex-col">
            <div className="flex items-center gap-2 mb-5">
              <PenLine className="w-4 h-4 text-indigo-500" />
              <h2 className="text-xs font-bold tracking-widest text-slate-800 uppercase">Task</h2>
            </div>
            
            <div className="prose prose-slate prose-sm">
              {(story.text || '').split('\n').map((paragraph, idx) => (
                <p key={idx} className="mb-3 text-slate-600 leading-relaxed text-[15px]">
                  {paragraph}
                </p>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100">
              <h2 className="text-xs font-bold tracking-widest text-slate-800 uppercase mb-5">Stats</h2>
              
              <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${wordCountIndicator} transition-colors duration-300`}></div>
                <span className={`text-sm font-medium ${wordCountStatus} transition-colors duration-300`}>
                  Word count: {wordCount} <span className="text-slate-400 font-normal">/ 100-120</span>
                </span>
              </div>
            </div>

            {evaluation && (
              <div className="mt-8 pt-6 border-t border-slate-100">
                <h2 className="text-xs font-bold tracking-widest text-slate-800 uppercase mb-5">Последний отзыв</h2>
                <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    <span className="text-sm font-semibold text-indigo-900">Оценка ИИ</span>
                  </div>
                  <div className="prose prose-sm prose-indigo text-slate-600 whitespace-pre-wrap text-[13px] leading-relaxed line-clamp-4">
                    {evaluation.text}
                  </div>
                  <button 
                    onClick={() => setShowEvaluationModal(true)}
                    className="mt-4 text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors"
                  >
                    Смотреть полностью
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Email Context & Editor */}
        <div className="lg:col-span-9">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden flex flex-col h-[calc(100vh-4rem)] min-h-[750px]">
            
            {/* Header */}
            <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white z-10 shrink-0">
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">{story.title || 'Email Task'}</h1>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Draft - Auto-saving
              </div>
            </div>

            <div className="flex-grow overflow-hidden p-6 md:p-8 flex flex-col gap-6 bg-[#FAFBFC]">
              
              {/* Incoming Email */}
              <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-200/60 relative overflow-hidden shrink-0">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-200"></div>
                
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0 border border-slate-200 shadow-sm">
                      <Mail className="w-4 h-4 text-slate-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800 text-sm">{story.emailSender || 'Jim@mail.uk'}</div>
                      <div className="text-xs text-slate-500 mt-0.5 font-medium">Subject: {story.emailSubject || 'New Year resolutions'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium bg-white border border-slate-100 px-2.5 py-1.5 rounded-lg self-start shadow-sm">
                    <Clock className="w-3 h-3" />
                    Received recently
                  </div>
                </div>
                
                <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap pl-12">
                  {story.emailBody}
                </div>
              </div>

              {/* Reply Area */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 flex-grow flex flex-col overflow-hidden focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-50 transition-all duration-200 min-h-[400px]">
                
                {/* Reply Toolbar */}
                <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-slate-50/50 shrink-0">
                  <div className="text-sm text-slate-500 flex items-center gap-2">
                    <span className="font-medium">To:</span> 
                    <span className="bg-white border border-slate-200 px-2.5 py-1 rounded-md text-slate-700 font-medium shadow-sm">{story.emailSender || 'Jim@mail.uk'}</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-4 items-center">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className="relative flex items-center justify-center w-4 h-4">
                        <input 
                          type="checkbox" 
                          checked={showHints}
                          onChange={(e) => handleToggleHints(e.target.checked)}
                          className="peer appearance-none w-4 h-4 border-2 border-slate-300 rounded checked:bg-indigo-500 checked:border-indigo-500 transition-colors cursor-pointer"
                        />
                        <CheckCircle2 className="w-3 h-3 text-white absolute pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={3} />
                      </div>
                      <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 group-hover:text-slate-700 transition-colors select-none">Показать подсказки</span>
                    </label>
                    
                    <div className="w-px h-6 bg-slate-200 mx-1 self-center"></div>
                    <button 
                      onClick={handleRewrite}
                      disabled={isRewriting || currentText.trim().length === 0 || readOnly}
                      className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase px-3 py-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors border border-emerald-100/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isRewriting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      {isRewriting ? 'Rewriting...' : 'Rewrite'}
                    </button>
                  </div>
                </div>

                {/* Editor Area */}
                <div className="flex-grow flex flex-col relative overflow-hidden">
                  {showHints ? (
                    <div className="flex-grow w-full p-6 md:p-8 flex flex-col overflow-y-auto scrollbar-hide">
                      {BLOCK_DEFS.map((def, index) => {
                        const block = blocks[index];
                        const isFocused = focusedBlock === def.id;
                        const isEmpty = block.text.trim() === '';
                        const showScaffolding = isFocused || isEmpty;

                        return (
                          <div 
                            key={def.id} 
                            className={`relative transition-all duration-300 rounded-xl ${
                              showScaffolding 
                                ? 'bg-indigo-50/40 border border-indigo-100/50 p-5 my-3' 
                                : 'bg-transparent py-1 px-3 hover:bg-slate-50 -mx-3 my-0.5'
                            }`}
                            onFocus={() => setFocusedBlock(def.id)}
                            onBlur={(e) => {
                              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                setFocusedBlock(null);
                              }
                            }}
                          >
                            {showScaffolding && (
                              <div className="text-[10px] font-bold tracking-widest uppercase text-indigo-400 mb-3 flex items-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mr-2"></div>
                                {def.title}
                                <button 
                                  onClick={(e) => { e.preventDefault(); handleGenerateBlock(def.id, index); }}
                                  disabled={isGenerating[def.id] || readOnly}
                                  className="ml-2 text-indigo-400 hover:text-indigo-600 transition-colors p-1 rounded-md hover:bg-indigo-100/50 disabled:opacity-50"
                                  title="Сгенерировать блок с помощью ИИ"
                                >
                                  {isGenerating[def.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            )}
                            <AutoTextarea
                              value={block.text}
                              disabled={readOnly}
                              onChange={(e: any) => {
                                const newBlocks = [...blocks];
                                newBlocks[index].text = e.target.value;
                                setBlocks(newBlocks);
                              }}
                              placeholder={showScaffolding ? def.hint : ''}
                              className={`text-slate-800 text-[15px] leading-relaxed placeholder:text-slate-400/60 transition-all ${
                                showScaffolding ? 'min-h-[40px]' : ''
                              }`}
                              showScaffolding={showScaffolding}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <textarea 
                      className="absolute inset-0 w-full h-full p-6 md:p-8 resize-none outline-none text-slate-800 text-[15px] leading-relaxed placeholder:text-slate-300 bg-transparent overflow-y-auto scrollbar-hide"
                      placeholder="Write your reply here..."
                      value={singleText}
                      disabled={readOnly}
                      onChange={(e) => setSingleText(e.target.value)}
                      spellCheck="false"
                    ></textarea>
                  )}
                </div>

                {/* Editor Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end items-center shrink-0 rounded-b-2xl">
                  {!readOnly && (
                    <button 
                      onClick={handleSend}
                      disabled={isSending || currentText.trim().length === 0}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 bg-indigo-600 hover:bg-indigo-700 text-white shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                    >
                      {isSending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      {isSending ? 'Evaluating...' : 'Send & Evaluate'}
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* Evaluation Modal */}
      {showEvaluationModal && evaluation && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 md:p-8 relative animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <button 
              onClick={() => setShowEvaluationModal(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-3 mb-6 shrink-0 pr-12">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Оценка ИИ</h3>
                <p className="text-sm text-slate-500">Подробный разбор вашего ответа</p>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-8">
              {/* Score Circle */}
              <div className="flex items-center justify-center py-4">
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="64" cy="64" r="58" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                    <circle 
                      cx="64" cy="64" r="58" fill="none" stroke="#4f46e5" strokeWidth="10" 
                      strokeDasharray={364} 
                      strokeDashoffset={364 - (364 * (evaluation.score || 0)) / 10}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-black text-slate-800">{evaluation.score || 0}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">из 10</span>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="prose prose-slate prose-sm max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {evaluation.text}
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end shrink-0">
              <button 
                onClick={() => setShowEvaluationModal(false)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl transition-colors"
              >
                Продолжить редактирование
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
