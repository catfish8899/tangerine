// src/components/automation/nodes/TriggerNode.tsx
import React from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { PlayCircle } from "lucide-react";
import type { AutomationFlowEdge, AutomationFlowNode } from "../automationTypes";
import { NodeSelect } from "./NodeSelect";

export function TriggerNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow<AutomationFlowNode, AutomationFlowEdge>();
  const triggerType = String(data.payload?.triggerType || "start_chat");
  const triggerOptions = [{ value: "start_chat", label: "开始对话" }];

  const updateTrigger = (value: string) => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== id) return node;
        return {
          ...node,
          data: {
            ...node.data, title: "开始对话", subtitle: "入口节点",
            payload: { ...(node.data.payload || {}), triggerType: value }
          }
        };
      })
    );
  };

  return (
    <div
      className={`relative min-w-[190px] rounded-2xl border border-emerald-500/50 bg-emerald-500/15 px-4 py-3 text-emerald-100 backdrop-blur-md transition-all hover:bg-emerald-500/20 ${
        selected ? "shadow-[0_0_28px_rgba(16,185,129,0.20)]" : ""
      }`}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-[#111827] !bg-slate-300" />
      <div className="flex items-center gap-2 text-xs font-bold">
        <PlayCircle size={16} className="text-emerald-300" />
        <span>{data.title || "开关"}</span>
      </div>
      {data.subtitle && <div className="mt-0.5 text-[10px] text-emerald-100/45">{data.subtitle}</div>}
      <NodeSelect value={triggerType} options={triggerOptions} accentClass="border-emerald-400/20 text-emerald-50 focus:border-emerald-300/50" onChange={updateTrigger} />
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-[#111827] !bg-emerald-400" />
    </div>
  );
}