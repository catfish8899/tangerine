// src/components/AutomationWorkspace.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  Connection,
  Edge,
  Node,
  NodeResizer,
  Handle,
  Position,
  MiniMap,
  useReactFlow
} from "@xyflow/react";
import type { EdgeChange, NodeChange, OnNodeDrag } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  UserSquare2,
  Wrench,
  PlayCircle,
  Layers,
  Globe2,
  MessageCircle,
  BoxSelect,
  ChevronUp,
  Cpu,
  Clock3
} from "lucide-react";
import { Role } from "../types/chat";

const ROLES_STORAGE_KEY = "tangerine_roles";
const AUTOMATION_FLOW_STORAGE_PREFIX = "tangerine_automation_flow_";
const AUTOMATION_CLIPBOARD_STORAGE_KEY = "tangerine_automation_clipboard";
const MAX_HISTORY_LENGTH = 80;

type AutomationNodeKind =
  | "role"
  | "tool"
  | "trigger"
  | "collection"
  | "conversation"
  | "hardware"
  | "timer";

interface AutomationTemplate {
  id: string;
  nodeKind: AutomationNodeKind;
  title: string;
  subtitle?: string;
  description?: string;
  icon: "role" | "tool" | "trigger" | "collection" | "web" | "conversation" | "hardware" | "timer";
  colorClass: string;
  payload?: Record<string, unknown>;
  disabled?: boolean;
}

interface AutomationNodeData extends Record<string, unknown> {
  title: string;
  subtitle?: string;
  description?: string;
  automationType: AutomationNodeKind;
  payload?: Record<string, unknown>;
}

type AutomationFlowNode = Node<AutomationNodeData>;
type AutomationFlowEdge = Edge;

interface PointerPreview {
  x: number;
  y: number;
}

interface FlowPoint {
  x: number;
  y: number;
}

interface FlowSize {
  width: number;
  height: number;
}

interface AutomationFlowSnapshot {
  nodes: AutomationFlowNode[];
  edges: AutomationFlowEdge[];
}

interface PersistedAutomationFlow {
  version: 1;
  nodes: AutomationFlowNode[];
  edges: AutomationFlowEdge[];
  updatedAt: number;
}

interface ClipboardNode {
  node: AutomationFlowNode;
  absolutePosition: FlowPoint;
}

interface AutomationClipboard {
  version: 1;
  nodes: ClipboardNode[];
  edges: AutomationFlowEdge[];
  copiedAt: number;
}

const generateUniqueId = () =>
  `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const generateUniqueEdgeId = () =>
  `edge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const cloneFlowSnapshot = (snapshot: AutomationFlowSnapshot): AutomationFlowSnapshot => ({
  nodes: JSON.parse(JSON.stringify(snapshot.nodes)),
  edges: JSON.parse(JSON.stringify(snapshot.edges))
});

function getAutomationFlowStorageKey(sessionId: string) {
  return `${AUTOMATION_FLOW_STORAGE_PREFIX}${sessionId}`;
}

function isEditableElement(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;

  const tagName = element.tagName?.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    element.isContentEditable
  );
}

function areSnapshotsEqual(a: AutomationFlowSnapshot, b: AutomationFlowSnapshot) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function safeLoadRoles(): Role[] {
  const saved = localStorage.getItem(ROLES_STORAGE_KEY);
  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("自动化工作流读取角色数据失败：", e);
    return [];
  }
}

function safeLoadAutomationFlow(sessionId: string): AutomationFlowSnapshot {
  const saved = localStorage.getItem(getAutomationFlowStorageKey(sessionId));
  if (!saved) {
    return {
      nodes: [],
      edges: []
    };
  }

  try {
    const parsed = JSON.parse(saved) as PersistedAutomationFlow;
    return {
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges : []
    };
  } catch (e) {
    console.error("自动化工作流读取画布数据失败：", e);
    return {
      nodes: [],
      edges: []
    };
  }
}

function safeSaveAutomationFlow(sessionId: string, snapshot: AutomationFlowSnapshot) {
  try {
    const payload: PersistedAutomationFlow = {
      version: 1,
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      updatedAt: Date.now()
    };

    localStorage.setItem(getAutomationFlowStorageKey(sessionId), JSON.stringify(payload));
  } catch (e) {
    console.error("自动化工作流保存画布数据失败：", e);
  }
}

function safeLoadAutomationClipboard(): AutomationClipboard | null {
  const saved = localStorage.getItem(AUTOMATION_CLIPBOARD_STORAGE_KEY);
  if (!saved) return null;

  try {
    const parsed = JSON.parse(saved) as AutomationClipboard;
    if (!Array.isArray(parsed.nodes)) return null;

    return {
      version: 1,
      nodes: parsed.nodes,
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
      copiedAt: parsed.copiedAt || Date.now()
    };
  } catch (e) {
    console.error("自动化工作流读取剪贴板失败：", e);
    return null;
  }
}

function safeSaveAutomationClipboard(clipboard: AutomationClipboard) {
  try {
    localStorage.setItem(AUTOMATION_CLIPBOARD_STORAGE_KEY, JSON.stringify(clipboard));
  } catch (e) {
    console.error("自动化工作流保存剪贴板失败：", e);
  }
}

