-- THRESHOLD schema. Canonical, runnable source of truth.
-- Spec and rationale: plan/03-data-model.md (keep the two aligned).
-- Apply with:  npx supabase db push
--
-- Mutable state ONLY. Sites, points, zones, fact sheets and narrations live in
-- content/ in git and never appear here. See docs/adr/0002.

-- ---------------------------------------------------------------- candidates
create table if not exists candidates (
  id                    text primary key,          -- 'c_87_1' : page + ordinal
  volume_id             text        not null,      -- 'zafar-hasan-v1'
  page_no               integer     not null,
  mention_name          text        not null,
  structure_type        text        not null,
  period                text,
  passage               text        not null,      -- the exact archival sentence
  passage_start         integer,                   -- char offsets into the Page text,
  passage_end           integer,                   -- for highlighting
  anchor_id             text,                      -- content/anchors.ts id; null = unresolvable
  bearing               text,                      -- bearing_token
  distance_value        numeric,
  distance_unit         text,                      -- distance_unit
  lng                   double precision,          -- null until geo_resolved
  lat                   double precision,
  uncertainty_radius_m  numeric,
  status                text        not null default 'extracted',
  confidence            numeric,                   -- 0..1, the rolled-up total
  confidence_parts      jsonb       not null default '{}'::jsonb,
  matched_feature_id    text,                      -- set only when status='matched_existing'
  matched_feature_name  text,
  matched_distance_m    numeric,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint candidates_status_chk check (status in (
    'extracted','geo_resolved','candidate','under_review',
    'verified','rejected','matched_existing')),
  constraint candidates_confidence_chk check (
    confidence is null or (confidence >= 0 and confidence <= 1)),
  -- a coordinate without an uncertainty radius is a lie (CONTEXT.md)
  constraint candidates_radius_chk check (
    (lng is null and lat is null) or uncertainty_radius_m is not null),
  -- a match must name what it matched
  constraint candidates_match_chk check (
    status <> 'matched_existing' or matched_feature_id is not null)
);

create index if not exists candidates_status_idx      on candidates (status);
create index if not exists candidates_volume_page_idx on candidates (volume_id, page_no);

-- ---------------------------------------------------------- candidate_events
-- Append-only. This is the audit trail for the review decision itself.
create table if not exists candidate_events (
  id            bigserial primary key,
  candidate_id  text        not null references candidates(id) on delete cascade,
  from_status   text,                              -- null on the first row
  to_status     text        not null,
  note          text,
  actor         text        not null default 'reviewer',
  created_at    timestamptz not null default now(),

  constraint candidate_events_to_chk check (to_status in (
    'extracted','geo_resolved','candidate','under_review',
    'verified','rejected','matched_existing'))
);

create index if not exists candidate_events_candidate_idx
  on candidate_events (candidate_id, created_at desc);

-- ------------------------------------------------------------ walk_crossings
-- One Threshold Crossing that actually happened.
-- walk_id is a random client-generated string per session. There is no user
-- column and there will never be one — see CONTEXT.md.
create table if not exists walk_crossings (
  id               bigserial primary key,
  walk_id          text        not null,
  point_id         text        not null,           -- 'red-fort/diwan-i-aam'
  site_id          text        not null,
  persona          text        not null,
  kind             text        not null,           -- 'approach' | 'inside'
  location_source  text        not null,           -- 'sim' | 'gps'
  created_at       timestamptz not null default now(),

  constraint walk_crossings_persona_chk check (persona in ('history','architecture','kids')),
  constraint walk_crossings_kind_chk    check (kind    in ('approach','inside')),
  constraint walk_crossings_source_chk  check (location_source in ('sim','gps'))
);

create index if not exists walk_crossings_recent_idx on walk_crossings (created_at desc);
create index if not exists walk_crossings_site_idx   on walk_crossings (site_id, created_at desc);

-- ------------------------------------------------------------ updated_at
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists candidates_touch on candidates;
create trigger candidates_touch before update on candidates
  for each row execute function touch_updated_at();

-- ------------------------------------------------------------------- RLS
-- No auth for the internal round. Access is scoped by key, per the matrix in
-- plan/03-data-model.md §4. Named as an accepted risk in plan/06-risks.md.
alter table candidates       enable row level security;
alter table candidate_events enable row level security;
alter table walk_crossings   enable row level security;

drop policy if exists candidates_read      on candidates;
drop policy if exists candidates_update    on candidates;
drop policy if exists events_read          on candidate_events;
drop policy if exists events_insert        on candidate_events;
drop policy if exists crossings_read       on walk_crossings;
drop policy if exists crossings_insert     on walk_crossings;

create policy candidates_read   on candidates       for select using (true);
create policy candidates_update on candidates       for update using (true) with check (true);
-- deliberately NO insert/delete policy for anon: only seed-db.ts (service_role) creates Candidates

create policy events_read       on candidate_events for select using (true);
create policy events_insert     on candidate_events for insert with check (true);

create policy crossings_read    on walk_crossings   for select using (true);
create policy crossings_insert  on walk_crossings   for insert with check (true);
