// src/components/automation/AutomationNodes.tsx
import React, { useEffect, useMemo, useState } from "react";
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
  PlayCircle,
  UserSquare2
} from "lucide-react";
import type { Role } from "../../types/chat";
import { safeLoadRoles } from "./automationStorage";
import type {
  AutomationFlowEdge,
  AutomationFlowNode,
  AutomationNodeData
} from "./automationTypes";

/**
 * 兼容读取角色提示词。
 * 当前项目 Role 类型中不一定叫 prompt，因此这里优先读取 systemPrompt，
 * 同时兼容历史数据或其他分支里可能出现的 prompt / description 字段。
 */
function getRolePromptText(role: Role): string {
  const roleRecord = role as unknown as {
    systemPrompt?: unknown;
    prompt?: unknown;
    description?: unknown;
  };

  const value =
    roleRecord.systemPrompt ??
    roleRecord.prompt ??
    roleRecord.description ??
    "";

  return typeof value === "string" ? value : String(value || "");
}

/**
 * 数字补零。
 */
function pad2(value: number | string) {
  return String(value).padStart(2, "0");
}

/**
 * 将日期格式化为中文日期。
 */
function formatChineseDate(date: Date) {
  return `${date.getFullYear()}年${pad2(date.getMonth() + 1)}月${pad2(
    date.getDate()
  )}日`;
}

/**
 * 构建日期下拉选项。
 * 默认提供今天起未来 365 天，避免定时节点使用自由输入。
 */
function buildDateOptions(days = 365) {
  const today = new Date();
  const options: Array<{
    value: string;
    label: string;
  }> = [];

  for (let index = 0; index <= days; index += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + index);

    const value = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
      date.getDate()
    )}`;

    let label = formatChineseDate(date);
    if (index === 0) label = `今天 · ${label}`;
    if (index === 1) label = `明天 · ${label}`;

    options.push({
      value,
      label
    });
  }

  return options;
}

/**
 * 将日期 value 转为中文日期。
 */
function dateValueToChineseDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return formatChineseDate(new Date());
  return `${year}年${month}月${day}日`;
}

/**
 * 获取定时节点的默认时间选择值。
 */
function getDefaultTimerParts() {
  const now = new Date();
  const hour24 = now.getHours();
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  return {
    dateValue: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(
      now.getDate()
    )}`,
    period,
    hour12: String(hour12),
    minute: pad2(now.getMinutes()),
    second: pad2(now.getSeconds())
  };
}

/**
 * 根据定时节点的结构化字段生成最终展示/持久化文本。
 */
function buildTimerText(parts: {
  dateValue: string;
  period: string;
  hour12: string;
  minute: string;
  second: string;
}) {
  const periodText = parts.period === "PM" ? "下午" : "上午";

  return `${dateValueToChineseDate(parts.dateValue)} ${periodText} ${Number(
    parts.hour12 || 1
  )}:${pad2(parts.minute || 0)}:${pad2(parts.second || 0)}`;
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

function NodeSelect({
  value,
  options,
  accentClass,
  onChange,
  onBeforeOpen,
  disabled = false
}: {
  value: string;
  options: Array<{
    value: string;
    label: string;
  }>;
  accentClass: string;
  onChange: (value: string) => void;
  onBeforeOpen?: () => void;
  disabled?: boolean;
}) {
  /**
   * 下拉选单展开前刷新选项。
   * 使用 pointer/mouse/focus 多事件兜底，兼容 Tauri WebView 中不同触发路径。
   */
  const handleBeforeOpen = () => {
    if (disabled) return;
    onBeforeOpen?.();
  };

  return (
    <select
      className={`nodrag mt-2 w-full rounded-lg border bg-black/25 px-2 py-1.5 text-[11px] outline-none ${accentClass} ${
        disabled ? "cursor-not-allowed opacity-60" : ""
      }`}
      value={value}
      onPointerDown={handleBeforeOpen}
      onMouseDown={handleBeforeOpen}
      onFocus={handleBeforeOpen}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
    >
      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
          className="bg-[#1f1f1f] text-gray-100"
        >
          {option.label}
        </option>
      ))}
    </select>
  );
}

function RoleWorkflowNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow<AutomationFlowNode, AutomationFlowEdge>();
  const [roles, setRoles] = useState<Role[]>([]);

  const selectedRoleId = String(data.payload?.roleId || "");

  const reloadRoles = () => {
    setRoles(safeLoadRoles());
  };

  useEffect(() => {
    reloadRoles();

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === "tangerine_roles") {
        reloadRoles();
      }
    };

    const handleWindowFocus = () => {
      reloadRoles();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        reloadRoles();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const roleOptions = useMemo(
    () => [
      {
        value: "",
        label: roles.length > 0 ? "请选择角色" : "暂无角色"
      },
      ...roles.map((role) => ({
        value: role.id,
        label: role.name
      }))
    ],
    [roles]
  );

  const updateRole = (roleId: string) => {
    const latestRoles = safeLoadRoles();
    const matchedRole = latestRoles.find((role) => role.id === roleId);
    const matchedRolePrompt = matchedRole ? getRolePromptText(matchedRole) : "";

    setRoles(latestRoles);

    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== id) return node;

        if (!matchedRole) {
          return {
            ...node,
            data: {
              ...node.data,
              title: "角色",
              subtitle: "请选择角色",
              description: "在节点内部下拉选单中选择具体角色。",
              payload: {
                ...(node.data.payload || {}),
                roleId: "",
                roleName: "",
                systemPrompt: ""
              }
            }
          };
        }

        return {
          ...node,
          data: {
            ...node.data,
            title: matchedRole.name,
            subtitle: "角色节点",
            description: matchedRolePrompt,
            payload: {
              ...(node.data.payload || {}),
              roleId: matchedRole.id,
              roleName: matchedRole.name,
              systemPrompt: matchedRolePrompt
            }
          }
        };
      })
    );
  };

  return (
    <WorkflowNodeShell
      data={data}
      selected={selected}
      accent="amber"
      icon={<UserSquare2 size={17} />}
    >
      <NodeSelect
        value={selectedRoleId}
        options={roleOptions}
        accentClass="border-amber-400/20 text-amber-50 focus:border-amber-300/50"
        onChange={updateRole}
        onBeforeOpen={reloadRoles}
        disabled={roles.length === 0}
      />
    </WorkflowNodeShell>
  );
}

function ToolWorkflowNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow<AutomationFlowNode, AutomationFlowEdge>();
  const toolType = String(data.payload?.toolType || "web_search");

  const toolOptions = [
    {
      value: "web_search",
      label: "联网搜索"
    }
  ];

  const updateTool = (value: string) => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== id) return node;

        return {
          ...node,
          data: {
            ...node.data,
            title: "联网搜索",
            subtitle: "工具节点",
            description: undefined,
            payload: {
              ...(node.data.payload || {}),
              toolType: value,
              toolName: "Tavily / Web Search",
              webSearchMode: "direct"
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
        title: data.title || "工具",
        subtitle: data.subtitle || "请选择工具",
        description: data.description
      }}
      selected={selected}
      accent="blue"
      icon={<Globe2 size={17} />}
    >
      <NodeSelect
        value={toolType}
        options={toolOptions}
        accentClass="border-blue-400/20 text-blue-50 focus:border-blue-300/50"
        onChange={updateTool}
      />

      <div className="mt-2 truncate rounded-lg border border-blue-500/20 bg-black/15 px-2 py-1 text-[10px] text-blue-200/80">
        工具名称：{String(data.payload?.toolName || "Tavily / Web Search")}
      </div>
    </WorkflowNodeShell>
  );
}

function TriggerWorkflowNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow<AutomationFlowNode, AutomationFlowEdge>();
  const triggerType = String(data.payload?.triggerType || "start_chat");

  const triggerOptions = [
    {
      value: "start_chat",
      label: "开始对话"
    }
  ];

  const updateTrigger = (value: string) => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== id) return node;

        return {
          ...node,
          data: {
            ...node.data,
            title: "开始对话",
            subtitle: "入口节点",
            payload: {
              ...(node.data.payload || {}),
              triggerType: value
            }
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
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-[#111827] !bg-slate-300"
      />

      <div className="flex items-center gap-2 text-xs font-bold">
        <PlayCircle size={16} className="text-emerald-300" />
        <span>{data.title || "开关"}</span>
      </div>

      {data.subtitle && (
        <div className="mt-0.5 text-[10px] text-emerald-100/45">
          {data.subtitle}
        </div>
      )}

      <NodeSelect
        value={triggerType}
        options={triggerOptions}
        accentClass="border-emerald-400/20 text-emerald-50 focus:border-emerald-300/50"
        onChange={updateTrigger}
      />

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-[#111827] !bg-emerald-400"
      />
    </div>
  );
}

function CollectionWorkflowNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow<AutomationFlowNode, AutomationFlowEdge>();
  const collectionType = String(data.payload?.collectionType || "area");

  const collectionOptions = [
    {
      value: "area",
      label: "集合区域"
    }
  ];

  const updateCollection = (value: string) => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== id) return node;

        return {
          ...node,
          data: {
            ...node.data,
            title: "集合区域",
            subtitle: "可调大小的范围框",
            payload: {
              ...(node.data.payload || {}),
              collectionType: value
            }
          }
        };
      })
    );
  };

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

      <div className="absolute left-3 top-3 w-[170px] rounded-lg border border-purple-400/20 bg-[#141414]/75 px-2.5 py-2 text-[10px] font-semibold text-purple-200 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-2">
          <BoxSelect size={12} />
          <span>{data.title || "集合"}</span>
        </div>

        <NodeSelect
          value={collectionType}
          options={collectionOptions}
          accentClass="border-purple-400/20 text-purple-50 focus:border-purple-300/50"
          onChange={updateCollection}
        />
      </div>
    </div>
  );
}

function ConversationWorkflowNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow<AutomationFlowNode, AutomationFlowEdge>();
  const conversationType = String(data.payload?.conversationType || "text_input");
  const content = String(data.payload?.content || "");

  const conversationOptions = [
    {
      value: "text_input",
      label: "文本对话"
    }
  ];

  const updateConversationType = (value: string) => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== id) return node;

        return {
          ...node,
          data: {
            ...node.data,
            title: "对话",
            subtitle: "文本对话节点",
            payload: {
              ...(node.data.payload || {}),
              conversationType: value
            }
          }
        };
      })
    );
  };

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
        title: data.title || "对话",
        subtitle: data.subtitle || "请选择对话类型",
        description: data.description
      }}
      selected={selected}
      accent="cyan"
      icon={<MessageCircle size={17} />}
    >
      <NodeSelect
        value={conversationType}
        options={conversationOptions}
        accentClass="border-cyan-400/20 text-cyan-50 focus:border-cyan-300/50"
        onChange={updateConversationType}
      />

      <textarea
        className="nodrag mt-2 h-20 w-full resize-none rounded-lg border border-cyan-400/20 bg-black/25 px-2 py-1.5 text-[11px] leading-relaxed text-cyan-50 outline-none placeholder:text-cyan-200/35 focus:border-cyan-300/50"
        placeholder="请输入对话内容..."
        value={content}
        onChange={(event) => updateContent(event.target.value)}
      />
    </WorkflowNodeShell>
  );
}

function HardwareWorkflowNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow<AutomationFlowNode, AutomationFlowEdge>();
  const hardwareAction = String(data.payload?.hardwareAction || "connect_hardware");

  const hardwareOptions = [
    {
      value: "connect_hardware",
      label: "连接硬件"
    }
  ];

  const updateHardwareAction = (value: string) => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== id) return node;

        return {
          ...node,
          data: {
            ...node.data,
            title: "硬件",
            subtitle: "硬件节点",
            payload: {
              ...(node.data.payload || {}),
              hardwareAction: value
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
        title: data.title || "硬件",
        subtitle: data.subtitle || "请选择硬件动作",
        description: data.description
      }}
      selected={selected}
      accent="slate"
      icon={<Cpu size={17} />}
    >
      <NodeSelect
        value={hardwareAction}
        options={hardwareOptions}
        accentClass="border-slate-400/20 text-slate-50 focus:border-slate-300/50"
        onChange={updateHardwareAction}
      />

      <div className="mt-2 rounded-lg border border-slate-400/20 bg-black/20 px-2 py-1.5 text-[11px] font-semibold text-slate-200">
        连接硬件
      </div>
    </WorkflowNodeShell>
  );
}

function TimerWorkflowNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow<AutomationFlowNode, AutomationFlowEdge>();
  const defaults = getDefaultTimerParts();

  const [dateOptions, setDateOptions] = useState(() => buildDateOptions());

  const timerType = String(data.payload?.timerType || "specific_datetime");
  const dateValue = String(data.payload?.dateValue || defaults.dateValue);
  const period = String(data.payload?.period || defaults.period);
  const hour12 = String(data.payload?.hour12 || defaults.hour12);
  const minute = String(data.payload?.minute || defaults.minute);
  const second = String(data.payload?.second || defaults.second);

  const timerOptions = [
    {
      value: "specific_datetime",
      label: "指定日期时间"
    }
  ];

  const periodOptions = [
    {
      value: "AM",
      label: "上午"
    },
    {
      value: "PM",
      label: "下午"
    }
  ];

  const hourOptions = Array.from({ length: 12 }, (_, index) => {
    const value = String(index + 1);
    return {
      value,
      label: `${value} 时`
    };
  });

  const minuteOptions = Array.from({ length: 60 }, (_, index) => {
    const value = pad2(index);
    return {
      value,
      label: `${value} 分`
    };
  });

  const secondOptions = Array.from({ length: 60 }, (_, index) => {
    const value = pad2(index);
    return {
      value,
      label: `${value} 秒`
    };
  });

  const refreshDateOptions = () => {
    setDateOptions(buildDateOptions());
  };

  const updateTimerPayload = (
    patch: Partial<{
      timerType: string;
      dateValue: string;
      period: string;
      hour12: string;
      minute: string;
      second: string;
    }>
  ) => {
    const nextParts = {
      dateValue,
      period,
      hour12,
      minute,
      second,
      ...patch
    };

    const nextTimerText = buildTimerText(nextParts);

    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== id) return node;

        return {
          ...node,
          data: {
            ...node.data,
            title: "定时",
            subtitle: "指定日期时间",
            payload: {
              ...(node.data.payload || {}),
              timerType: nextParts.timerType || timerType,
              dateValue: nextParts.dateValue,
              period: nextParts.period,
              hour12: nextParts.hour12,
              minute: nextParts.minute,
              second: nextParts.second,
              timerText: nextTimerText
            }
          }
        };
      })
    );
  };

  const currentTimerText = buildTimerText({
    dateValue,
    period,
    hour12,
    minute,
    second
  });

  return (
    <WorkflowNodeShell
      data={{
        ...data,
        title: data.title || "定时",
        subtitle: data.subtitle || "请选择定时类型",
        description: data.description
      }}
      selected={selected}
      accent="rose"
      icon={<Clock3 size={17} />}
    >
      <NodeSelect
        value={timerType}
        options={timerOptions}
        accentClass="border-rose-400/20 text-rose-50 focus:border-rose-300/50"
        onChange={(value) => updateTimerPayload({ timerType: value })}
      />

      <NodeSelect
        value={dateValue}
        options={dateOptions}
        accentClass="border-rose-400/20 text-rose-50 focus:border-rose-300/50"
        onChange={(value) => updateTimerPayload({ dateValue: value })}
        onBeforeOpen={refreshDateOptions}
      />

      <div className="nodrag mt-2 grid grid-cols-2 gap-1.5">
        <NodeSelect
          value={period}
          options={periodOptions}
          accentClass="border-rose-400/20 text-rose-50 focus:border-rose-300/50"
          onChange={(value) => updateTimerPayload({ period: value })}
        />

        <NodeSelect
          value={hour12}
          options={hourOptions}
          accentClass="border-rose-400/20 text-rose-50 focus:border-rose-300/50"
          onChange={(value) => updateTimerPayload({ hour12: value })}
        />
      </div>

      <div className="nodrag mt-1.5 grid grid-cols-2 gap-1.5">
        <NodeSelect
          value={minute}
          options={minuteOptions}
          accentClass="border-rose-400/20 text-rose-50 focus:border-rose-300/50"
          onChange={(value) => updateTimerPayload({ minute: value })}
        />

        <NodeSelect
          value={second}
          options={secondOptions}
          accentClass="border-rose-400/20 text-rose-50 focus:border-rose-300/50"
          onChange={(value) => updateTimerPayload({ second: value })}
        />
      </div>

      <div className="mt-2 rounded-lg border border-rose-400/15 bg-black/20 px-2 py-1.5 text-[10px] leading-relaxed text-rose-100/75">
        已选择：{String(data.payload?.timerText || currentTimerText)}
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