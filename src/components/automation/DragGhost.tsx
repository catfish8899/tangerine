// src/components/automation/DragGhost.tsx
import React from "react";
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
import type { AutomationTemplate, PointerPreview } from "./automationTypes";

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

export default function DragGhost({
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