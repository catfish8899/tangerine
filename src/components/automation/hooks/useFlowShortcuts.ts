import { useEffect } from "react";
import { isEditableElement } from "../automationNodeUtils";

/**
 * 管理画布的全局键盘快捷键（删除、复制、粘贴、撤销）
 */
export function useFlowShortcuts(
  copySelectedElements: () => void,
  pasteClipboardAtMouse: () => void,
  deleteSelectedElements: () => void,
  undoLastOperation: () => void
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableElement(event.target)) return;

      const key = event.key.toLowerCase();
      const isCtrlOrMeta = event.ctrlKey || event.metaKey;

      if ((event.key === "Delete" || event.key === "Backspace") && !isCtrlOrMeta) {
        event.preventDefault();
        deleteSelectedElements();
        return;
      }

      if (isCtrlOrMeta && key === "c") {
        event.preventDefault();
        copySelectedElements();
        return;
      }

      if (isCtrlOrMeta && key === "v") {
        event.preventDefault();
        pasteClipboardAtMouse();
        return;
      }

      if (isCtrlOrMeta && key === "z") {
        event.preventDefault();
        undoLastOperation();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    copySelectedElements,
    deleteSelectedElements,
    pasteClipboardAtMouse,
    undoLastOperation
  ]);
}