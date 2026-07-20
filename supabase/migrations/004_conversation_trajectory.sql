alter table conversations
  add column if not exists trajectory_state text not null default 'idle'
    check (trajectory_state in (
      'idle','greeting','collecting_info','booking_in_progress',
      'payment_pending','closing','escalated'
    ));
