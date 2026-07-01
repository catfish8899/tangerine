// src/components/automation/nodes/TimerNode.tsx
import React, { useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { Clock3 } from "lucide-react";
import type { AutomationFlowEdge, AutomationFlowNode } from "../automationTypes";
import { WorkflowNodeShell } from "./WorkflowNodeShell";
import { NodeSelect } from "./NodeSelect";
import { buildDateOptions, getDefaultTimerParts, buildTimerText, pad2 } from "./nodeFormatters";

export function TimerNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow<AutomationFlowNode, AutomationFlowEdge>();
  const defaults = getDefaultTimerParts();
  const [dateOptions, setDateOptions] = useState(() => buildDateOptions());

  const timerType = String(data.payload?.timerType || "specific_datetime");
  const dateValue = String(data.payload?.dateValue || defaults.dateValue);
  const period = String(data.payload?.period || defaults.period);
  const hour12 = String(data.payload?.hour12 || defaults.hour12);
  const minute = String(data.payload?.minute || defaults.minute);
  const second = String(data.payload?.second || defaults.second);

  const timerOptions = [{ value: "specific_datetime", label: "指定日期时间" }];
  const periodOptions = [{ value: "AM", label: "上午" }, { value: "PM", label: "下午" }];
  const hourOptions = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} 时` }));
  const minuteOptions = Array.from({ length: 60 }, (_, i) => ({ value: pad2(i), label: `${pad2(i)} 分` }));
  const secondOptions = Array.from({ length: 60 }, (_, i) => ({ value: pad2(i), label: `${pad2(i)} 秒` }));

  const refreshDateOptions = () => setDateOptions(buildDateOptions());

  const updateTimerPayload = (patch: Partial<{ timerType: string; dateValue: string; period: string; hour12: string; minute: string; second: string }>) => {
    const nextParts = { dateValue, period, hour12, minute, second, ...patch };
    const nextTimerText = buildTimerText(nextParts);

    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== id) return node;
        return {
          ...node,
          data: {
            ...node.data, title: "定时", subtitle: "指定日期时间",
            payload: {
              ...(node.data.payload || {}), timerType: nextParts.timerType || timerType,
              dateValue: nextParts.dateValue, period: nextParts.period, hour12: nextParts.hour12,
              minute: nextParts.minute, second: nextParts.second, timerText: nextTimerText
            }
          }
        };
      })
    );
  };

  const currentTimerText = buildTimerText({ dateValue, period, hour12, minute, second });

  return (
    <WorkflowNodeShell
      data={{ ...data, title: data.title || "定时", subtitle: data.subtitle || "请选择定时类型", description: data.description }}
      selected={selected} accent="rose" icon={<Clock3 size={17} />}
    >
      <NodeSelect value={timerType} options={timerOptions} accentClass="border-rose-400/20 text-rose-50 focus:border-rose-300/50" onChange={(v) => updateTimerPayload({ timerType: v })} />
      <NodeSelect value={dateValue} options={dateOptions} accentClass="border-rose-400/20 text-rose-50 focus:border-rose-300/50" onChange={(v) => updateTimerPayload({ dateValue: v })} onBeforeOpen={refreshDateOptions} />
      
      <div className="nodrag mt-2 grid grid-cols-2 gap-1.5">
        <NodeSelect value={period} options={periodOptions} accentClass="border-rose-400/20 text-rose-50 focus:border-rose-300/50" onChange={(v) => updateTimerPayload({ period: v })} />
        <NodeSelect value={hour12} options={hourOptions} accentClass="border-rose-400/20 text-rose-50 focus:border-rose-300/50" onChange={(v) => updateTimerPayload({ hour12: v })} />
      </div>
      <div className="nodrag mt-1.5 grid grid-cols-2 gap-1.5">
        <NodeSelect value={minute} options={minuteOptions} accentClass="border-rose-400/20 text-rose-50 focus:border-rose-300/50" onChange={(v) => updateTimerPayload({ minute: v })} />
        <NodeSelect value={second} options={secondOptions} accentClass="border-rose-400/20 text-rose-50 focus:border-rose-300/50" onChange={(v) => updateTimerPayload({ second: v })} />
      </div>

      <div className="mt-2 rounded-lg border border-rose-400/15 bg-black/20 px-2 py-1.5 text-[10px] leading-relaxed text-rose-100/75">
        已选择：{String(data.payload?.timerText || currentTimerText)}
      </div>
    </WorkflowNodeShell>
  );
}