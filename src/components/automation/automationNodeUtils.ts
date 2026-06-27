// src/components/automation/automationNodeUtils.ts
import type {
  AutomationFlowNode,
  AutomationFlowSnapshot,
  AutomationNodeKind,
  AutomationTemplate,
  FlowPoint,
  FlowSize
} from "./automationTypes";

export const generateUniqueId = () =>
  `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const generateUniqueEdgeId = () =>
  `edge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const cloneFlowSnapshot = (snapshot: AutomationFlowSnapshot): AutomationFlowSnapshot => ({
  nodes: JSON.parse(JSON.stringify(snapshot.nodes)),
  edges: JSON.parse(JSON.stringify(snapshot.edges))
});

export function isEditableElement(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;

  const tagName = element.tagName?.toLowerCase();

  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    element.isContentEditable
  );
}

export function areSnapshotsEqual(a: AutomationFlowSnapshot, b: AutomationFlowSnapshot) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function getNodeSize(node: AutomationFlowNode): FlowSize {
  const measured = (node as any).measured;
  const style = node.style as React.CSSProperties | undefined;

  const styleWidth =
    typeof style?.width === "number"
      ? style.width
      : typeof style?.width === "string"
        ? Number.parseFloat(style.width)
        : undefined;

  const styleHeight =
    typeof style?.height === "number"
      ? style.height
      : typeof style?.height === "string"
        ? Number.parseFloat(style.height)
        : undefined;

  const fallbackByType: Record<AutomationNodeKind, FlowSize> = {
    role: { width: 220, height: 126 },
    tool: { width: 220, height: 112 },
    trigger: { width: 190, height: 92 },
    collection: { width: 360, height: 260 },
    conversation: { width: 250, height: 184 },
    hardware: { width: 220, height: 112 },
    timer: { width: 250, height: 150 }
  };

  const fallback = fallbackByType[node.data.automationType] || { width: 180, height: 88 };

  return {
    width:
      typeof measured?.width === "number"
        ? measured.width
        : typeof (node as any).width === "number"
          ? (node as any).width
          : styleWidth || fallback.width,
    height:
      typeof measured?.height === "number"
        ? measured.height
        : typeof (node as any).height === "number"
          ? (node as any).height
          : styleHeight || fallback.height
  };
}

export function getNodeAbsolutePosition(
  nodes: AutomationFlowNode[],
  node: AutomationFlowNode
): FlowPoint {
  if (!node.parentId) {
    return {
      x: node.position.x,
      y: node.position.y
    };
  }

  const parent = nodes.find((candidate) => candidate.id === node.parentId);
  if (!parent) {
    return {
      x: node.position.x,
      y: node.position.y
    };
  }

  const parentAbsolutePosition = getNodeAbsolutePosition(nodes, parent);

  return {
    x: parentAbsolutePosition.x + node.position.x,
    y: parentAbsolutePosition.y + node.position.y
  };
}

export function isPointInsideNode(
  point: FlowPoint,
  node: AutomationFlowNode,
  nodes: AutomationFlowNode[]
): boolean {
  const absolutePosition = getNodeAbsolutePosition(nodes, node);
  const size = getNodeSize(node);

  return (
    point.x >= absolutePosition.x &&
    point.x <= absolutePosition.x + size.width &&
    point.y >= absolutePosition.y &&
    point.y <= absolutePosition.y + size.height
  );
}

export function applyCollectionStickiness(
  nodes: AutomationFlowNode[],
  draggedNodeId: string
): AutomationFlowNode[] {
  const draggedNode = nodes.find((node) => node.id === draggedNodeId);
  if (!draggedNode) return nodes;

  if (draggedNode.data.automationType === "collection") {
    return nodes;
  }

  const draggedAbsolutePosition = getNodeAbsolutePosition(nodes, draggedNode);
  const draggedSize = getNodeSize(draggedNode);
  const draggedCenter = {
    x: draggedAbsolutePosition.x + draggedSize.width / 2,
    y: draggedAbsolutePosition.y + draggedSize.height / 2
  };

  const containingCollections = nodes
    .filter(
      (node) =>
        node.id !== draggedNode.id &&
        node.data.automationType === "collection" &&
        isPointInsideNode(draggedCenter, node, nodes)
    )
    .sort((a, b) => {
      const sizeA = getNodeSize(a);
      const sizeB = getNodeSize(b);
      return sizeA.width * sizeA.height - sizeB.width * sizeB.height;
    });

  const targetCollection = containingCollections[0];

  if (!targetCollection) {
    if (!draggedNode.parentId) return nodes;

    return nodes.map((node) => {
      if (node.id !== draggedNode.id) return node;

      return {
        ...node,
        parentId: undefined,
        position: draggedAbsolutePosition,
        zIndex: 10
      };
    });
  }

  const targetCollectionAbsolutePosition = getNodeAbsolutePosition(nodes, targetCollection);

  const nextRelativePosition = {
    x: draggedAbsolutePosition.x - targetCollectionAbsolutePosition.x,
    y: draggedAbsolutePosition.y - targetCollectionAbsolutePosition.y
  };

  return nodes.map((node) => {
    if (node.id !== draggedNode.id) return node;

    return {
      ...node,
      parentId: targetCollection.id,
      position: nextRelativePosition,
      zIndex: 10
    };
  });
}

