"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FunnelRow } from "@/lib/supabase/types";

// Dark-to-light brand blue across the 5 funnel stages.
const STAGE_COLORS = ["#0c2d70", "#173e9e", "#1e50cc", "#5b83db", "#9bb5ea"];

export default function FunnelChart({ funnel }: { funnel: FunnelRow }) {
  const stages = [
    { stage: "Sourced", value: funnel.sourced },
    { stage: "Interviewed", value: funnel.interviewed },
    { stage: "Selected", value: funnel.selected },
    { stage: "Offer accepted", value: funnel.offer_accepted },
    { stage: "Joined", value: funnel.joined },
  ];

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={stages} layout="vertical" margin={{ left: 24 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="stage" width={110} />
          <Tooltip />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {stages.map((_, i) => (
              <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
