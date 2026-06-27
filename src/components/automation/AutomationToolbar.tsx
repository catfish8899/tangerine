// src/components/automation/AutomationToolbar.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronUp,
  Clock3,
  Cpu,
  Globe2,
  Layers,
  MessageCircle,
  PlayCircle,
  UserSquare2,
  Wrench
} from "lucide-react";
import type { AutomationTemplate } from "./automationTypes";

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

export default function AutomationFloatingToolbar({
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