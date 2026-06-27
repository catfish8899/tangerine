// src/components/automation/AutomationNodes.tsx
import React from "react";
import {
  Handle,
  NodeResizer,
  Position,
  useReactFlow
} from "@xyflow/react";
import {
  BoxSelect,
  Clock3,
  Cpu,
  Globe2,
  MessageCircle,
  UserSquare2
} from "lucide-react";
import type {
  AutomationFlowEdge,
  AutomationFlowNode,
  AutomationNodeData
} from "./automationTypes";

function WorkflowNodeShell({
  data,
  selected,
  accent,
  icon,
  children
}: {
  data: AutomationNodeData;
  selected: boolean;
  accent: "amber" | "blue" | "emerald" | "cyan" | "slate" | "rose";
  icon: React.ReactNode;
  children?: React.ReactNode;
}) {
  const accentStyles = {
    amber: {
      border: "border-amber-500/45",
      bg: "bg-amber-500/[0.10]",
      iconBg: "bg-amber-500/20",
      iconText: "text-amber-400",
      glow: "shadow-[0_0_26px_rgba(245,158,11,0.10)]"
    },
    blue: {
      border: "border-blue-500/45",
      bg: "bg-blue-500/[0.10]",
      iconBg: "bg-blue-500/20",
      iconText: "text-blue-400",
      glow: "shadow-[0_0_26px_rgba(59,130,246,0.10)]"
    },
    emerald: {
      border: "border-emerald-500/45",
      bg: "bg-emerald-500/[0.10]",
      iconBg: "bg-emerald-500/20",
      iconText: "text-emerald-400",
      glow: "shadow-[0_0_26px_rgba(16,185,129,0.10)]"
    },
    cyan: {
      border: "border-cyan-500/45",
      bg: "bg-cyan-500/[0.10]",
      iconBg: "bg-cyan-500/20",
      iconText: "text-cyan-300",
      glow: "shadow-[0_0_26px_rgba(34,211,238,0.10)]"
    },
    slate: {
      border: "border-slate-400/45",
      bg: "bg-slate-500/[0.10]",
      iconBg: "bg-slate-400/20",
      iconText: "text-slate-300",
      glow: "shadow-[0_0_26px_rgba(148,163,184,0.10)]"
    },
    rose: {
      border: "border-rose-500/45",
      bg: "bg-rose-500/[0.10]",
      iconBg: "bg-rose-500/20",
      iconText: "text-rose-300",
      glow: "shadow-[0_0_26px_rgba(244,63,94,0.10)]"
    }
  }[accent];

  return (
    <div
      className={`relative min-w-[180px] rounded-2xl border ${accentStyles.border} ${accentStyles.bg} ${
        selected ? accentStyles.glow : ""
      } px-4 py-3 text-gray-200 backdrop-blur-md transition-shadow`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-[#111827] !bg-slate-300"
      />

      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accentStyles.iconBg} ${accentStyles.iconText}`}
        >
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-bold tracking-wide text-gray-100">
            {data.title}
          </div>

          {data.subtitle && (
            <div className="mt-0.5 truncate text-[10px] text-gray-500">
              {data.subtitle}
            </div>
          )}

          {data.description && (
            <div className="mt-2 max-h-[38px] overflow-hidden text-[10px] leading-relaxed text-gray-400">
              {data.description}
            </div>
          )}

          {children}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-[#111827] !bg-blue-400"
      />
    </div>
  );
}

function RoleWorkflowNode({ data, selected }: any) {
  return (
    <WorkflowNodeShell
      data={data}
      selected={selected}
      accent="amber"
      icon={<UserSquare2 size={17} />}
    />
  );
}

function ToolWorkflowNode({ data, selected }: any) {
  return (
    <WorkflowNodeShell
      data={{
        ...data,
        title: "联网搜索",
        subtitle: undefined,
        description: undefined
      }}
      selected={selected}
      accent="blue"
      icon={<Globe2 size={17} />}
    >
      <div className="mt-2 truncate rounded-lg border border-blue-500/20 bg-black/15 px-2 py-1 text-[10px] text-blue-200/80">
        工具名称：{String(data.payload?.toolName || "Tavily / Web Search")}
      </div>
    </WorkflowNodeShell>
  );
}

function TriggerWorkflowNode({ data, selected }: any) {
  return (
    <button
      type="button"
      className={`relative flex min-w-[150px] items-center justify-center gap-2 rounded-full border border-emerald-500/50 bg-emerald-500/15 px-5 py-3 text-xs font-bold text-emerald-100 backdrop-blur-md transition-all hover:bg-emerald-500/25 ${
        selected ? "shadow-[0_0_28px_rgba(16,185,129,0.20)]" : ""
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-[#111827] !bg-slate-300"
      />

      <MessageCircle size={16} className="text-emerald-300" />
      <span>{data.title || "开始对话"}</span>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-[#111827] !bg-emerald-400"
      />
    </button>
  );
}

function CollectionWorkflowNode({ data, selected }: any) {
  return (
    <div className="relative h-full w-full rounded-2xl border border-dashed border-purple-400/45 bg-purple-500/[0.045] backdrop-blur-[1px]">
      <NodeResizer
        isVisible={selected}
        minWidth={220}
        minHeight={140}
        lineStyle={{
          borderColor: "rgba(168, 85, 247, 0.65)"
        }}
        handleStyle={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: "rgba(168, 85, 247, 0.95)",
          border: "1px solid rgba(20,20,20,0.9)"
        }}
      />

      <div className="absolute left-3 top-3 flex items-center gap-2 rounded-lg border border-purple-400/20 bg-[#141414]/75 px-2.5 py-1 text-[10px] font-semibold text-purple-200 shadow-lg backdrop-blur-md">
        <BoxSelect size={12} />
        <span>{data.title || "集合区域"}</span>
      </div>
    </div>
  );
}

function ConversationWorkflowNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow<AutomationFlowNode, AutomationFlowEdge>();
  const content = String(data.payload?.content || "");

  const updateContent = (value: string) => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== id) return node;

        return {
          ...node,
          data: {
            ...node.data,
            payload: {
              ...(node.data.payload || {}),
              content: value
            }
          }
        };
      })
    );
  };

  return (
    <WorkflowNodeShell
      data={{
        ...data,
        title: "对话",
        subtitle: undefined,
        description: undefined
      }}
      selected={selected}
      accent="cyan"
      icon={<MessageCircle size={17} />}
    >
      <textarea
        className="nodrag mt-2 h-20 w-full resize-none rounded-lg border border-cyan-400/20 bg-black/25 px-2 py-1.5 text-[11px] leading-relaxed text-cyan-50 outline-none placeholder:text-cyan-200/35 focus:border-cyan-300/50"
        placeholder="请输入对话内容..."
        value={content}
        onChange={(event) => updateContent(event.target.value)}
      />
    </WorkflowNodeShell>
  );
}

