// src/components/automation/automationTypes.ts
import type { Edge, Node } from "@xyflow/react";

export type AutomationNodeKind =
  | "role"
  | "tool"
  | "trigger"
  | "collection"
  | "conversation"
  | "hardware"
  | "timer";

export interface AutomationTemplate {
  id: string;
  nodeKind: AutomationNodeKind;
  title: string;
  subtitle?: string;
  description?: string;
  icon: "role" | "tool" | "trigger" | "collection" | "web" | "conversation" | "hardware" | "timer";
  colorClass: string;
  payload?: Record<string, unknown>;
  disabled?: boolean;
}

export interface AutomationNodeData extends Record<string, unknown> {
  title: string;
  subtitle?: string;
  description?: string;
  automationType: AutomationNodeKind;
  payload?: Record<string, unknown>;
}

export type AutomationFlowNode = Node<AutomationNodeData>;
export type AutomationFlowEdge = Edge;

export interface PointerPreview {
  x: number;
  y: number;
}

export interface FlowPoint {
  x: number;
  y: number;
}

export interface FlowSize {
  width: number;
  height: number;
}

export interface AutomationFlowSnapshot {
  nodes: AutomationFlowNode[];
  edges: AutomationFlowEdge[];
}

export interface PersistedAutomationFlow {
  version: 1;
  nodes: AutomationFlowNode[];
  edges: AutomationFlowEdge[];
  updatedAt: number;
}

export interface ClipboardNode {
  node: AutomationFlowNode;
  absolutePosition: FlowPoint;
}

export interface AutomationClipboard {
  version: 1;
  nodes: ClipboardNode[];
  edges: AutomationFlowEdge[];
  copiedAt: number;
}