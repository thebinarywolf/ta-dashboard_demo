-- Metrics views. These are the ONLY thing lib/metrics/*.ts queries — the UI
-- never touches the raw tables above directly.
--
-- security_invoker = true is required on every view: without it, a view
-- runs with the view owner's privileges and silently bypasses the RLS
-- policies on the underlying tables, leaking data to unapproved users.

create view public.v_positions_with_sla
with (security_invoker = true)
as
select
  p.*,
  case p.seniority
    when 'Senior' then 90
    when 'Mid' then 60
    when 'Junior' then 30
    else null
  end as sla_days,
  case
    when p.role_assigned_on is not null then (current_date - p.role_assigned_on)
    else null
  end as aging_days,
  case
    when p.open_closed = 'Open'
      and p.role_assigned_on is not null
      and p.seniority is not null
      and (current_date - p.role_assigned_on) > (
        case p.seniority when 'Senior' then 90 when 'Mid' then 60 when 'Junior' then 30 end
      )
    then true
    else false
  end as sla_breached
from public.positions p;

-- One row per position (by surrogate id, not position_id — several open
-- reqs can share a blank position_id before a job code is assigned).
create view public.v_pipeline_by_position
with (security_invoker = true)
as
select
  pos.id as position_pk,
  pos.position_id,
  count(distinct cf.candidate_name) as sourced_count,
  count(distinct cf.candidate_name) filter (where cf.interview_round is not null) as interviewed_count,
  count(distinct cf.candidate_name) filter (where cf.outcome = 'Selected') as selected_count,
  count(distinct uj.candidate_name) filter (where uj.status = 'Yet to join') as yet_to_join_count,
  count(distinct uj.candidate_name) filter (where uj.status ilike 'joined%') as joined_count
from public.positions pos
left join public.candidate_feedback cf
  on cf.position_id = pos.position_id and pos.position_id is not null
left join public.upcoming_joiners uj
  on uj.position_id = pos.position_id and pos.position_id is not null
group by pos.id, pos.position_id;

-- Funnel: candidate identity is only ever a (name, position_id) pair in the
-- source sheets (no candidate ID column exists), so "sourced -> joined"
-- matching across tabs is name+position based and best-effort — noted in
-- docs/join-keys.md.
create view public.v_funnel_overall
with (security_invoker = true)
as
select
  count(distinct cf.candidate_name) as sourced,
  count(distinct cf.candidate_name) filter (where cf.interview_round is not null) as interviewed,
  count(distinct cf.candidate_name) filter (where cf.outcome = 'Selected') as selected,
  count(distinct uj.candidate_name) filter (where uj.status is not null and uj.status <> 'Drop') as offer_accepted,
  count(distinct uj.candidate_name) filter (where uj.status ilike 'joined%') as joined
from public.candidate_feedback cf
full outer join public.upcoming_joiners uj
  on uj.candidate_name = cf.candidate_name and uj.position_id = cf.position_id;

create view public.v_funnel_by_department
with (security_invoker = true)
as
select
  coalesce(pos.department, uj.department, cf.dept_location) as department,
  count(distinct cf.candidate_name) as sourced,
  count(distinct cf.candidate_name) filter (where cf.interview_round is not null) as interviewed,
  count(distinct cf.candidate_name) filter (where cf.outcome = 'Selected') as selected,
  count(distinct uj.candidate_name) filter (where uj.status is not null and uj.status <> 'Drop') as offer_accepted,
  count(distinct uj.candidate_name) filter (where uj.status ilike 'joined%') as joined
from public.candidate_feedback cf
full outer join public.upcoming_joiners uj
  on uj.candidate_name = cf.candidate_name and uj.position_id = cf.position_id
left join public.positions pos
  on pos.position_id = coalesce(cf.position_id, uj.position_id) and coalesce(cf.position_id, uj.position_id) is not null
group by coalesce(pos.department, uj.department, cf.dept_location);

create view public.v_recruiter_performance
with (security_invoker = true)
as
select
  r.recruiter,
  count(*) filter (where r.open_closed = 'Closed') as positions_closed,
  avg(r.date_closed - r.role_assigned_on) filter (
    where r.open_closed = 'Closed' and r.date_closed is not null and r.role_assigned_on is not null
  ) as avg_days_to_close,
  (
    select count(distinct cf2.candidate_name)
    from public.candidate_feedback cf2
    where cf2.recruiter = r.recruiter
  ) as candidates_handled
from (
  select
    coalesce(pos.assigned_ta, pos.closed_by_ta) as recruiter,
    pos.open_closed,
    pos.date_closed,
    pos.role_assigned_on
  from public.positions pos
  where coalesce(pos.assigned_ta, pos.closed_by_ta) is not null
) r
group by r.recruiter;

create view public.v_dropouts_flagged
with (security_invoker = true)
as
select
  d.*,
  (d.position_id is null) as unlinked,
  (d.offer_accepted_date is null or d.actual_dropout_date is null) as missing_dates,
  case
    when d.offer_accepted_date is not null and d.actual_dropout_date is not null
      then (d.actual_dropout_date - d.offer_accepted_date)
    else d.days_offer_to_dropout
  end as days_gap
from public.drop_outs d;

create view public.v_source_conversion
with (security_invoker = true)
as
select
  coalesce(cf.source, uj.source) as source,
  count(distinct coalesce(cf.candidate_name, uj.candidate_name)) as total_candidates,
  count(distinct uj.candidate_name) filter (where uj.status ilike 'joined%') as joined_candidates
from public.candidate_feedback cf
full outer join public.upcoming_joiners uj
  on uj.candidate_name = cf.candidate_name and uj.position_id = cf.position_id
group by coalesce(cf.source, uj.source);

grant select on
  public.v_positions_with_sla,
  public.v_pipeline_by_position,
  public.v_funnel_overall,
  public.v_funnel_by_department,
  public.v_recruiter_performance,
  public.v_dropouts_flagged,
  public.v_source_conversion
to authenticated;