function TemplateIcon({
  icon,
  size = 18
}: {
  icon: AutomationTemplate["icon"];
  size?: number;
}) {
  if (icon === "role") return <UserSquare2 size={size} />;
  if (icon === "tool") return <Wrench size={size} />;
  if (icon === "trigger") return <PlayCircle size={size} />;
  if (icon === "collection") return <Layers size={size} />;
  if (icon === "conversation") return <MessageCircle size={size} />;
  if (icon === "hardware") return <Cpu size={size} />;
  if (icon === "timer") return <Clock3 size={size} />;
  return <Globe2 size={size} />;
}

function getNodeSize(node: AutomationFlowNode): FlowSize {
  const measured = (node as any).measured;
  const style = node.style as React.CSSProperties | undefined;

  const styleWidth =
    typeof style?.width === "number"
      ? style.width
      : typeof style?.width === "string"
        ? Number.parseFloat(style.width)
        : undefined;

  const styleHeight =
    typeof style?.height === "number"
      ? style.height
      : typeof style?.height === "string"
        ? Number.parseFloat(style.height)
        : undefined;

  const fallbackByType: Record<AutomationNodeKind, FlowSize> = {
    role: { width: 180, height: 88 },
    tool: { width: 180, height: 78 },
    trigger: { width: 150, height: 52 },
    collection: { width: 360, height: 260 },
    conversation: { width: 240, height: 150 },
    hardware: { width: 180, height: 78 },
    timer: { width: 240, height: 116 }
  };

  const fallback = fallbackByType[node.data.automationType] || { width: 180, height: 88 };

  return {
    width:
      typeof measured?.width === "number"
        ? measured.width
        : typeof (node as any).width === "number"
          ? (node as any).width
          : styleWidth || fallback.width,
    height:
      typeof measured?.height === "number"
        ? measured.height
        : typeof (node as any).height === "number"
          ? (node as any).height
          : styleHeight || fallback.height
  };
}

function getNodeAbsolutePosition(
  nodes: AutomationFlowNode[],
  node: AutomationFlowNode
): FlowPoint {
  if (!node.parentId) {
    return {
      x: node.position.x,
      y: node.position.y
    };
  }

  const parent = nodes.find((candidate) => candidate.id === node.parentId);
  if (!parent) {
    return {
      x: node.position.x,
      y: node.position.y
    };
  }

  const parentAbsolutePosition = getNodeAbsolutePosition(nodes, parent);

  return {
    x: parentAbsolutePosition.x + node.position.x,
    y: parentAbsolutePosition.y + node.position.y
  };
}

function isPointInsideNode(
  point: FlowPoint,
  node: AutomationFlowNode,
  nodes: AutomationFlowNode[]
): boolean {
  const absolutePosition = getNodeAbsolutePosition(nodes, node);
  const size = getNodeSize(node);

  return (
    point.x >= absolutePosition.x &&
    point.x <= absolutePosition.x + size.width &&
    point.y >= absolutePosition.y &&
    point.y <= absolutePosition.y + size.height
  );
}

function applyCollectionStickiness(
  nodes: AutomationFlowNode[],
  draggedNodeId: string
): AutomationFlowNode[] {
  const draggedNode = nodes.find((node) => node.id === draggedNodeId);
  if (!draggedNode) return nodes;

  if (draggedNode.data.automationType === "collection") {
    return nodes;
  }

  const draggedAbsolutePosition = getNodeAbsolutePosition(nodes, draggedNode);
  const draggedSize = getNodeSize(draggedNode);
  const draggedCenter = {
    x: draggedAbsolutePosition.x + draggedSize.width / 2,
    y: draggedAbsolutePosition.y + draggedSize.height / 2
  };

  const containingCollections = nodes
    .filter(
      (node) =>
        node.id !== draggedNode.id &&
        node.data.automationType === "collection" &&
        isPointInsideNode(draggedCenter, node, nodes)
    )
    .sort((a, b) => {
      const sizeA = getNodeSize(a);
      const sizeB = getNodeSize(b);
      return sizeA.width * sizeA.height - sizeB.width * sizeB.height;
    });

  const targetCollection = containingCollections[0];

  if (!targetCollection) {
    if (!draggedNode.parentId) return nodes;

    return nodes.map((node) => {
      if (node.id !== draggedNode.id) return node;

      return {
        ...node,
        parentId: undefined,
        position: draggedAbsolutePosition,
        zIndex: 10
      };
    });
  }

  const targetCollectionAbsolutePosition = getNodeAbsolutePosition(nodes, targetCollection);

  const nextRelativePosition = {
    x: draggedAbsolutePosition.x - targetCollectionAbsolutePosition.x,
    y: draggedAbsolutePosition.y - targetCollectionAbsolutePosition.y
  };

  return nodes.map((node) => {
    if (node.id !== draggedNode.id) return node;

    return {
      ...node,
      parentId: targetCollection.id,
      position: nextRelativePosition,
      zIndex: 10
    };
  });
}

function getDescendantNodeIds(
  nodes: AutomationFlowNode[],
  rootIds: Set<string>
): Set<string> {
  const result = new Set(rootIds);
  let changed = true;

  while (changed) {
    changed = false;

    for (const node of nodes) {
      if (node.parentId && result.has(node.parentId) && !result.has(node.id)) {
        result.add(node.id);
        changed = true;
      }
    }
  }

  return result;
}

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

