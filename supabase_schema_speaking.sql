
-- Speaking Attempts Table
create table if not exists public.speaking_attempts (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  student_id uuid references public.profiles(id) not null,
  exercise_title text not null,
  task_id text not null, -- e.g., 'task1', 'task2_0', 'task3'
  audio_url text not null,
  ai_feedback jsonb,
  transcription text
);

alter table public.speaking_attempts enable row level security;

-- Policies for Speaking Attempts
drop policy if exists "Students can view own speaking attempts" on public.speaking_attempts;
create policy "Students can view own speaking attempts"
  on public.speaking_attempts for select
  using ( auth.uid() = student_id );

drop policy if exists "Students can insert own speaking attempts" on public.speaking_attempts;
create policy "Students can insert own speaking attempts"
  on public.speaking_attempts for insert
  with check ( auth.uid() = student_id );

drop policy if exists "Students can update own speaking attempts" on public.speaking_attempts;
create policy "Students can update own speaking attempts"
  on public.speaking_attempts for update
  using ( auth.uid() = student_id );

drop policy if exists "Teachers can view student speaking attempts" on public.speaking_attempts;
create policy "Teachers can view student speaking attempts"
  on public.speaking_attempts for select
  using (
    exists (
      select 1 from public.profiles student_prof
      where student_prof.id = speaking_attempts.student_id
      and student_prof.teacher_email = (select email from public.profiles where id = auth.uid())
    )
  );
