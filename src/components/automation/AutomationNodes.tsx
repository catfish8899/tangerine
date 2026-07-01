// src/components/automation/AutomationNodes.tsx
import { RoleNode } from "./nodes/RoleNode";
import { ToolNode } from "./nodes/ToolNode";
import { TriggerNode } from "./nodes/TriggerNode";
import { CollectionNode } from "./nodes/CollectionNode";
import { ConversationNode } from "./nodes/ConversationNode";
import { HardwareNode } from "./nodes/HardwareNode";
import { TimerNode } from "./nodes/TimerNode";

/**
 * 注册所有自定义节点类型，供 ReactFlow 使用。
 * 将原本臃肿的单文件拆分为独立的节点组件，提升可维护性与渲染性能。
 * 对外暴露的 nodeTypes 接口保持 100% 兼容，调用方无需感知内部重构。
 */
export const nodeTypes = {
  automationRoleNode: RoleNode,
  automationToolNode: ToolNode,
  automationTriggerNode: TriggerNode,
  automationCollectionNode: CollectionNode,
  automationConversationNode: ConversationNode,
  automationHardwareNode: HardwareNode,
  automationTimerNode: TimerNode
};