alter table conversations drop constraint if exists conversations_channel_check;
alter table conversations add constraint conversations_channel_check
  check (channel in ('whatsapp', 'manual', 'phone'));