export function getDescendantNodeIds(
  nodes: AutomationFlowNode[],
  rootIds: Set<string>
): Set<string> {
  const result = new Set(rootIds);
  let changed = true;

  while (changed) {
    changed = false;

    for (const node of nodes) {
      if (node.parentId && result.has(node.parentId) && !result.has(node.id)) {
        result.add(node.id);
        changed = true;
      }
    }
  }

  return result;
}

export function buildAutomationNode(
  template: AutomationTemplate,
  position: { x: number; y: number }
): AutomationFlowNode {
  if (template.nodeKind === "role") {
    return {
      id: generateUniqueId(),
      type: "automationRoleNode",
      position,
      data: {
        title: "角色",
        subtitle: "请选择角色",
        description: "在节点内部下拉选单中选择具体角色。",
        automationType: "role",
        payload: {
          ...(template.payload || {}),
          roleId: String(template.payload?.roleId || ""),
          roleName: String(template.payload?.roleName || ""),
          systemPrompt: String(template.payload?.systemPrompt || "")
        }
      },
      style: {
        width: 220
      }
    };
  }

  if (template.nodeKind === "tool") {
    return {
      id: generateUniqueId(),
      type: "automationToolNode",
      position,
      data: {
        title: "工具",
        subtitle: "请选择工具",
        description: undefined,
        automationType: "tool",
        payload: {
          ...(template.payload || {}),
          toolType: String(template.payload?.toolType || "web_search"),
          toolName: String(template.payload?.toolName || "Tavily / Web Search"),
          webSearchMode: String(template.payload?.webSearchMode || "direct")
        }
      },
      style: {
        width: 220
      }
    };
  }

  if (template.nodeKind === "trigger") {
    return {
      id: generateUniqueId(),
      type: "automationTriggerNode",
      position,
      data: {
        title: "开关",
        subtitle: "请选择开关",
        description: undefined,
        automationType: "trigger",
        payload: {
          ...(template.payload || {}),
          triggerType: String(template.payload?.triggerType || "start_chat")
        }
      },
      style: {
        width: 190
      }
    };
  }

  if (template.nodeKind === "collection") {
    return {
      id: generateUniqueId(),
      type: "automationCollectionNode",
      position,
      data: {
        title: "集合",
        subtitle: "请选择集合类型",
        description: template.description,
        automationType: "collection",
        payload: {
          ...(template.payload || {}),
          collectionType: String(template.payload?.collectionType || "area")
        }
      },
      style: {
        width: 360,
        height: 260
      },
      zIndex: -1
    };
  }

  if (template.nodeKind === "conversation") {
    return {
      id: generateUniqueId(),
      type: "automationConversationNode",
      position,
      data: {
        title: "对话",
        subtitle: "请选择对话类型",
        description: undefined,
        automationType: "conversation",
        payload: {
          ...(template.payload || {}),
          conversationType: String(template.payload?.conversationType || "text_input"),
          content: String(template.payload?.content || "")
        }
      },
      style: {
        width: 250
      }
    };
  }

  if (template.nodeKind === "hardware") {
    return {
      id: generateUniqueId(),
      type: "automationHardwareNode",
      position,
      data: {
        title: "硬件",
        subtitle: "请选择硬件动作",
        description: undefined,
        automationType: "hardware",
        payload: {
          ...(template.payload || {}),
          hardwareAction: String(template.payload?.hardwareAction || "connect_hardware")
        }
      },
      style: {
        width: 220
      }
    };
  }

  return {
    id: generateUniqueId(),
    type: "automationTimerNode",
    position,
    data: {
      title: "定时",
      subtitle: "请选择定时类型",
      description: undefined,
      automationType: "timer",
      payload: {
        ...(template.payload || {}),
        timerType: String(template.payload?.timerType || "specific_datetime"),
        timerText: String(template.payload?.timerText || "")
      }
    },
    style: {
      width: 250
    }
  };
}