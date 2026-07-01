// src/components/automation/nodes/ToolNode.tsx
import React from "react";
import { useReactFlow } from "@xyflow/react";
import { Globe2 } from "lucide-react";
import type { AutomationFlowEdge, AutomationFlowNode } from "../automationTypes";
import { WorkflowNodeShell } from "./WorkflowNodeShell";
import { NodeSelect } from "./NodeSelect";

export function ToolNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow<AutomationFlowNode, AutomationFlowEdge>();
  const toolType = String(data.payload?.toolType || "web_search");
  const toolOptions = [{ value: "web_search", label: "联网搜索" }];

  const updateTool = (value: string) => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== id) return node;
        return {
          ...node,
          data: {
            ...node.data, title: "联网搜索", subtitle: "工具节点", description: undefined,
            payload: { ...(node.data.payload || {}), toolType: value, toolName: "Tavily / Web Search", webSearchMode: "direct" }
          }
        };
      })
    );
  };

  return (
    <WorkflowNodeShell
      data={{ ...data, title: data.title || "工具", subtitle: data.subtitle || "请选择工具", description: data.description }}
      selected={selected} accent="blue" icon={<Globe2 size={17} />}
    >
      <NodeSelect value={toolType} options={toolOptions} accentClass="border-blue-400/20 text-blue-50 focus:border-blue-300/50" onChange={updateTool} />
      <div className="mt-2 truncate rounded-lg border border-blue-500/20 bg-black/15 px-2 py-1 text-[10px] text-blue-200/80">
        工具名称：{String(data.payload?.toolName || "Tavily / Web Search")}
      </div>
    </WorkflowNodeShell>
  );
}