const nodeTypes = {
  automationRoleNode: RoleWorkflowNode,
  automationToolNode: ToolWorkflowNode,
  automationTriggerNode: TriggerWorkflowNode,
  automationCollectionNode: CollectionWorkflowNode,
  automationConversationNode: ConversationWorkflowNode,
  automationHardwareNode: HardwareWorkflowNode,
  automationTimerNode: TimerWorkflowNode
};

function buildAutomationNode(
  template: AutomationTemplate,
  position: { x: number; y: number }
): AutomationFlowNode {
  if (template.nodeKind === "role") {
    return {
      id: generateUniqueId(),
      type: "automationRoleNode",
      position,
      data: {
        title: template.title,
        subtitle: template.subtitle || "角色节点",
        description: template.description,
        automationType: "role",
        payload: template.payload
      }
    };
  }

  if (template.nodeKind === "tool") {
    return {
      id: generateUniqueId(),
      type: "automationToolNode",
      position,
      data: {
        title: "联网搜索",
        subtitle: undefined,
        description: undefined,
        automationType: "tool",
        payload: {
          ...(template.payload || {}),
          toolName: "Tavily / Web Search"
        }
      }
    };
  }

  if (template.nodeKind === "trigger") {
    return {
      id: generateUniqueId(),
      type: "automationTriggerNode",
      position,
      data: {
        title: "开始对话",
        subtitle: undefined,
        description: undefined,
        automationType: "trigger",
        payload: template.payload
      }
    };
  }

  if (template.nodeKind === "collection") {
    return {
      id: generateUniqueId(),
      type: "automationCollectionNode",
      position,
      data: {
        title: template.title,
        subtitle: template.subtitle || "集合区域",
        description: template.description,
        automationType: "collection",
        payload: template.payload
      },
      style: {
        width: 360,
        height: 260
      },
      zIndex: -1
    };
  }

  if (template.nodeKind === "conversation") {
    return {
      id: generateUniqueId(),
      type: "automationConversationNode",
      position,
      data: {
        title: "对话",
        subtitle: undefined,
        description: undefined,
        automationType: "conversation",
        payload: {
          content: ""
        }
      },
      style: {
        width: 240
      }
    };
  }

  if (template.nodeKind === "hardware") {
    return {
      id: generateUniqueId(),
      type: "automationHardwareNode",
      position,
      data: {
        title: "硬件",
        subtitle: undefined,
        description: undefined,
        automationType: "hardware",
        payload: {
          hardwareAction: "connect_hardware"
        }
      }
    };
  }

  return {
    id: generateUniqueId(),
    type: "automationTimerNode",
    position,
    data: {
      title: "定时",
      subtitle: undefined,
      description: undefined,
      automationType: "timer",
      payload: {
        timerText: ""
      }
    },
    style: {
      width: 240
    }
  };
}

function ToolbarMenu({
  label,
  icon,
  accentClass,
  items,
  onBeforeOpen,
  draggingTemplate,
  onTemplatePointerDown
}: {
  label: string;
  icon: React.ReactNode;
  accentClass: string;
  items: AutomationTemplate[];
  onBeforeOpen?: () => void;
  draggingTemplate: AutomationTemplate | null;
  onTemplatePointerDown: (event: React.PointerEvent, template: AutomationTemplate) => void;
}) {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleMouseEnter = () => {
    clearCloseTimer();
    onBeforeOpen?.();
    setOpen(true);
  };

  const handleMouseLeave = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, 180);
  };

  useEffect(() => {
    return () => clearCloseTimer();
  }, []);

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {open && (
        <>
          <div className="absolute bottom-full left-1/2 h-3 w-64 -translate-x-1/2" />

          <div
            className="absolute bottom-full left-1/2 mb-3 w-64 -translate-x-1/2 rounded-2xl border border-[#333] bg-[#1f1f1f]/95 p-2 shadow-2xl backdrop-blur-xl"
            onMouseEnter={handleMouseEnter}
          >
            <div className="mb-1 flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold text-gray-500">
              <ChevronUp size={12} />
              <span>{label}菜单</span>
            </div>

            <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  onPointerDown={(event) => {
                    if (item.disabled) return;
                    onTemplatePointerDown(event, item);
                  }}
                  className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors ${
                    item.disabled
                      ? "cursor-not-allowed border-[#333] bg-[#222]/70 opacity-50"
                      : draggingTemplate?.id === item.id
                        ? "cursor-grabbing border-white/15 bg-white/10"
                        : "cursor-grab border-transparent hover:border-white/10 hover:bg-white/10"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${item.colorClass}`}
                  >
                    <TemplateIcon icon={item.icon} size={15} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-semibold text-gray-200">
                      {item.title}
                    </div>
                    {item.subtitle && (
                      <div className="truncate text-[10px] text-gray-500">
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <button
        type="button"
        className="group flex flex-col items-center gap-1 rounded-xl p-2 transition-colors hover:bg-white/10"
      >
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-transform group-hover:scale-110 ${accentClass}`}
        >
          {icon}
        </div>
        <span className="text-[10px] font-medium text-gray-400">{label}</span>
      </button>
    </div>
  );
}

