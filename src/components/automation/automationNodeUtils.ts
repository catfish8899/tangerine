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
    role: { width: 180, height: 88 },
    tool: { width: 180, height: 78 },
    trigger: { width: 150, height: 52 },
    collection: { width: 360, height: 260 },
    conversation: { width: 240, height: 150 },
    hardware: { width: 180, height: 78 },
    timer: { width: 240, height: 116 }
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
        title: template.title,
        subtitle: template.subtitle || "角色节点",
        description: template.description,
        automationType: "role",
        payload: template.payload
      }
    };
  }

  if (template.nodeKind === "tool") {
    return {
      id: generateUniqueId(),
      type: "automationToolNode",
      position,
      data: {
        title: "联网搜索",
        subtitle: undefined,
        description: undefined,
        automationType: "tool",
        payload: {
          ...(template.payload || {}),
          toolName: "Tavily / Web Search"
        }
      }
    };
  }

  if (template.nodeKind === "trigger") {
    return {
      id: generateUniqueId(),
      type: "automationTriggerNode",
      position,
      data: {
        title: "开始对话",
        subtitle: undefined,
        description: undefined,
        automationType: "trigger",
        payload: template.payload
      }
    };
  }

  if (template.nodeKind === "collection") {
    return {
      id: generateUniqueId(),
      type: "automationCollectionNode",
      position,
      data: {
        title: template.title,
        subtitle: template.subtitle || "集合区域",
        description: template.description,
        automationType: "collection",
        payload: template.payload
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
        subtitle: undefined,
        description: undefined,
        automationType: "conversation",
        payload: {
          content: ""
        }
      },
      style: {
        width: 240
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
        subtitle: undefined,
        description: undefined,
        automationType: "hardware",
        payload: {
          hardwareAction: "connect_hardware"
        }
      }
    };
  }

  return {
    id: generateUniqueId(),
    type: "automationTimerNode",
    position,
    data: {
      title: "定时",
      subtitle: undefined,
      description: undefined,
      automationType: "timer",
      payload: {
        timerText: ""
      }
    },
    style: {
      width: 240
    }
  };
}