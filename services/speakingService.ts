import { supabase } from './supabaseClient';
import { SpeakingAttempt } from '../types';

export const uploadSpeakingAudio = async (blob: Blob, studentId: string): Promise<string | null> => {
  const fileName = `${studentId}/${Date.now()}.webm`;
  const { data, error } = await supabase.storage
    .from('audio-attempts')
    .upload(fileName, blob);

  if (error) {
    console.error('Error uploading audio:', error);
    return null;
  }

  const { data: { publicUrl } } = supabase.storage
    .from('audio-attempts')
    .getPublicUrl(fileName);

  return publicUrl;
};

export const saveSpeakingAttempt = async (attempt: Omit<SpeakingAttempt, 'id' | 'created_at'>) => {
  const { data, error } = await supabase
    .from('speaking_attempts')
    .insert([attempt])
    .select()
    .single();

  if (error) {
    console.error('Error saving speaking attempt:', error);
    return null;
  }

  return data;
};

export const updateSpeakingAttemptFeedback = async (id: string, aiFeedback: any, transcription?: string) => {
  const { data, error } = await supabase
    .from('speaking_attempts')
    .update({ ai_feedback: aiFeedback, transcription })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating speaking attempt feedback:', error);
    return null;
  }

  return data;
};

export const getSpeakingAttempts = async (studentId: string, exerciseTitle: string, taskId?: string): Promise<SpeakingAttempt[]> => {
  let query = supabase
    .from('speaking_attempts')
    .select('*')
    .eq('student_id', studentId)
    .eq('exercise_title', exerciseTitle);
    
  if (taskId) {
    query = query.eq('task_id', taskId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching speaking attempts:', error);
    return [];
  }

  return data || [];
};
