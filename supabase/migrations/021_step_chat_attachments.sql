-- Step chat proof attachments for discuss-step multimodal context
alter table public.step_chats
  add column if not exists attachment_url text,
  add column if not exists attachment_type text
    check (attachment_type is null or attachment_type in ('image', 'document')),
  add column if not exists attachment_name text;

alter table public.step_chats drop constraint if exists step_chats_role_check;
alter table public.step_chats
  add constraint step_chats_role_check
  check (role in ('user', 'assistant', 'system'));
