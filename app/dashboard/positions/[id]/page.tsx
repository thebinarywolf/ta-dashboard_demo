import Link from "next/link";
import { notFound } from "next/navigation";
import { getPositionById } from "@/lib/metrics/positions";
import { getPipelineForPosition } from "@/lib/metrics/pipeline";
import { getJoinersForPosition } from "@/lib/metrics/joiners";
import { isYetToJoinStatus } from "@/lib/local-db/queries";
import { joinDateText } from "@/lib/format-join-date";
import {
  getInterviewedLast7DaysForPosition,
  getInterviewHistoryForPosition,
  getRejectionReasonsForPosition,
} from "@/lib/metrics/interviews";
import { requireTabAccess } from "@/lib/auth/guards";
import StatCard from "@/components/stat-card";
import FieldValue from "@/components/field-value";
import AccessRestricted from "@/components/access-restricted";
import GlassCard, { GLASS_PANEL } from "@/components/glass-card";
import InterviewHistoryTable from "@/components/interview-history-table";
import ScrollTable from "@/components/scroll-table";

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function PositionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { allowed } = await requireTabAccess("positions");
  if (!allowed) return <AccessRestricted />;

  const position = await getPositionById(params.id);
  if (!position) notFound();

  const positionId = position.position_id;
  const [pipeline, interviewedLast7Days, interviews, rejectionReasons, joiners] = await Promise.all([
    positionId ? getPipelineForPosition(positionId) : Promise.resolve(null),
    positionId ? getInterviewedLast7DaysForPosition(positionId) : Promise.resolve(0),
    positionId ? getInterviewHistoryForPosition(positionId) : Promise.resolve([]),
    positionId ? getRejectionReasonsForPosition(positionId) : Promise.resolve([]),
    positionId ? getJoinersForPosition(positionId) : Promise.resolve([]),
  ]);

  // The sheet's own count can be ahead of the joiner tracker, so never show fewer than it says.
  const yetToJoinNames = new Set(joiners.filter((j) => isYetToJoinStatus(j.status)).map((j) => j.candidate_name));
  const yetToJoin = Math.max(yetToJoinNames.size, position.yet_to_join_count ?? 0, pipeline?.yet_to_join_count ?? 0);
  const notYetListed = Math.max(0, yetToJoin - yetToJoinNames.size);

  const assignedDate = formatDate(position.role_assigned_on);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard" className="text-xs font-semibold text-brand-blue hover:underline">
          &larr; Back to positions
        </Link>
        <h1 className="mt-1 text-lg font-bold text-[#0e1b3d]">
          {position.position_title ?? position.position_id ?? "Untitled position"}
        </h1>
        <p className="text-sm text-slate-500">
          <FieldValue value={position.department} /> · <FieldValue value={position.state} /> ·{" "}
          <FieldValue value={position.seniority} /> priority <FieldValue value={position.priority} />
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Requirement"
          value={
            position.position_open_count !== null ? position.position_open_count : (
              <FieldValue value={null} />
            )
          }
        />
        <StatCard
          label="Pipeline (tracker)"
          value={
            position.pipeline_count !== null ? position.pipeline_count : <FieldValue value={null} />
          }
        />
        <StatCard
          label="Days pending"
          value={
            position.aging_days !== null
              ? `${position.aging_days}d${assignedDate ? ` (since ${assignedDate})` : ""}`
              : "—"
          }
        />
        <StatCard label="Assigned TA" value={position.assigned_ta ?? "—"} />
      </div>

      <div>
        <h2 className="text-sm font-bold text-[#0e1b3d]">Pipeline (from interview log)</h2>
        {!position.position_id && (
          <p className="mt-2 text-sm text-slate-400">
            This position has no Position ID assigned yet in the sheet, so
            candidate pipeline data can&apos;t be linked to it.
          </p>
        )}
        {position.position_id && pipeline && (
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-6">
            <StatCard label="Sourced" value={pipeline.sourced_count} />
            <StatCard label="Interviewed" value={pipeline.interviewed_count} />
            <StatCard label="Interviewed (7d)" value={interviewedLast7Days} />
            <StatCard label="Selected" value={pipeline.selected_count} />
            <StatCard label="Yet to join" value={yetToJoin} />
            <StatCard label="Joined" value={pipeline.joined_count} />
          </div>
        )}
      </div>

      {position.position_id && (joiners.length > 0 || yetToJoin > 0) && (
        <div>
          <h2 className="text-sm font-bold text-[#0e1b3d]">Who is joining</h2>
          {joiners.length > 0 && (
            <ScrollTable outerClassName="mt-3" className={`${GLASS_PANEL}`}>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Joining on</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Recruiter</th>
                  </tr>
                </thead>
                <tbody>
                  {joiners.map((j) => (
                    <tr key={j.id} className="border-b border-slate-200/50 last:border-0">
                      <td className="px-4 py-3 font-semibold text-[#0e1b3d]">{j.candidate_name ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{joinDateText(j.doj)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            isYetToJoinStatus(j.status)
                              ? "bg-blue-50 text-brand-blue-dark"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {j.status ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{j.source ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{j.recruiter ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollTable>
          )}
          {notYetListed > 0 && (
            <p className="mt-2 rounded-2xl bg-blue-50 px-4 py-2 text-xs text-brand-blue-dark">
              The Positions sheet says {yetToJoin} {yetToJoin === 1 ? "person is" : "people are"} yet to join, but{" "}
              {notYetListed === 1 ? "one is" : `${notYetListed} are`} not in the joiner tracker yet, so there is no name or date to
              show here.{position.comments ? ` Sheet note: "${position.comments}".` : ""}
            </p>
          )}
        </div>
      )}

      {position.position_id && (
        <div>
          <h2 className="text-sm font-bold text-[#0e1b3d]">Rejection reasons</h2>
          {rejectionReasons.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">No rejections recorded for this position.</p>
          ) : (
            <ScrollTable outerClassName="mt-3" className={`${GLASS_PANEL}`}>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {rejectionReasons.map((r) => (
                    <tr key={r.reason} className="border-b border-slate-200/50 last:border-0">
                      <td className="px-4 py-3 text-slate-900">
                        <FieldValue value={r.reason} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollTable>
          )}
        </div>
      )}

      {position.position_id && (
        <div>
          <h2 className="text-sm font-bold text-[#0e1b3d]">Interview history</h2>
          {interviews.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">No interview activity recorded yet.</p>
          ) : (
            <ScrollTable outerClassName="mt-3" className={`${GLASS_PANEL}`}>
              <InterviewHistoryTable
                rows={interviews.map((c) => ({
                  id: c.id,
                  dateLabel: formatDate(c.feedback_date),
                  candidate: c.candidate_name,
                  round: c.interview_round,
                  interviewer: c.interviewer,
                  outcome: c.outcome,
                  feedback: c.feedback,
                  reason: c.reason,
                }))}
              />
            </ScrollTable>
          )}
        </div>
      )}

      {position.comments && (
        <div>
          <h2 className="text-sm font-bold text-[#0e1b3d]">Comments</h2>
          <p className="mt-2 text-sm text-slate-600">{position.comments}</p>
        </div>
      )}
    </div>
  );
}
