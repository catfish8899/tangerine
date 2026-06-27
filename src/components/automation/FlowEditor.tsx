// src/components/automation/FlowEditor.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  Connection,
  MiniMap,
  useReactFlow
} from "@xyflow/react";
import type { EdgeChange, NodeChange, OnNodeDrag } from "@xyflow/react";
import { Role } from "../../types/chat";
import AutomationFloatingToolbar from "./AutomationToolbar";
import DragGhost from "./DragGhost";
import SystemTimeBadge from "./SystemTimeBadge";
import { nodeTypes } from "./AutomationNodes";
import { MAX_HISTORY_LENGTH } from "./automationConstants";
import {
  applyCollectionStickiness,
  areSnapshotsEqual,
  buildAutomationNode,
  cloneFlowSnapshot,
  generateUniqueEdgeId,
  generateUniqueId,
  getDescendantNodeIds,
  getNodeAbsolutePosition,
  getNodeSize,
  isEditableElement
} from "./automationNodeUtils";
import {
  safeLoadAutomationClipboard,
  safeLoadAutomationFlow,
  safeLoadRoles,
  safeSaveAutomationClipboard,
  safeSaveAutomationFlow
} from "./automationStorage";
import type {
  AutomationClipboard,
  AutomationFlowEdge,
  AutomationFlowNode,
  AutomationFlowSnapshot,
  AutomationNodeData,
  AutomationTemplate,
  FlowPoint,
  PointerPreview
} from "./automationTypes";

export default function FlowEditor({ sessionId }: { sessionId: string }) {
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