import { useCallback } from "react";
import {
  generateUniqueEdgeId,
  generateUniqueId,
  getDescendantNodeIds,
  getNodeAbsolutePosition,
  getNodeSize
} from "../automationNodeUtils";
import {
  safeLoadAutomationClipboard,
  safeSaveAutomationClipboard
} from "../automationStorage";
import type {
  AutomationClipboard,
  AutomationFlowEdge,
  AutomationFlowNode,
  AutomationFlowSnapshot,
  FlowPoint
} from "../automationTypes";

/**
 * 管理画布元素的复制、粘贴（包含集合子孙节点处理）以及删除逻辑
 */
export function useFlowClipboard(
  flowStateRef: React.MutableRefObject<AutomationFlowSnapshot>,
  setNodes: (nodes: AutomationFlowNode[] | ((prev: AutomationFlowNode[]) => AutomationFlowNode[])) => void,
  setEdges: (edges: AutomationFlowEdge[] | ((prev: AutomationFlowEdge[]) => AutomationFlowEdge[])) => void,
  pushCurrentHistorySnapshot: () => void,
  getCurrentMouseFlowPosition: () => FlowPoint
) {
  const copySelectedElements = useCallback(() => {
    const currentNodes = flowStateRef.current.nodes;
    const currentEdges = flowStateRef.current.edges;
    const directlySelectedNodeIds = new Set(
      currentNodes.filter((node) => node.selected).map((node) => node.id)
    );

    if (directlySelectedNodeIds.size === 0) return;

    const copiedNodeIds = getDescendantNodeIds(currentNodes, directlySelectedNodeIds);
    const copiedNodes = currentNodes.filter((node) => copiedNodeIds.has(node.id));

    const copiedEdges = currentEdges.filter(
      (edge) => copiedNodeIds.has(edge.source) && copiedNodeIds.has(edge.target)
    );

    const clipboard: AutomationClipboard = {
      version: 1,
      nodes: copiedNodes.map((node) => ({
        node: { ...node, selected: false },
        absolutePosition: getNodeAbsolutePosition(currentNodes, node)
      })),
      edges: copiedEdges.map((edge) => ({ ...edge, selected: false })),
      copiedAt: Date.now()
    };

    safeSaveAutomationClipboard(clipboard);
  }, [flowStateRef]);

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
        zIndex: item.node.data.automationType === "collection" ? -1 : item.node.zIndex || 10
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
      const unselectedCurrentNodes: AutomationFlowNode[] = currentNodes.map((node) => ({
        ...node,
        selected: false
      }));

      return [...unselectedCurrentNodes, ...pastedNodes].sort((a, b) => {
        const aIsCollection = a.data.automationType === "collection";
        const bIsCollection = b.data.automationType === "collection";
        if (aIsCollection === bIsCollection) return 0;
        return aIsCollection ? -1 : 1;
      });
    });

    setEdges((currentEdges): AutomationFlowEdge[] => {
      const unselectedCurrentEdges: AutomationFlowEdge[] = currentEdges.map((edge) => ({
        ...edge,
        selected: false
      }));
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
  }, [flowStateRef, pushCurrentHistorySnapshot, setEdges, setNodes]);

  return { copySelectedElements, pasteClipboardAtMouse, deleteSelectedElements };
}