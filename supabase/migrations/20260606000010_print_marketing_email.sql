-- 마케팅 이메일 발송 로그 (빈도 캡 + 중복 방지)
create table if not exists print_marketing_email_log (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  campaign_id uuid references print_promotion_campaigns(id) on delete set null,
  email_type text not null default 'campaign_announcement',
  sent_at timestamptz not null default now(),
  subject text,
  resend_message_id text
);

create index if not exists print_mktg_email_log_email_sent
  on print_marketing_email_log(email, sent_at desc);
create index if not exists print_mktg_email_log_email_campaign
  on print_marketing_email_log(email, campaign_id);

-- 마케팅 이메일 수신 거부 (opt-out)
create table if not exists print_email_unsubscribes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  unsubscribed_at timestamptz not null default now(),
  source text not null default 'link',  -- 'one_click' | 'link' | 'manual'
  campaign_id uuid references print_promotion_campaigns(id) on delete set null,
  constraint print_email_unsubscribes_email_unique unique(email)
);

create index if not exists print_email_unsubscribes_email
  on print_email_unsubscribes(email);

-- RLS: service_role 전용
alter table print_marketing_email_log enable row level security;
create policy "service_role_only" on print_marketing_email_log
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

alter table print_email_unsubscribes enable row level security;
create policy "service_role_only" on print_email_unsubscribes
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
