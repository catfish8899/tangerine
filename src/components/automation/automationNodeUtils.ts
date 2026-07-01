// src/components/automation/automationNodeUtils.ts
import type {
  AutomationFlowNode,
  AutomationFlowSnapshot,
  AutomationNodeKind,
  AutomationTemplate,
  FlowPoint,
  FlowSize
} from "./automationTypes";

// ==========================================
// 1. 基础工具与 ID 生成
// ==========================================

/** 生成唯一节点 ID */
export const generateUniqueId = () =>
  `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/** 生成唯一边 ID */
export const generateUniqueEdgeId = () =>
  `edge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/** 判断目标元素是否为可编辑元素（用于拦截快捷键） */
export function isEditableElement(target: EventTarget | null): boolean {
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

// ==========================================
// 2. 快照与状态比对
// ==========================================

/** 深拷贝画布快照 */
export const cloneFlowSnapshot = (snapshot: AutomationFlowSnapshot): AutomationFlowSnapshot => ({
  nodes: JSON.parse(JSON.stringify(snapshot.nodes)),
  edges: JSON.parse(JSON.stringify(snapshot.edges))
});

/** 浅层比对两个快照是否完全一致 */
export function areSnapshotsEqual(a: AutomationFlowSnapshot, b: AutomationFlowSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ==========================================
// 3. 节点几何计算与物理交互 (集合吸附)
// ==========================================

/** 辅助函数：解析 CSS 尺寸属性（兼容 number 和 string） */
function parseCssDimension(value: string | number | undefined): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

/** 获取节点的实际尺寸（优先读取 measured，其次 style，最后使用默认回退值） */
export function getNodeSize(node: AutomationFlowNode): FlowSize {
  const measured = (node as any).measured;
  const style = node.style as React.CSSProperties | undefined;

  const styleWidth = parseCssDimension(style?.width);
  const styleHeight = parseCssDimension(style?.height);

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
    width: measured?.width ?? (node as any).width ?? styleWidth ?? fallback.width,
    height: measured?.height ?? (node as any).height ?? styleHeight ?? fallback.height
  };
}

/** 递归计算节点相对于画布的绝对坐标 */
export function getNodeAbsolutePosition(
  nodes: AutomationFlowNode[],
  node: AutomationFlowNode
): FlowPoint {
  if (!node.parentId) {
    return { x: node.position.x, y: node.position.y };
  }

  const parent = nodes.find((candidate) => candidate.id === node.parentId);
  if (!parent) {
    return { x: node.position.x, y: node.position.y };
  }

  const parentAbsolutePosition = getNodeAbsolutePosition(nodes, parent);
  return {
    x: parentAbsolutePosition.x + node.position.x,
    y: parentAbsolutePosition.y + node.position.y
  };
}

/** 判断一个点是否位于节点边界内 */
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

/** 处理集合节点（Collection）的吸附与脱离逻辑 */
export function applyCollectionStickiness(
  nodes: AutomationFlowNode[],
  draggedNodeId: string
): AutomationFlowNode[] {
  const draggedNode = nodes.find((node) => node.id === draggedNodeId);
  if (!draggedNode || draggedNode.data.automationType === "collection") return nodes;

  const draggedAbsolutePosition = getNodeAbsolutePosition(nodes, draggedNode);
  const draggedSize = getNodeSize(draggedNode);
  const draggedCenter = {
    x: draggedAbsolutePosition.x + draggedSize.width / 2,
    y: draggedAbsolutePosition.y + draggedSize.height / 2
  };

  // 查找包含该节点中心点的所有集合节点，并按面积从小到大排序（优先吸附最小的集合）
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

  // 如果没有目标集合，且当前有父级，则脱离父级
  if (!targetCollection) {
    if (!draggedNode.parentId) return nodes;
    return nodes.map((node) =>
      node.id !== draggedNode.id
        ? node
        : { ...node, parentId: undefined, position: draggedAbsolutePosition, zIndex: 10 }
    );
  }

  // 计算相对于新父级的相对坐标
  const targetCollectionAbsolutePosition = getNodeAbsolutePosition(nodes, targetCollection);
  const nextRelativePosition = {
    x: draggedAbsolutePosition.x - targetCollectionAbsolutePosition.x,
    y: draggedAbsolutePosition.y - targetCollectionAbsolutePosition.y
  };

  return nodes.map((node) =>
    node.id !== draggedNode.id
      ? node
      : { ...node, parentId: targetCollection.id, position: nextRelativePosition, zIndex: 10 }
  );
}

// ==========================================
// 4. 节点树遍历
// ==========================================

/** 获取指定根节点集合的所有子孙节点 ID（使用 BFS 优化，时间复杂度 O(N)） */
export function getDescendantNodeIds(
  nodes: AutomationFlowNode[],
  rootIds: Set<string>
): Set<string> {
  const result = new Set(rootIds);
  
  // 构建邻接表：parentId -> childrenIds
  const childrenMap = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.parentId) {
      if (!childrenMap.has(node.parentId)) {
        childrenMap.set(node.parentId, []);
      }
      childrenMap.get(node.parentId)!.push(node.id);
    }
  }

  // 广度优先搜索 (BFS)
  const queue = Array.from(rootIds);
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = childrenMap.get(currentId);
    if (children) {
      for (const childId of children) {
        if (!result.has(childId)) {
          result.add(childId);
          queue.push(childId);
        }
      }
    }
  }

  return result;
}

