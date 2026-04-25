-- Diagnostic + optional dedupe for classifications before applying
-- 20260426091500_classifications_unique.sql.
--
-- Run §1 first (read-only) to see how many duplicate (report_id, agent)
-- pairs exist. If the count is 0, the unique-constraint migration applies
-- cleanly and §2 is unnecessary. If > 0, decide whether to dedupe
-- (§2 keeps the most recent row per pair) or to preserve history by
-- reshaping the constraint.

-- §1 — diagnostic, read-only.
select report_id,
       agent,
       count(*) as duplicate_count,
       array_agg(id order by created_at desc) as ids_newest_first
  from public.classifications
 group by report_id, agent
having count(*) > 1
 order by duplicate_count desc;

-- §2 — explicit dedupe. Run only if §1 reports duplicates AND you want to
-- collapse to the latest row per (report_id, agent). Wrap in a transaction
-- so a mistake rolls back.
--
-- begin;
-- delete from public.classifications c
-- using public.classifications c2
-- where c.report_id = c2.report_id
--   and c.agent = c2.agent
--   and c.created_at < c2.created_at;
-- delete from public.classifications c
-- using public.classifications c2
-- where c.report_id = c2.report_id
--   and c.agent = c2.agent
--   and c.created_at = c2.created_at
--   and c.id > c2.id;
-- commit;
