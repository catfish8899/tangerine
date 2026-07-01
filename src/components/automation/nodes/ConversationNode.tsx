// src/components/automation/nodes/ConversationNode.tsx
import React from "react";
import { useReactFlow } from "@xyflow/react";
import { MessageCircle } from "lucide-react";
import type { AutomationFlowEdge, AutomationFlowNode } from "../automationTypes";
import { WorkflowNodeShell } from "./WorkflowNodeShell";
import { NodeSelect } from "./NodeSelect";

export function ConversationNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow<AutomationFlowNode, AutomationFlowEdge>();
  const conversationType = String(data.payload?.conversationType || "text_input");
  const content = String(data.payload?.content || "");
  const conversationOptions = [{ value: "text_input", label: "文本对话" }];

  const updateConversationType = (value: string) => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== id) return node;
        return {
          ...node,
          data: {
            ...node.data, title: "对话", subtitle: "文本对话节点",
            payload: { ...(node.data.payload || {}), conversationType: value }
          }
        };
      })
    );
  };

  const updateContent = (value: string) => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== id) return node;
        return { ...node, data: { ...node.data, payload: { ...(node.data.payload || {}), content: value } } };
      })
    );
  };

  return (
    <WorkflowNodeShell
      data={{ ...data, title: data.title || "对话", subtitle: data.subtitle || "请选择对话类型", description: data.description }}
      selected={selected} accent="cyan" icon={<MessageCircle size={17} />}
    >
      <NodeSelect value={conversationType} options={conversationOptions} accentClass="border-cyan-400/20 text-cyan-50 focus:border-cyan-300/50" onChange={updateConversationType} />
      <textarea
        className="nodrag mt-2 h-20 w-full resize-none rounded-lg border border-cyan-400/20 bg-black/25 px-2 py-1.5 text-[11px] leading-relaxed text-cyan-50 outline-none placeholder:text-cyan-200/35 focus:border-cyan-300/50"
        placeholder="请输入对话内容..." value={content} onChange={(event) => updateContent(event.target.value)}
      />
    </WorkflowNodeShell>
  );
}