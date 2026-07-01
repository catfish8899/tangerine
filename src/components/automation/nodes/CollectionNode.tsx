// src/components/automation/nodes/CollectionNode.tsx
import React from "react";
import { NodeResizer, useReactFlow } from "@xyflow/react";
import { BoxSelect } from "lucide-react";
import type { AutomationFlowEdge, AutomationFlowNode } from "../automationTypes";
import { NodeSelect } from "./NodeSelect";

export function CollectionNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow<AutomationFlowNode, AutomationFlowEdge>();
  const collectionType = String(data.payload?.collectionType || "area");
  const collectionOptions = [{ value: "area", label: "集合区域" }];

  const updateCollection = (value: string) => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== id) return node;
        return {
          ...node,
          data: {
            ...node.data, title: "集合区域", subtitle: "可调大小的范围框",
            payload: { ...(node.data.payload || {}), collectionType: value }
          }
        };
      })
    );
  };

  return (
    <div className="relative h-full w-full rounded-2xl border border-dashed border-purple-400/45 bg-purple-500/[0.045] backdrop-blur-[1px]">
      <NodeResizer
        isVisible={selected} minWidth={220} minHeight={140}
        lineStyle={{ borderColor: "rgba(168, 85, 247, 0.65)" }}
        handleStyle={{ width: 8, height: 8, borderRadius: 999, background: "rgba(168, 85, 247, 0.95)", border: "1px solid rgba(20,20,20,0.9)" }}
      />
      <div className="absolute left-3 top-3 w-[170px] rounded-lg border border-purple-400/20 bg-[#141414]/75 px-2.5 py-2 text-[10px] font-semibold text-purple-200 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-2">
          <BoxSelect size={12} />
          <span>{data.title || "集合"}</span>
        </div>
        <NodeSelect value={collectionType} options={collectionOptions} accentClass="border-purple-400/20 text-purple-50 focus:border-purple-300/50" onChange={updateCollection} />
      </div>
    </div>
  );
}