function HardwareWorkflowNode({ data, selected }: any) {
  return (
    <WorkflowNodeShell
      data={{
        ...data,
        title: "硬件",
        subtitle: undefined,
        description: undefined
      }}
      selected={selected}
      accent="slate"
      icon={<Cpu size={17} />}
    >
      <div className="mt-2 rounded-lg border border-slate-400/20 bg-black/20 px-2 py-1.5 text-[11px] font-semibold text-slate-200">
        连接硬件
      </div>
    </WorkflowNodeShell>
  );
}

function TimerWorkflowNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow<AutomationFlowNode, AutomationFlowEdge>();
  const timerText = String(data.payload?.timerText || "");

  const updateTimerText = (value: string) => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== id) return node;

        return {
          ...node,
          data: {
            ...node.data,
            payload: {
              ...(node.data.payload || {}),
              timerText: value
            }
          }
        };
      })
    );
  };

  return (
    <WorkflowNodeShell
      data={{
        ...data,
        title: "定时",
        subtitle: undefined,
        description: undefined
      }}
      selected={selected}
      accent="rose"
      icon={<Clock3 size={17} />}
    >
      <input
        className="nodrag mt-2 w-full rounded-lg border border-rose-400/20 bg-black/25 px-2 py-1.5 text-[11px] text-rose-50 outline-none placeholder:text-rose-200/35 focus:border-rose-300/50"
        placeholder="例如：2026年01月01日 下午 3:30"
        value={timerText}
        onChange={(event) => updateTimerText(event.target.value)}
      />
      <div className="mt-1 text-[9px] text-rose-200/45">
        年月日，12 小时制
      </div>
    </WorkflowNodeShell>
  );
}

export const nodeTypes = {
  automationRoleNode: RoleWorkflowNode,
  automationToolNode: ToolWorkflowNode,
  automationTriggerNode: TriggerWorkflowNode,
  automationCollectionNode: CollectionWorkflowNode,
  automationConversationNode: ConversationWorkflowNode,
  automationHardwareNode: HardwareWorkflowNode,
  automationTimerNode: TimerWorkflowNode
};