function AutomationFloatingToolbar({
  roleItems,
  onReloadRoles,
  draggingTemplate,
  onTemplatePointerDown
}: {
  roleItems: AutomationTemplate[];
  onReloadRoles: () => void;
  draggingTemplate: AutomationTemplate | null;
  onTemplatePointerDown: (event: React.PointerEvent, template: AutomationTemplate) => void;
}) {
  const toolItems: AutomationTemplate[] = useMemo(
    () => [
      {
        id: "tool-web-search",
        nodeKind: "tool",
        title: "联网搜索",
        subtitle: "Tavily / Web Search",
        description: "允许工作流节点调用联网检索能力，用于获取实时网页信息。",
        icon: "web",
        colorClass: "bg-blue-500/20 border-blue-500/40 text-blue-400",
        payload: {
          toolType: "web_search",
          toolName: "Tavily / Web Search",
          webSearchMode: "direct"
        }
      }
    ],
    []
  );

  const triggerItems: AutomationTemplate[] = useMemo(
    () => [
      {
        id: "trigger-start-chat",
        nodeKind: "trigger",
        title: "开始对话",
        subtitle: "工作流入口按钮",
        description: "作为自动化流程的入口节点，后续将用于启动对话链路。",
        icon: "trigger",
        colorClass: "bg-emerald-500/20 border-emerald-500/40 text-emerald-400",
        payload: {
          triggerType: "start_chat"
        }
      }
    ],
    []
  );

  const collectionItems: AutomationTemplate[] = useMemo(
    () => [
      {
        id: "collection-area",
        nodeKind: "collection",
        title: "集合区域",
        subtitle: "可调大小的范围框",
        description: "用于在画布中划分流程区域。选中后可拖动边缘调整大小。",
        icon: "collection",
        colorClass: "bg-purple-500/20 border-purple-500/40 text-purple-400",
        payload: {
          collectionType: "area"
        }
      }
    ],
    []
  );

  const conversationItems: AutomationTemplate[] = useMemo(
    () => [
      {
        id: "conversation-input",
        nodeKind: "conversation",
        title: "对话",
        subtitle: "可输入内容",
        description: "用于在自动化流程中记录或传递一段对话内容。",
        icon: "conversation",
        colorClass: "bg-cyan-500/20 border-cyan-500/40 text-cyan-300",
        payload: {
          content: ""
        }
      }
    ],
    []
  );

  const hardwareItems: AutomationTemplate[] = useMemo(
    () => [
      {
        id: "hardware-connect",
        nodeKind: "hardware",
        title: "硬件",
        subtitle: "连接硬件",
        description: "用于后续接入本地或外部硬件能力。",
        icon: "hardware",
        colorClass: "bg-slate-500/20 border-slate-400/40 text-slate-300",
        payload: {
          hardwareAction: "connect_hardware"
        }
      }
    ],
    []
  );

  const timerItems: AutomationTemplate[] = useMemo(
    () => [
      {
        id: "timer-input",
        nodeKind: "timer",
        title: "定时",
        subtitle: "年月日，12小时制",
        description: "用于设置自动化流程触发或执行时间。",
        icon: "timer",
        colorClass: "bg-rose-500/20 border-rose-500/40 text-rose-300",
        payload: {
          timerText: ""
        }
      }
    ],
    []
  );

  return (
    <div className="absolute bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-[#333] bg-[#1f1f1f]/90 px-5 py-3 shadow-2xl backdrop-blur-xl">
      <ToolbarMenu
        label="角色"
        icon={<UserSquare2 size={18} />}
        accentClass="bg-amber-500/20 border-amber-500/40 text-amber-400"
        items={roleItems}
        onBeforeOpen={onReloadRoles}
        draggingTemplate={draggingTemplate}
        onTemplatePointerDown={onTemplatePointerDown}
      />

      <ToolbarMenu
        label="工具"
        icon={<Wrench size={18} />}
        accentClass="bg-blue-500/20 border-blue-500/40 text-blue-400"
        items={toolItems}
        draggingTemplate={draggingTemplate}
        onTemplatePointerDown={onTemplatePointerDown}
      />

      <ToolbarMenu
        label="开关"
        icon={<PlayCircle size={18} />}
        accentClass="bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
        items={triggerItems}
        draggingTemplate={draggingTemplate}
        onTemplatePointerDown={onTemplatePointerDown}
      />

      <ToolbarMenu
        label="集合"
        icon={<Layers size={18} />}
        accentClass="bg-purple-500/20 border-purple-500/40 text-purple-400"
        items={collectionItems}
        draggingTemplate={draggingTemplate}
        onTemplatePointerDown={onTemplatePointerDown}
      />

      <ToolbarMenu
        label="对话"
        icon={<MessageCircle size={18} />}
        accentClass="bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
        items={conversationItems}
        draggingTemplate={draggingTemplate}
        onTemplatePointerDown={onTemplatePointerDown}
      />

      <ToolbarMenu
        label="硬件"
        icon={<Cpu size={18} />}
        accentClass="bg-slate-500/20 border-slate-400/40 text-slate-300"
        items={hardwareItems}
        draggingTemplate={draggingTemplate}
        onTemplatePointerDown={onTemplatePointerDown}
      />

      <ToolbarMenu
        label="定时"
        icon={<Clock3 size={18} />}
        accentClass="bg-rose-500/20 border-rose-500/40 text-rose-300"
        items={timerItems}
        draggingTemplate={draggingTemplate}
        onTemplatePointerDown={onTemplatePointerDown}
      />
    </div>
  );
}

