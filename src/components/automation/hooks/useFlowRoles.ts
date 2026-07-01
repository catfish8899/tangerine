import { useCallback, useEffect, useMemo, useState } from "react";
import { Role } from "../../../types/chat";
import { safeLoadRoles } from "../automationStorage";
import type { AutomationTemplate } from "../automationTypes";

/**
 * 管理角色数据的加载、监听以及生成画布可用的模板列表
 */
export function useFlowRoles() {
  const [roles, setRoles] = useState<Role[]>(() => safeLoadRoles());

  const reloadRoles = useCallback(() => {
    setRoles(safeLoadRoles());
  }, []);

  // 监听 storage 事件，实现跨标签页/窗口的角色数据同步
  useEffect(() => {
    const handleStorageChange = () => reloadRoles();
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [reloadRoles]);

  const roleItems: AutomationTemplate[] = useMemo(() => {
    if (roles.length === 0) {
      return [
        {
          id: "role-empty-placeholder",
          nodeKind: "role",
          title: "暂无角色",
          subtitle: "请先在“我的角色”中创建",
          description: "创建角色后，可在这里拖拽到工作流画布。",
          icon: "role",
          colorClass: "bg-amber-500/20 border-amber-500/40 text-amber-400",
          disabled: true
        }
      ];
    }

    return roles.map((role) => ({
      id: `role-${role.id}`,
      nodeKind: "role" as const,
      title: role.name,
      subtitle: "角色节点",
      description: role.systemPrompt,
      icon: "role" as const,
      colorClass: "bg-amber-500/20 border-amber-500/40 text-amber-400",
      payload: {
        roleId: role.id,
        systemPrompt: role.systemPrompt
      }
    }));
  }, [roles]);

  return { roleItems, reloadRoles };
}