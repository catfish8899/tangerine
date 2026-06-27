// src/components/automation/AutomationToolbar.tsx
import React, { useMemo } from "react";
import {
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

function DraggableCategoryButton({
  template,
  draggingTemplate,
  onPointerDown
}: {
  template: AutomationTemplate;
  draggingTemplate: AutomationTemplate | null;
  onPointerDown: (event: React.PointerEvent, template: AutomationTemplate) => void;
}) {
  const isDragging = draggingTemplate?.id === template.id;

  return (
    <button
      type="button"
      onPointerDown={(event) => onPointerDown(event, template)}
      className={`group flex flex-col items-center gap-1 rounded-xl p-2 transition-colors ${
        isDragging ? "cursor-grabbing bg-white/10" : "cursor-grab hover:bg-white/10"
      }`}
      title={`拖拽“${template.title}”节点到画布`}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-transform group-hover:scale-110 ${template.colorClass}`}
      >
        <TemplateIcon icon={template.icon} size={18} />
      </div>

      <span className="text-[10px] font-medium text-gray-400">
        {template.title}
      </span>
    </button>
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
  /**
   * 说明：
   * 现在底部栏不再展开“细分节点菜单”。
   * 用户直接把类目节点拖入画布，然后在节点内部的下拉选单中选择具体细分项。
   *
   * roleItems / onReloadRoles 仍保留在 props 中，是为了不破坏 FlowEditor 现有调用结构。
   * 角色具体列表改为由角色节点内部读取 localStorage 并展示下拉选单。
   */
  void roleItems;
  void onReloadRoles;

  const categoryTemplates: AutomationTemplate[] = useMemo(
    () => [
      {
        id: "category-role",
        nodeKind: "role",
        title: "角色",
        subtitle: "拖入后选择角色",
        description: "拖入画布后，可在节点内部选择具体角色。",
        icon: "role",
        colorClass: "bg-amber-500/20 border-amber-500/40 text-amber-400",
        payload: {
          roleId: "",
          roleName: "",
          systemPrompt: ""
        }
      },
      {
        id: "category-tool",
        nodeKind: "tool",
        title: "工具",
        subtitle: "拖入后选择工具",
        description: "拖入画布后，可在节点内部选择具体工具。",
        icon: "tool",
        colorClass: "bg-blue-500/20 border-blue-500/40 text-blue-400",
        payload: {
          toolType: "web_search",
          toolName: "Tavily / Web Search",
          webSearchMode: "direct"
        }
      },
      {
        id: "category-trigger",
        nodeKind: "trigger",
        title: "开关",
        subtitle: "拖入后选择入口",
        description: "拖入画布后，可在节点内部选择具体入口或开关类型。",
        icon: "trigger",
        colorClass: "bg-emerald-500/20 border-emerald-500/40 text-emerald-400",
        payload: {
          triggerType: "start_chat"
        }
      },
      {
        id: "category-collection",
        nodeKind: "collection",
        title: "集合",
        subtitle: "拖入后选择集合类型",
        description: "拖入画布后，可在节点内部选择具体集合类型。",
        icon: "collection",
        colorClass: "bg-purple-500/20 border-purple-500/40 text-purple-400",
        payload: {
          collectionType: "area"
        }
      },
      {
        id: "category-conversation",
        nodeKind: "conversation",
        title: "对话",
        subtitle: "拖入后选择对话类型",
        description: "拖入画布后，可在节点内部选择具体对话节点类型。",
        icon: "conversation",
        colorClass: "bg-cyan-500/20 border-cyan-500/40 text-cyan-300",
        payload: {
          conversationType: "text_input",
          content: ""
        }
      },
      {
        id: "category-hardware",
        nodeKind: "hardware",
        title: "硬件",
        subtitle: "拖入后选择硬件动作",
        description: "拖入画布后，可在节点内部选择具体硬件动作。",
        icon: "hardware",
        colorClass: "bg-slate-500/20 border-slate-400/40 text-slate-300",
        payload: {
          hardwareAction: "connect_hardware"
        }
      },
      {
        id: "category-timer",
        nodeKind: "timer",
        title: "定时",
        subtitle: "拖入后选择定时类型",
        description: "拖入画布后，可在节点内部选择具体定时类型。",
        icon: "timer",
        colorClass: "bg-rose-500/20 border-rose-500/40 text-rose-300",
        payload: {
          timerType: "specific_datetime",
          timerText: ""
        }
      }
    ],
    []
  );

  return (
    <div className="absolute bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-[#333] bg-[#1f1f1f]/90 px-5 py-3 shadow-2xl backdrop-blur-xl">
      {categoryTemplates.map((template) => (
        <DraggableCategoryButton
          key={template.id}
          template={template}
          draggingTemplate={draggingTemplate}
          onPointerDown={onTemplatePointerDown}
        />
      ))}
    </div>
  );
}