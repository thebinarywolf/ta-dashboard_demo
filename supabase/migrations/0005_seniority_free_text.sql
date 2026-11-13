-- The sheet's Seniority column used to only ever contain "Junior"/"Mid"/
-- "Senior", enforced here via a CHECK constraint. It has since switched to
-- level codes ("L1".."L7"), and may change format again later — drop the
-- constraint so any value the sheet uses syncs through instead of being
-- silently rejected by the database.
alter table public.positions drop constraint if exists positions_seniority_check;
