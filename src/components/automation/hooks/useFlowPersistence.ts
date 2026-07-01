import { useEffect, useRef } from "react";
import {
  safeLoadAutomationFlow,
  safeSaveAutomationFlow
} from "../automationStorage";
import type {
  AutomationFlowEdge,
  AutomationFlowNode,
  AutomationFlowSnapshot
} from "../automationTypes";

/**
 * 管理工作流画布状态的 LocalStorage 加载与防抖保存
 */
export function useFlowPersistence(
  sessionId: string,
  nodes: AutomationFlowNode[],
  edges: AutomationFlowEdge[],
  setNodes: (nodes: AutomationFlowNode[] | ((prev: AutomationFlowNode[]) => AutomationFlowNode[])) => void,
  setEdges: (edges: AutomationFlowEdge[] | ((prev: AutomationFlowEdge[]) => AutomationFlowEdge[])) => void,
  hydratedRef: React.MutableRefObject<boolean>,
  historyRef: React.MutableRefObject<AutomationFlowSnapshot[]>,
  dragStartSnapshotRef: React.MutableRefObject<AutomationFlowSnapshot | null>,
  resizeHistoryArmedRef: React.MutableRefObject<boolean>
) {
  const persistTimerRef = useRef<number | null>(null);

  // 会话切换时重置状态并加载本地数据
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
  }, [sessionId, setNodes, setEdges, hydratedRef, historyRef, dragStartSnapshotRef, resizeHistoryArmedRef]);

  // 状态变化时防抖保存到 LocalStorage
  useEffect(() => {
    if (!hydratedRef.current) return;

    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
    }

    persistTimerRef.current = window.setTimeout(() => {
      safeSaveAutomationFlow(sessionId, { nodes, edges });
      persistTimerRef.current = null;
    }, 220);

    return () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [sessionId, nodes, edges, hydratedRef]);
}