// src/components/automation/nodes/RoleNode.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { UserSquare2 } from "lucide-react";
import type { Role } from "../../../types/chat";
import { safeLoadRoles } from "../automationStorage";
import type { AutomationFlowEdge, AutomationFlowNode } from "../automationTypes";
import { WorkflowNodeShell } from "./WorkflowNodeShell";
import { NodeSelect } from "./NodeSelect";
import { getRolePromptText } from "./nodeFormatters";

export function RoleNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow<AutomationFlowNode, AutomationFlowEdge>();
  const [roles, setRoles] = useState<Role[]>([]);
  const selectedRoleId = String(data.payload?.roleId || "");

  const reloadRoles = () => setRoles(safeLoadRoles());

  useEffect(() => {
    reloadRoles();
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === "tangerine_roles") reloadRoles();
    };
    const handleWindowFocus = () => reloadRoles();
    const handleVisibilityChange = () => { if (!document.hidden) reloadRoles(); };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const roleOptions = useMemo(
    () => [
      { value: "", label: roles.length > 0 ? "请选择角色" : "暂无角色" },
      ...roles.map((role) => ({ value: role.id, label: role.name }))
    ],
    [roles]
  );

  const updateRole = (roleId: string) => {
    const latestRoles = safeLoadRoles();
    const matchedRole = latestRoles.find((role) => role.id === roleId);
    const matchedRolePrompt = matchedRole ? getRolePromptText(matchedRole) : "";
    setRoles(latestRoles);

    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== id) return node;
        if (!matchedRole) {
          return {
            ...node,
            data: {
              ...node.data, title: "角色", subtitle: "请选择角色",
              description: "在节点内部下拉选单中选择具体角色。",
              payload: { ...(node.data.payload || {}), roleId: "", roleName: "", systemPrompt: "" }
            }
          };
        }
        return {
          ...node,
          data: {
            ...node.data, title: matchedRole.name, subtitle: "角色节点", description: matchedRolePrompt,
            payload: { ...(node.data.payload || {}), roleId: matchedRole.id, roleName: matchedRole.name, systemPrompt: matchedRolePrompt }
          }
        };
      })
    );
  };

  return (
    <WorkflowNodeShell data={data} selected={selected} accent="amber" icon={<UserSquare2 size={17} />}>
      <NodeSelect
        value={selectedRoleId} options={roleOptions} disabled={roles.length === 0}
        accentClass="border-amber-400/20 text-amber-50 focus:border-amber-300/50"
        onChange={updateRole} onBeforeOpen={reloadRoles}
      />
    </WorkflowNodeShell>
  );
}