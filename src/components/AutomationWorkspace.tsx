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
  useReactFlow
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  UserSquare2,
  Wrench,
  PlayCircle,
  Layers,
  Globe2,
  MessageCircle,
  BoxSelect,
  ChevronUp
} from "lucide-react";
import { Role } from "../types/chat";

const ROLES_STORAGE_KEY = "tangerine_roles";

type AutomationNodeKind = "role" | "tool" | "trigger" | "collection";

interface AutomationTemplate {
  id: string;
  nodeKind: AutomationNodeKind;
  title: string;
  subtitle?: string;
  description?: string;
  icon: "role" | "tool" | "trigger" | "collection" | "web";
  colorClass: string;
  payload?: Record<string, unknown>;
  disabled?: boolean;
}

// React Flow 新版要求 Node<TData> 中的 TData 满足 Record<string, unknown>
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

const generateUniqueId = () =>
  `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

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
  return <Globe2 size={size} />;
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
  accent: "amber" | "blue" | "emerald";
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
      data={data}
      selected={selected}
      accent="blue"
      icon={<Globe2 size={17} />}
    >
      <div className="mt-2 rounded-lg border border-blue-500/20 bg-black/15 px-2 py-1 text-[10px] text-blue-200/80">
        工具类型：{String(data.payload?.toolType || "未配置")}
      </div>
    </WorkflowNodeShell>
  );
}

function TriggerWorkflowNode({ data, selected }: any) {
  return (
    <WorkflowNodeShell
      data={data}
      selected={selected}
      accent="emerald"
      icon={<MessageCircle size={17} />}
    >
      <div className="mt-2 rounded-lg border border-emerald-500/20 bg-black/15 px-2 py-1 text-[10px] text-emerald-200/80">
        触发后进入对话流程
      </div>
    </WorkflowNodeShell>
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

const nodeTypes = {
  automationRoleNode: RoleWorkflowNode,
  automationToolNode: ToolWorkflowNode,
  automationTriggerNode: TriggerWorkflowNode,
  automationCollectionNode: CollectionWorkflowNode
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
        title: template.title,
        subtitle: template.subtitle || "工具节点",
        description: template.description,
        automationType: "tool",
        payload: template.payload
      }
    };
  }

  if (template.nodeKind === "trigger") {
    return {
      id: generateUniqueId(),
      type: "automationTriggerNode",
      position,
      data: {
        title: template.title,
        subtitle: template.subtitle || "开关节点",
        description: template.description,
        automationType: "trigger",
        payload: template.payload
      }
    };
  }

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
    // 鼠标离开后延迟关闭，避免从按钮移动到上拉菜单时被中途空隙误关
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
          {/* 透明连接桥：填补按钮和上拉菜单之间的 mb-3 空白，防止菜单闪退 */}
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
        subtitle: "工作流入口开关",
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

  return (
    <div className="absolute bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-2xl border border-[#333] bg-[#1f1f1f]/90 px-6 py-3 shadow-2xl backdrop-blur-xl">
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

function FlowEditor() {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<AutomationFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<AutomationFlowEdge>([]);

  const [roles, setRoles] = useState<Role[]>(() => safeLoadRoles());
  const [draggingTemplate, setDraggingTemplate] = useState<AutomationTemplate | null>(null);
  const [pointerPreview, setPointerPreview] = useState<PointerPreview | null>(null);

  const { screenToFlowPosition } = useReactFlow();

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

  const onConnect = useCallback(
    (params: Connection) => {
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
    [setEdges]
  );

  const createNodeAtClientPosition = useCallback(
    (clientX: number, clientY: number, template: AutomationTemplate) => {
      const wrapper = wrapperRef.current;
      if (!wrapper || template.disabled) return;

      const rect = wrapper.getBoundingClientRect();

      // 只允许释放在画布区域内时创建节点
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

      // 集合节点放到更底层，保证视觉像“区域底板”
      setNodes((nds) => {
        if (newNode.type === "automationCollectionNode") {
          return [newNode, ...nds];
        }
        return nds.concat(newNode);
      });
    },
    [screenToFlowPosition, setNodes]
  );

  const handleTemplatePointerDown = useCallback(
    (event: React.PointerEvent, template: AutomationTemplate) => {
      if (event.button !== 0 || template.disabled) return;

      // 阻止画布平移/选择接管工具栏的拖拽起点
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

  return (
    <div ref={wrapperRef} className="relative h-full w-full bg-[#141414]">
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
        `}
      </style>

      <ReactFlow<AutomationFlowNode, AutomationFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
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

export default function AutomationWorkspace() {
  return (
    <div className="h-full w-full flex-1 overflow-hidden bg-[#141414]">
      <ReactFlowProvider>
        <FlowEditor />
      </ReactFlowProvider>
    </div>
  );
}
