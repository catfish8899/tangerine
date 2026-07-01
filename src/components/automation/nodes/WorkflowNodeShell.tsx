// src/components/automation/nodes/WorkflowNodeShell.tsx
import React from "react";
import { Handle, Position } from "@xyflow/react";
import type { AutomationNodeData } from "../automationTypes";

interface WorkflowNodeShellProps {
  data: AutomationNodeData;
  selected: boolean;
  accent: "amber" | "blue" | "emerald" | "cyan" | "slate" | "rose";
  icon: React.ReactNode;
  children?: React.ReactNode;
}

export function WorkflowNodeShell({
  data,
  selected,
  accent,
  icon,
  children
}: WorkflowNodeShellProps) {
  const accentStyles = {
    amber: {
      border: "border-amber-500/45", bg: "bg-amber-500/[0.10]", iconBg: "bg-amber-500/20",
      iconText: "text-amber-400", glow: "shadow-[0_0_26px_rgba(245,158,11,0.10)]"
    },
    blue: {
      border: "border-blue-500/45", bg: "bg-blue-500/[0.10]", iconBg: "bg-blue-500/20",
      iconText: "text-blue-400", glow: "shadow-[0_0_26px_rgba(59,130,246,0.10)]"
    },
    emerald: {
      border: "border-emerald-500/45", bg: "bg-emerald-500/[0.10]", iconBg: "bg-emerald-500/20",
      iconText: "text-emerald-400", glow: "shadow-[0_0_26px_rgba(16,185,129,0.10)]"
    },
    cyan: {
      border: "border-cyan-500/45", bg: "bg-cyan-500/[0.10]", iconBg: "bg-cyan-500/20",
      iconText: "text-cyan-300", glow: "shadow-[0_0_26px_rgba(34,211,238,0.10)]"
    },
    slate: {
      border: "border-slate-400/45", bg: "bg-slate-500/[0.10]", iconBg: "bg-slate-400/20",
      iconText: "text-slate-300", glow: "shadow-[0_0_26px_rgba(148,163,184,0.10)]"
    },
    rose: {
      border: "border-rose-500/45", bg: "bg-rose-500/[0.10]", iconBg: "bg-rose-500/20",
      iconText: "text-rose-300", glow: "shadow-[0_0_26px_rgba(244,63,94,0.10)]"
    }
  }[accent];

  return (
    <div
      className={`relative min-w-[180px] rounded-2xl border ${accentStyles.border} ${accentStyles.bg} ${
        selected ? accentStyles.glow : ""
      } px-4 py-3 text-gray-200 backdrop-blur-md transition-shadow`}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-[#111827] !bg-slate-300" />

      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accentStyles.iconBg} ${accentStyles.iconText}`}>
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-bold tracking-wide text-gray-100">{data.title}</div>
          {data.subtitle && <div className="mt-0.5 truncate text-[10px] text-gray-500">{data.subtitle}</div>}
          {data.description && (
            <div className="mt-2 max-h-[38px] overflow-hidden text-[10px] leading-relaxed text-gray-400">
              {data.description}
            </div>
          )}
          {children}
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-[#111827] !bg-blue-400" />
    </div>
  );
}