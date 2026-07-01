import { useCallback, useEffect, useRef } from "react";
import { useNodesState, useEdgesState } from "@xyflow/react";
import type { EdgeChange, NodeChange, OnNodeDrag } from "@xyflow/react";
import { MAX_HISTORY_LENGTH } from "../automationConstants";
import {
  applyCollectionStickiness,
  areSnapshotsEqual,
  cloneFlowSnapshot
} from "../automationNodeUtils";
import type {
  AutomationFlowEdge,
  AutomationFlowNode,
  AutomationFlowSnapshot
} from "../automationTypes";

/**
 * 管理工作流的历史记录、撤销重做、以及节点拖拽/缩放时的快照记录
 */
export function useFlowHistory(hydratedRef: React.MutableRefObject<boolean>) {
  const [nodes, setNodes, rawOnNodesChange] = useNodesState<AutomationFlowNode>([]);
  const [edges, setEdges, rawOnEdgesChange] = useEdgesState<AutomationFlowEdge>([]);

  const historyRef = useRef<AutomationFlowSnapshot[]>([]);
  const dragStartSnapshotRef = useRef<AutomationFlowSnapshot | null>(null);
  const resizeHistoryTimerRef = useRef<number | null>(null);
  const resizeHistoryArmedRef = useRef(false);
  const flowStateRef = useRef<AutomationFlowSnapshot>({ nodes: [], edges: [] });

  // 保持 flowStateRef 与最新状态同步
  useEffect(() => {
    flowStateRef.current = { nodes, edges };
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
    [pushCurrentHistorySnapshot, rawOnNodesChange, hydratedRef]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<AutomationFlowEdge>[]) => {
      rawOnEdgesChange(changes);
    },
    [rawOnEdgesChange]
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

  const undoLastOperation = useCallback(() => {
    const previousSnapshot = historyRef.current[historyRef.current.length - 1];
    if (!previousSnapshot) return;

    historyRef.current = historyRef.current.slice(0, -1);

    const clonedSnapshot = cloneFlowSnapshot(previousSnapshot);
    setNodes(clonedSnapshot.nodes);
    setEdges(clonedSnapshot.edges);
  }, [setEdges, setNodes]);

  return {
    nodes,
    setNodes,
    edges,
    setEdges,
    flowStateRef,
    historyRef,
    dragStartSnapshotRef,
    resizeHistoryArmedRef,
    onNodesChange,
    onEdgesChange,
    handleNodeDragStart,
    handleNodeDragStop,
    pushCurrentHistorySnapshot,
    undoLastOperation
  };
}