function DragGhost({
  template,
  pointerPreview
}: {
  template: AutomationTemplate | null;
  pointerPreview: PointerPreview | null;
}) {
  if (!template || !pointerPreview) return null;

  return (
    <div
      className="fixed z-[9999] pointer-events-none flex items-center gap-2 rounded-xl border border-[#444] bg-[#222]/95 px-3 py-2 text-xs text-gray-200 shadow-2xl backdrop-blur-xl"
      style={{
        left: pointerPreview.x + 14,
        top: pointerPreview.y + 14
      }}
    >
      <div
        className={`flex h-7 w-7 items-center justify-center rounded-lg border ${template.colorClass}`}
      >
        <TemplateIcon icon={template.icon} size={15} />
      </div>
      <span>{template.title}</span>
    </div>
  );
}

function SystemTimeBadge() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const formatted = useMemo(() => {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const ampm = hours >= 12 ? "下午" : "上午";

    hours = hours % 12;
    hours = hours || 12;

    return `${year}年${month}月${day}日 ${ampm} ${hours}:${minutes}:${seconds}`;
  }, [now]);

  return (
    <div className="pointer-events-none absolute right-5 top-5 z-40 rounded-xl border border-[#343434] bg-[#1f1f1f]/85 px-3 py-2 text-xs font-medium tracking-wide text-gray-300 shadow-xl backdrop-blur-xl">
      {formatted}
    </div>
  );
}

