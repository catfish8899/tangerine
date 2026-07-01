// src/components/automation/nodes/HardwareNode.tsx
import React from "react";
import { useReactFlow } from "@xyflow/react";
import { Cpu } from "lucide-react";
import type { AutomationFlowEdge, AutomationFlowNode } from "../automationTypes";
import { WorkflowNodeShell } from "./WorkflowNodeShell";
import { NodeSelect } from "./NodeSelect";

export function HardwareNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow<AutomationFlowNode, AutomationFlowEdge>();
  const hardwareAction = String(data.payload?.hardwareAction || "connect_hardware");
  const hardwareOptions = [{ value: "connect_hardware", label: "连接硬件" }];

  const updateHardwareAction = (value: string) => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== id) return node;
        return {
          ...node,
          data: {
            ...node.data, title: "硬件", subtitle: "硬件节点",
            payload: { ...(node.data.payload || {}), hardwareAction: value }
          }
        };
      })
    );
  };

  return (
    <WorkflowNodeShell
      data={{ ...data, title: data.title || "硬件", subtitle: data.subtitle || "请选择硬件动作", description: data.description }}
      selected={selected} accent="slate" icon={<Cpu size={17} />}
    >
      <NodeSelect value={hardwareAction} options={hardwareOptions} accentClass="border-slate-400/20 text-slate-50 focus:border-slate-300/50" onChange={updateHardwareAction} />
      <div className="mt-2 rounded-lg border border-slate-400/20 bg-black/20 px-2 py-1.5 text-[11px] font-semibold text-slate-200">连接硬件</div>
    </WorkflowNodeShell>
  );
}