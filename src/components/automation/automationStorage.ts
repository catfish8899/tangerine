// src/components/automation/automationStorage.ts
import { Role } from "../../types/chat";
import {
  AUTOMATION_CLIPBOARD_STORAGE_KEY,
  AUTOMATION_FLOW_STORAGE_PREFIX,
  ROLES_STORAGE_KEY
} from "./automationConstants";
import type {
  AutomationClipboard,
  AutomationFlowSnapshot,
  PersistedAutomationFlow
} from "./automationTypes";

export function getAutomationFlowStorageKey(sessionId: string) {
  return `${AUTOMATION_FLOW_STORAGE_PREFIX}${sessionId}`;
}

export function safeLoadRoles(): Role[] {
  const saved = localStorage.getItem(ROLES_STORAGE_KEY);
  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("自动化工作流读取角色数据失败：", e);
    return [];
  }
}

export function safeLoadAutomationFlow(sessionId: string): AutomationFlowSnapshot {
  const saved = localStorage.getItem(getAutomationFlowStorageKey(sessionId));
  if (!saved) {
    return {
      nodes: [],
      edges: []
    };
  }

  try {
    const parsed = JSON.parse(saved) as PersistedAutomationFlow;
    return {
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges : []
    };
  } catch (e) {
    console.error("自动化工作流读取画布数据失败：", e);
    return {
      nodes: [],
      edges: []
    };
  }
}

export function safeSaveAutomationFlow(sessionId: string, snapshot: AutomationFlowSnapshot) {
  try {
    const payload: PersistedAutomationFlow = {
      version: 1,
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      updatedAt: Date.now()
    };

    localStorage.setItem(getAutomationFlowStorageKey(sessionId), JSON.stringify(payload));
  } catch (e) {
    console.error("自动化工作流保存画布数据失败：", e);
  }
}

export function safeLoadAutomationClipboard(): AutomationClipboard | null {
  const saved = localStorage.getItem(AUTOMATION_CLIPBOARD_STORAGE_KEY);
  if (!saved) return null;

  try {
    const parsed = JSON.parse(saved) as AutomationClipboard;
    if (!Array.isArray(parsed.nodes)) return null;

    return {
      version: 1,
      nodes: parsed.nodes,
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
      copiedAt: parsed.copiedAt || Date.now()
    };
  } catch (e) {
    console.error("自动化工作流读取剪贴板失败：", e);
    return null;
  }
}

export function safeSaveAutomationClipboard(clipboard: AutomationClipboard) {
  try {
    localStorage.setItem(AUTOMATION_CLIPBOARD_STORAGE_KEY, JSON.stringify(clipboard));
  } catch (e) {
    console.error("自动化工作流保存剪贴板失败：", e);
  }
}