import React, { useCallback, useRef } from "react";
import {
  ReactFlow,
  addEdge,
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  MiniMap,
  useReactFlow
} from "@xyflow/react";
import AutomationFloatingToolbar from "./AutomationToolbar";
import DragGhost from "./DragGhost";
import SystemTimeBadge from "./SystemTimeBadge";
import { nodeTypes } from "./AutomationNodes";
import type { AutomationFlowEdge, AutomationFlowNode, AutomationNodeData, FlowPoint } from "./automationTypes";

// 引入解耦后的自定义 Hooks
import { useFlowHistory } from "./hooks/useFlowHistory";
import { useFlowPersistence } from "./hooks/useFlowPersistence";
import { useFlowRoles } from "./hooks/useFlowRoles";
import { useFlowTemplateDrag } from "./hooks/useFlowTemplateDrag";
import { useFlowClipboard } from "./hooks/useFlowClipboard";
import { useFlowShortcuts } from "./hooks/useFlowShortcuts";

export default function FlowEditor({ sessionId }: { sessionId: string }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hydratedRef = useRef(false);
  const mouseClientPositionRef = useRef<FlowPoint | null>(null);

  const { screenToFlowPosition } = useReactFlow();

  // 1. 核心状态与历史记录
  const {
    nodes, setNodes, edges, setEdges, flowStateRef,
    historyRef, dragStartSnapshotRef, resizeHistoryArmedRef,
    onNodesChange, onEdgesChange, handleNodeDragStart, handleNodeDragStop,
    pushCurrentHistorySnapshot, undoLastOperation
  } = useFlowHistory(hydratedRef);

  // 2. 本地持久化
  useFlowPersistence(
    sessionId, nodes, edges, setNodes, setEdges,
    hydratedRef, historyRef, dragStartSnapshotRef, resizeHistoryArmedRef
  );

  // 3. 角色与模板数据
  const { roleItems, reloadRoles } = useFlowRoles();

  // 4. 模板拖拽创建
  const { draggingTemplate, pointerPreview, handleTemplatePointerDown } = useFlowTemplateDrag(
    wrapperRef, pushCurrentHistorySnapshot, setNodes
  );

  // 计算当前鼠标在画布中的流坐标（供粘贴功能使用）
  const getCurrentMouseFlowPosition = useCallback((): FlowPoint => {
    const pointer = mouseClientPositionRef.current;
    const wrapper = wrapperRef.current;

    if (pointer) {
      return screenToFlowPosition({ x: pointer.x, y: pointer.y });
    }

    if (wrapper) {
      const rect = wrapper.getBoundingClientRect();
      return screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      });
    }

    return { x: 0, y: 0 };
  }, [screenToFlowPosition]);

  // 5. 剪贴板操作
  const { copySelectedElements, pasteClipboardAtMouse, deleteSelectedElements } = useFlowClipboard(
    flowStateRef, setNodes, setEdges, pushCurrentHistorySnapshot, getCurrentMouseFlowPosition
  );

  // 6. 全局快捷键
  useFlowShortcuts(copySelectedElements, pasteClipboardAtMouse, deleteSelectedElements, undoLastOperation);

  // 节点连线处理
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