// ==========================================
// 5. 节点工厂 (配置驱动)
// ==========================================

/** 节点蓝图配置接口 */
interface NodeBlueprint {
  type: string;
  title: string;
  subtitle: string;
  description?: string;
  style: React.CSSProperties;
  zIndex?: number;
  payloadDefaults: Record<string, unknown>;
}

/** 所有节点类型的默认配置字典（消除冗长的 if-else） */
const NODE_BLUEPRINTS: Record<AutomationNodeKind, NodeBlueprint> = {
  role: {
    type: "automationRoleNode", title: "角色", subtitle: "请选择角色",
    description: "在节点内部下拉选单中选择具体角色。", style: { width: 220 },
    payloadDefaults: { roleId: "", roleName: "", systemPrompt: "" }
  },
  tool: {
    type: "automationToolNode", title: "工具", subtitle: "请选择工具",
    style: { width: 220 },
    payloadDefaults: { toolType: "web_search", toolName: "Tavily / Web Search", webSearchMode: "direct" }
  },
  trigger: {
    type: "automationTriggerNode", title: "开关", subtitle: "请选择开关",
    style: { width: 190 },
    payloadDefaults: { triggerType: "start_chat" }
  },
  collection: {
    type: "automationCollectionNode", title: "集合", subtitle: "请选择集合类型",
    style: { width: 360, height: 260 }, zIndex: -1,
    payloadDefaults: { collectionType: "area" }
  },
  conversation: {
    type: "automationConversationNode", title: "对话", subtitle: "请选择对话类型",
    style: { width: 250 },
    payloadDefaults: { conversationType: "text_input", content: "" }
  },
  hardware: {
    type: "automationHardwareNode", title: "硬件", subtitle: "请选择硬件动作",
    style: { width: 220 },
    payloadDefaults: { hardwareAction: "connect_hardware" }
  },
  timer: {
    type: "automationTimerNode", title: "定时", subtitle: "请选择定时类型",
    style: { width: 250 },
    payloadDefaults: { timerType: "specific_datetime", timerText: "" }
  }
};

/** 根据模板和坐标构建完整的自动化节点实例 */
export function buildAutomationNode(
  template: AutomationTemplate,
  position: FlowPoint
): AutomationFlowNode {
  const blueprint = NODE_BLUEPRINTS[template.nodeKind];
  
  // 合并 payload，确保所有值都转换为字符串（兼容历史逻辑）
  const mergedPayload: Record<string, string> = {};
  const allPayloadKeys = new Set([
    ...Object.keys(blueprint.payloadDefaults),
    ...Object.keys(template.payload || {})
  ]);
  
  allPayloadKeys.forEach((key) => {
    const val = template.payload?.[key] ?? blueprint.payloadDefaults[key];
    mergedPayload[key] = String(val ?? "");
  });

  return {
    id: generateUniqueId(),
    type: blueprint.type,
    position,
    data: {
      title: blueprint.title,
      subtitle: blueprint.subtitle,
      description: template.description ?? blueprint.description,
      automationType: template.nodeKind,
      payload: mergedPayload
    },
    style: blueprint.style,
    ...(blueprint.zIndex !== undefined && { zIndex: blueprint.zIndex })
  };
}