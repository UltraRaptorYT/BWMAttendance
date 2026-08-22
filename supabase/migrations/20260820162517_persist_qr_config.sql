alter table public.attendance_events
add column if not exists qr_config jsonb;

comment on column public.attendance_events.qr_config is
  'Per-event QR formula and appearance settings managed by the admin wizard.';