function FlowEditor({ sessionId }: { sessionId: string }) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [nodes, setNodes, rawOnNodesChange] = useNodesState<AutomationFlowNode>([]);
  const [edges, setEdges, rawOnEdgesChange] = useEdgesState<AutomationFlowEdge>([]);

  const [roles, setRoles] = useState<Role[]>(() => safeLoadRoles());
  const [draggingTemplate, setDraggingTemplate] = useState<AutomationTemplate | null>(null);
  const [pointerPreview, setPointerPreview] = useState<PointerPreview | null>(null);

  const { screenToFlowPosition } = useReactFlow();

  const hydratedRef = useRef(false);
  const persistTimerRef = useRef<number | null>(null);
  const resizeHistoryTimerRef = useRef<number | null>(null);
  const resizeHistoryArmedRef = useRef(false);
  const mouseClientPositionRef = useRef<PointerPreview | null>(null);
  const dragStartSnapshotRef = useRef<AutomationFlowSnapshot | null>(null);
  const historyRef = useRef<AutomationFlowSnapshot[]>([]);
  const flowStateRef = useRef<AutomationFlowSnapshot>({
    nodes: [],
    edges: []
  });

  useEffect(() => {
    flowStateRef.current = {
      nodes,
      edges
    };
  }, [nodes, edges]);

  const pushHistorySnapshot = useCallback((snapshot: AutomationFlowSnapshot) => {
    const clonedSnapshot = cloneFlowSnapshot(snapshot);
    const lastSnapshot = historyRef.current[historyRef.current.length - 1];

    if (lastSnapshot && areSnapshotsEqual(lastSnapshot, clonedSnapshot)) {
      return;
    }

    historyRef.current = [...historyRef.current, clonedSnapshot].slice(-MAX_HISTORY_LENGTH);
  }, []);

  const pushCurrentHistorySnapshot = useCallback(() => {
    pushHistorySnapshot(flowStateRef.current);
  }, [pushHistorySnapshot]);

  useEffect(() => {
    hydratedRef.current = false;
    historyRef.current = [];
    dragStartSnapshotRef.current = null;
    resizeHistoryArmedRef.current = false;

    const snapshot = safeLoadAutomationFlow(sessionId);
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);

    window.requestAnimationFrame(() => {
      hydratedRef.current = true;
    });
  }, [sessionId, setNodes, setEdges]);

  useEffect(() => {
    if (!hydratedRef.current) return;

    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
    }

    persistTimerRef.current = window.setTimeout(() => {
      safeSaveAutomationFlow(sessionId, {
        nodes,
        edges
      });
      persistTimerRef.current = null;
    }, 220);

    return () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [sessionId, nodes, edges]);

  const reloadRoles = useCallback(() => {
    setRoles(safeLoadRoles());
  }, []);

  useEffect(() => {
    const handleStorageChange = () => reloadRoles();
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [reloadRoles]);

  const roleItems: AutomationTemplate[] = useMemo(() => {
    if (roles.length === 0) {
      return [
        {
          id: "role-empty-placeholder",
          nodeKind: "role",
          title: "暂无角色",
          subtitle: "请先在“我的角色”中创建",
          description: "创建角色后，可在这里拖拽到工作流画布。",
          icon: "role",
          colorClass: "bg-amber-500/20 border-amber-500/40 text-amber-400",
          disabled: true
        }
      ];
    }

    return roles.map((role) => ({
      id: `role-${role.id}`,
      nodeKind: "role" as const,
      title: role.name,
      subtitle: "角色节点",
      description: role.systemPrompt,
      icon: "role" as const,
      colorClass: "bg-amber-500/20 border-amber-500/40 text-amber-400",
      payload: {
        roleId: role.id,
        systemPrompt: role.systemPrompt
      }
    }));
  }, [roles]);

  const onNodesChange = useCallback(
    (changes: NodeChange<AutomationFlowNode>[]) => {
      const hasDimensionChange = changes.some((change) => change.type === "dimensions");

      if (hydratedRef.current && hasDimensionChange && !resizeHistoryArmedRef.current) {
        resizeHistoryArmedRef.current = true;
        pushCurrentHistorySnapshot();
      }

      if (resizeHistoryTimerRef.current !== null) {
        window.clearTimeout(resizeHistoryTimerRef.current);
      }

      if (hasDimensionChange) {
        resizeHistoryTimerRef.current = window.setTimeout(() => {
          resizeHistoryArmedRef.current = false;
          resizeHistoryTimerRef.current = null;
        }, 500);
      }

      rawOnNodesChange(changes);
    },
    [pushCurrentHistorySnapshot, rawOnNodesChange]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<AutomationFlowEdge>[]) => {
      rawOnEdgesChange(changes);
    },
    [rawOnEdgesChange]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      pushCurrentHistorySnapshot();

      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: {
              stroke: "rgba(96, 165, 250, 0.75)",
              strokeWidth: 2
            }
          } as any,
          eds
        )
      );
    },
    [pushCurrentHistorySnapshot, setEdges]
  );

  const handleNodeDragStart = useCallback<OnNodeDrag<AutomationFlowNode>>(() => {
    dragStartSnapshotRef.current = cloneFlowSnapshot(flowStateRef.current);
  }, []);

  const handleNodeDragStop = useCallback<OnNodeDrag<AutomationFlowNode>>(
    (_event, draggedNode) => {
      const startSnapshot = dragStartSnapshotRef.current;

      setNodes((currentNodes) => {
        if (startSnapshot) {
          const currentSnapshot = {
            nodes: currentNodes,
            edges: flowStateRef.current.edges
          };

          if (!areSnapshotsEqual(startSnapshot, currentSnapshot)) {
            pushHistorySnapshot(startSnapshot);
          }
        }

        return applyCollectionStickiness(currentNodes, draggedNode.id);
      });

      dragStartSnapshotRef.current = null;
    },
    [pushHistorySnapshot, setNodes]
  );

  const createNodeAtClientPosition = useCallback(
    (clientX: number, clientY: number, template: AutomationTemplate) => {
      const wrapper = wrapperRef.current;
      if (!wrapper || template.disabled) return;

      const rect = wrapper.getBoundingClientRect();

      const isInsideCanvas =
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom;

      if (!isInsideCanvas) return;

      const position = screenToFlowPosition({
        x: clientX,
        y: clientY
      });

      const newNode = buildAutomationNode(template, position);

      pushCurrentHistorySnapshot();

      setNodes((nds) => {
        if (newNode.type === "automationCollectionNode") {
          return [newNode, ...nds];
        }

        return nds.concat(newNode);
      });
    },
    [pushCurrentHistorySnapshot, screenToFlowPosition, setNodes]
  );

  const handleTemplatePointerDown = useCallback(
    (event: React.PointerEvent, template: AutomationTemplate) => {
      if (event.button !== 0 || template.disabled) return;

      event.preventDefault();
      event.stopPropagation();

      setDraggingTemplate(template);
      setPointerPreview({
        x: event.clientX,
        y: event.clientY
      });
    },
    []
  );

  const getCurrentMouseFlowPosition = useCallback((): FlowPoint => {
    const pointer = mouseClientPositionRef.current;
    const wrapper = wrapperRef.current;

    if (pointer) {
      return screenToFlowPosition({
        x: pointer.x,
        y: pointer.y
      });
    }

    if (wrapper) {
      const rect = wrapper.getBoundingClientRect();
      return screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      });
    }

    return {
      x: 0,
      y: 0
    };
  }, [screenToFlowPosition]);

  const copySelectedElements = useCallback(() => {
    const currentNodes = flowStateRef.current.nodes;
    const currentEdges = flowStateRef.current.edges;
    const directlySelectedNodeIds = new Set(
      currentNodes.filter((node) => node.selected).map((node) => node.id)
    );

    if (directlySelectedNodeIds.size === 0) return;

    // 选中集合时，复制集合以及所有已吸附在集合内的子孙节点。
    // 普通节点不受影响，仍然只复制自身。
    const copiedNodeIds = getDescendantNodeIds(currentNodes, directlySelectedNodeIds);
    const copiedNodes = currentNodes.filter((node) => copiedNodeIds.has(node.id));

    const copiedEdges = currentEdges.filter(
      (edge) => copiedNodeIds.has(edge.source) && copiedNodeIds.has(edge.target)
    );

    const clipboard: AutomationClipboard = {
      version: 1,
      nodes: copiedNodes.map((node) => ({
        node: {
          ...node,
          selected: false
        },
        absolutePosition: getNodeAbsolutePosition(currentNodes, node)
      })),
      edges: copiedEdges.map((edge) => ({
        ...edge,
        selected: false
      })),
      copiedAt: Date.now()
    };

    safeSaveAutomationClipboard(clipboard);
  }, []);

  const pasteClipboardAtMouse = useCallback(() => {
    const clipboard = safeLoadAutomationClipboard();
    if (!clipboard || clipboard.nodes.length === 0) return;

    const pasteAnchor = getCurrentMouseFlowPosition();

    const minX = Math.min(...clipboard.nodes.map((item) => item.absolutePosition.x));
    const minY = Math.min(...clipboard.nodes.map((item) => item.absolutePosition.y));
    const maxX = Math.max(
      ...clipboard.nodes.map((item) => {
        const size = getNodeSize(item.node);
        return item.absolutePosition.x + size.width;
      })
    );
    const maxY = Math.max(
      ...clipboard.nodes.map((item) => {
        const size = getNodeSize(item.node);
        return item.absolutePosition.y + size.height;
      })
    );

    const sourceCenter = {
      x: minX + (maxX - minX) / 2,
      y: minY + (maxY - minY) / 2
    };

    const idMap = new Map<string, string>();
    clipboard.nodes.forEach((item) => {
      idMap.set(item.node.id, generateUniqueId());
    });

    const absolutePositionMap = new Map<string, FlowPoint>();
    clipboard.nodes.forEach((item) => {
      const nextId = idMap.get(item.node.id);
      if (!nextId) return;

      absolutePositionMap.set(nextId, {
        x: item.absolutePosition.x - sourceCenter.x + pasteAnchor.x,
        y: item.absolutePosition.y - sourceCenter.y + pasteAnchor.y
      });
    });

    const pastedNodes: AutomationFlowNode[] = clipboard.nodes.map((item) => {
      const nextId = idMap.get(item.node.id) || generateUniqueId();
      const nextAbsolutePosition = absolutePositionMap.get(nextId) || pasteAnchor;
      const originalParentId = item.node.parentId;
      const nextParentId = originalParentId ? idMap.get(originalParentId) : undefined;

      // 如果原节点属于被复制的集合，粘贴后继续属于新集合。
      // 由于父子节点整体位移一致，所以内部元素相对集合的位置保持不变。
      const nextPosition =
        nextParentId && absolutePositionMap.has(nextParentId)
          ? {
              x: nextAbsolutePosition.x - absolutePositionMap.get(nextParentId)!.x,
              y: nextAbsolutePosition.y - absolutePositionMap.get(nextParentId)!.y
            }
          : nextAbsolutePosition;

      return {
        ...item.node,
        id: nextId,
        parentId: nextParentId,
        selected: true,
        position: nextPosition,
        zIndex:
          item.node.data.automationType === "collection"
            ? -1
            : item.node.zIndex || 10
      };
    });

    const pastedEdges: AutomationFlowEdge[] = clipboard.edges
      .map((edge) => {
        const nextSource = idMap.get(edge.source);
        const nextTarget = idMap.get(edge.target);

        if (!nextSource || !nextTarget) return null;

        return {
          ...edge,
          id: generateUniqueEdgeId(),
          source: nextSource,
          target: nextTarget,
          selected: false
        } as AutomationFlowEdge;
      })
      .filter(Boolean) as AutomationFlowEdge[];

    pushCurrentHistorySnapshot();

    setNodes((currentNodes): AutomationFlowNode[] => {
      const unselectedCurrentNodes: AutomationFlowNode[] = currentNodes.map(
        (node): AutomationFlowNode => ({
          ...node,
          selected: false
        })
      );

      return [...unselectedCurrentNodes, ...pastedNodes].sort((a, b) => {
        const aIsCollection = a.data.automationType === "collection";
        const bIsCollection = b.data.automationType === "collection";

        if (aIsCollection === bIsCollection) return 0;
        return aIsCollection ? -1 : 1;
      });
    });

    setEdges((currentEdges): AutomationFlowEdge[] => {
      const unselectedCurrentEdges: AutomationFlowEdge[] = currentEdges.map(
        (edge): AutomationFlowEdge => ({
          ...edge,
          selected: false
        })
      );

      return [...unselectedCurrentEdges, ...pastedEdges];
    });
  }, [getCurrentMouseFlowPosition, pushCurrentHistorySnapshot, setEdges, setNodes]);

  const deleteSelectedElements = useCallback(() => {
    const currentNodes = flowStateRef.current.nodes;
    const currentEdges = flowStateRef.current.edges;
    const selectedNodeIds = new Set(
      currentNodes.filter((node) => node.selected).map((node) => node.id)
    );
    const selectedEdgeIds = new Set(
      currentEdges.filter((edge) => edge.selected).map((edge) => edge.id)
    );

    if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) return;

    const idsToDelete = getDescendantNodeIds(currentNodes, selectedNodeIds);

    pushCurrentHistorySnapshot();

    setNodes((current) => current.filter((node) => !idsToDelete.has(node.id)));
    setEdges((current) =>
      current.filter(
        (edge) =>
          !selectedEdgeIds.has(edge.id) &&
          !idsToDelete.has(edge.source) &&
          !idsToDelete.has(edge.target)
      )
    );
  }, [pushCurrentHistorySnapshot, setEdges, setNodes]);

  const undoLastOperation = useCallback(() => {
    const previousSnapshot = historyRef.current[historyRef.current.length - 1];
    if (!previousSnapshot) return;

    historyRef.current = historyRef.current.slice(0, -1);

    const clonedSnapshot = cloneFlowSnapshot(previousSnapshot);
    setNodes(clonedSnapshot.nodes);
    setEdges(clonedSnapshot.edges);
  }, [setEdges, setNodes]);

  useEffect(() => {
    if (!draggingTemplate) return;

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    const handlePointerMove = (event: PointerEvent) => {
      setPointerPreview({
        x: event.clientX,
        y: event.clientY
      });
    };

    const handlePointerUp = (event: PointerEvent) => {
      createNodeAtClientPosition(event.clientX, event.clientY, draggingTemplate);
      setDraggingTemplate(null);
      setPointerPreview(null);
    };

    const handlePointerCancel = () => {
      setDraggingTemplate(null);
      setPointerPreview(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;

      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [draggingTemplate, createNodeAtClientPosition]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableElement(event.target)) return;

      const key = event.key.toLowerCase();
      const isCtrlOrMeta = event.ctrlKey || event.metaKey;

      if ((event.key === "Delete" || event.key === "Backspace") && !isCtrlOrMeta) {
        event.preventDefault();
        deleteSelectedElements();
        return;
      }

      if (isCtrlOrMeta && key === "c") {
        event.preventDefault();
        copySelectedElements();
        return;
      }

      if (isCtrlOrMeta && key === "v") {
        event.preventDefault();
        pasteClipboardAtMouse();
        return;
      }

      if (isCtrlOrMeta && key === "z") {
        event.preventDefault();
        undoLastOperation();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    copySelectedElements,
    deleteSelectedElements,
    pasteClipboardAtMouse,
    undoLastOperation
  ]);

  return (
    <div
      ref={wrapperRef}
      className="relative h-full w-full bg-[#141414]"
      onPointerMove={(event) => {
        mouseClientPositionRef.current = {
          x: event.clientX,
          y: event.clientY
        };
      }}
    >
      <style>
        {`
          .react-flow__attribution {
            display: none !important;
          }

          .react-flow__controls {
            overflow: hidden !important;
            border: 1px solid #333 !important;
            border-radius: 10px !important;
            background: #1e1e1e !important;
            box-shadow: 0 12px 30px rgba(0,0,0,0.35) !important;
          }

          .react-flow__controls-button {
            width: 28px !important;
            height: 28px !important;
            border-bottom: 1px solid #333 !important;
            background: #1e1e1e !important;
            color: #9ca3af !important;
          }

          .react-flow__controls-button:hover {
            background: #2a2a2a !important;
          }

          .react-flow__controls-button svg {
            fill: #9ca3af !important;
          }

          .react-flow__handle {
            width: 7px !important;
            height: 7px !important;
            border: 1px solid #111827 !important;
          }

          .react-flow__resize-control.handle {
            opacity: 1 !important;
          }

          .react-flow__resize-control.line {
            opacity: 1 !important;
          }

          .react-flow__minimap {
            border: 1px solid #333 !important;
            border-radius: 14px !important;
            overflow: hidden !important;
            background: #181818 !important;
            box-shadow: 0 16px 40px rgba(0,0,0,0.45) !important;
          }

          .automation-workflow-canvas textarea,
          .automation-workflow-canvas input {
            user-select: text;
          }
        `}
      </style>

      <SystemTimeBadge />

      <ReactFlow<AutomationFlowNode, AutomationFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        deleteKeyCode={null}
        fitView
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
        className="automation-workflow-canvas"
        style={{ background: "#141414" }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color="#333"
        />

        <Controls position="bottom-left" />

        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          maskColor="rgba(0, 0, 0, 0.45)"
          nodeStrokeWidth={2}
          nodeColor={(node) => {
            const automationType = (node.data as AutomationNodeData)?.automationType;

            if (automationType === "collection") return "rgba(168, 85, 247, 0.45)";
            if (automationType === "role") return "rgba(245, 158, 11, 0.85)";
            if (automationType === "tool") return "rgba(59, 130, 246, 0.85)";
            if (automationType === "trigger") return "rgba(16, 185, 129, 0.85)";
            if (automationType === "conversation") return "rgba(34, 211, 238, 0.85)";
            if (automationType === "hardware") return "rgba(148, 163, 184, 0.85)";
            if (automationType === "timer") return "rgba(244, 63, 94, 0.85)";

            return "rgba(156, 163, 175, 0.85)";
          }}
          nodeStrokeColor={(node) => {
            const automationType = (node.data as AutomationNodeData)?.automationType;
            if (automationType === "collection") return "rgba(216, 180, 254, 0.75)";
            return "rgba(255,255,255,0.18)";
          }}
          style={{
            width: 180,
            height: 120,
            right: 18,
            bottom: 18,
            background: "#181818"
          }}
        />
      </ReactFlow>

      <AutomationFloatingToolbar
        roleItems={roleItems}
        onReloadRoles={reloadRoles}
        draggingTemplate={draggingTemplate}
        onTemplatePointerDown={handleTemplatePointerDown}
      />

      <DragGhost template={draggingTemplate} pointerPreview={pointerPreview} />
    </div>
  );
}

export default function AutomationWorkspace({ sessionId }: { sessionId: string }) {
  return (
    <div className="h-full w-full flex-1 overflow-hidden bg-[#141414]">
      <ReactFlowProvider>
        <FlowEditor sessionId={sessionId} />
      </ReactFlowProvider>
    </div>
  );
}