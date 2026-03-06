-- 1. Exam Submissions Table
create table if not exists public.exam_submissions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  student_id uuid references auth.users(id) not null,
  exam_data jsonb not null,
  answers jsonb not null,
  speaking_urls jsonb
);

-- Enable Security
alter table public.exam_submissions enable row level security;

-- Policies for Exam Submissions
drop policy if exists "Students can insert their own exam submissions" on public.exam_submissions;
create policy "Students can insert their own exam submissions"
  on public.exam_submissions for insert
  with check ( auth.uid() = student_id );

drop policy if exists "Students can view their own exam submissions" on public.exam_submissions;
create policy "Students can view their own exam submissions"
  on public.exam_submissions for select
  using ( auth.uid() = student_id );

drop policy if exists "Teachers can view their students' exam submissions" on public.exam_submissions;
create policy "Teachers can view their students' exam submissions"
  on public.exam_submissions for select
  using (
    exists (
      select 1 from public.profiles student_prof
      where student_prof.id = exam_submissions.student_id
      and student_prof.teacher_email = (select email from public.profiles where id = auth.uid())
    )
  );

-- 2. Storage Bucket for Audio (if not already created)
insert into storage.buckets (id, name, public) 
values ('audio-responses', 'audio-responses', true)
on conflict (id) do nothing;

-- Storage Policies
drop policy if exists "Public Access to Audio" on storage.objects;
create policy "Public Access to Audio" 
  on storage.objects for select 
  using ( bucket_id = 'audio-responses' );

drop policy if exists "Authenticated Users Upload Audio" on storage.objects;
create policy "Authenticated Users Upload Audio" 
  on storage.objects for insert 
  with check ( bucket_id = 'audio-responses' and auth.role() = 'authenticated' );
