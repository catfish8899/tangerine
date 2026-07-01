import { useCallback, useEffect, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { buildAutomationNode } from "../automationNodeUtils";
import type { AutomationFlowNode, AutomationTemplate } from "../automationTypes";

/**
 * 管理从工具栏拖拽模板到画布创建节点的全局指针事件与状态
 */
export function useFlowTemplateDrag(
  wrapperRef: React.RefObject<HTMLDivElement>,
  pushCurrentHistorySnapshot: () => void,
  setNodes: (nodes: AutomationFlowNode[] | ((prev: AutomationFlowNode[]) => AutomationFlowNode[])) => void
) {
  const { screenToFlowPosition } = useReactFlow();
  const [draggingTemplate, setDraggingTemplate] = useState<AutomationTemplate | null>(null);
  const [pointerPreview, setPointerPreview] = useState<{ x: number; y: number } | null>(null);

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

      const position = screenToFlowPosition({ x: clientX, y: clientY });
      const newNode = buildAutomationNode(template, position);

      pushCurrentHistorySnapshot();

      setNodes((nds) => {
        if (newNode.type === "automationCollectionNode") {
          return [newNode, ...nds];
        }
        return nds.concat(newNode);
      });
    },
    [pushCurrentHistorySnapshot, screenToFlowPosition, setNodes, wrapperRef]
  );

  const handleTemplatePointerDown = useCallback(
    (event: React.PointerEvent, template: AutomationTemplate) => {
      if (event.button !== 0 || template.disabled) return;

      event.preventDefault();
      event.stopPropagation();

      setDraggingTemplate(template);
      setPointerPreview({ x: event.clientX, y: event.clientY });
    },
    []
  );

  // 全局指针事件监听，处理拖拽过程与释放
  useEffect(() => {
    if (!draggingTemplate) return;

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    const handlePointerMove = (event: PointerEvent) => {
      setPointerPreview({ x: event.clientX, y: event.clientY });
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

  return { draggingTemplate, pointerPreview, handleTemplatePointerDown };
}