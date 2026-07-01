// src/hooks/chat/useAttachmentManager.ts
// 负责管理附件状态、Tauri 原生文件选择、拖放监听及图片预览生成
import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AttachmentFile, getFileType } from "../../types/chat";

export function useAttachmentManager(
  setWarningMessage: (msg: string | null) => void,
  setIsDraggingFiles: (dragging: boolean) => void
) {
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);

  const createImagePreview = async (path: string, name: string): Promise<{ previewUrl?: string; previewError?: string }> => {
    try {
      const previewUrl = await invoke<string>("read_image_as_data_url", { path });
      return { previewUrl };
    } catch (error: any) {
      const message = error?.message || String(error) || "未知错误";
      console.error("调用 Rust 图片读取命令失败：", { path, name, error });
      return { previewError: `图片读取失败：${message}` };
    }
  };

  const buildAttachmentFromPath = async (path: string): Promise<AttachmentFile> => {
    const parts = path.split(/[\\/]/);
    const name = parts[parts.length - 1] || "未命名文件";
    const type = getFileType(name);
    const attachment: AttachmentFile = { name, path, type };

    if (type === "image") {
      const previewResult = await createImagePreview(path, name);
      attachment.previewUrl = previewResult.previewUrl;
      attachment.previewError = previewResult.previewError;
    }
    return attachment;
  };

  const mergeAttachments = async (incomingPaths: string[]) => {
    const normalizedPaths = incomingPaths.filter(Boolean).map(p => p.trim()).filter(Boolean);
    if (normalizedPaths.length === 0) return;

    const uniqueIncomingPaths = Array.from(new Set(normalizedPaths));
    const newAttachments = await Promise.all(uniqueIncomingPaths.map(buildAttachmentFromPath));

    const failedImages = newAttachments.filter(file => file.type === "image" && !file.previewUrl);
    if (failedImages.length > 0) {
      console.warn("以下图片未能生成预览：", failedImages);
      setWarningMessage("⚠️ 某些图片未能生成预览，请检查 Rust 终端输出。");
      setTimeout(() => setWarningMessage(null), 4000);
    }

    setAttachments(prev => {
      const existingPaths = new Set(prev.map(a => a.path));
      const filteredNew = newAttachments.filter(a => !existingPaths.has(a.path));
      return [...prev, ...filteredNew];
    });
  };

  // Tauri 原生拖放监听
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const registerDragDropListener = async () => {
      try {
        const currentWindow = getCurrentWindow();
        unlisten = await currentWindow.onDragDropEvent(async (event) => {
          if (event.payload.type === "enter" || event.payload.type === "over") {
            setIsDraggingFiles(true);
          } else if (event.payload.type === "leave") {
            setIsDraggingFiles(false);
          } else if (event.payload.type === "drop") {
            setIsDraggingFiles(false);
            const paths = event.payload.paths || [];
            if (paths.length > 0) await mergeAttachments(paths);
          }
        });
      } catch (error) {
        console.error("注册 Tauri 原生拖放监听失败：", error);
      }
    };
    registerDragDropListener();
    return () => { if (unlisten) unlisten(); };
  }, []);

  const handleSelectFiles = async () => {
    try {
      const selected = await open({
        multiple: true, directory: false, title: "选择要附加到对话中的文件",
        filters: [
          {
            name: "支持的文件",
            extensions: [
              "txt", "md", "json", "yaml", "yml", "py", "js", "ts", "tsx", "jsx", "html", "css",
              "rs", "go", "java", "cpp", "c", "h", "hpp", "cs", "php", "sh", "bat", "ps1", "sql", "xml", "csv",
              "jpg", "jpeg", "png", "gif", "webp", "bmp", "mp3", "wav", "ogg", "m4a",
              "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"
            ]
          },
          { name: "所有文件", extensions: ["*"] }
        ]
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      await mergeAttachments(paths);
    } catch (e) {
      console.error("调用 Tauri 原生文件选择器失败:", e);
      setWarningMessage("⚠️ 打开系统文件选择器失败。");
      setTimeout(() => setWarningMessage(null), 3000);
    }
  };

  const handleDropFiles = async (paths: string[]) => {
    await mergeAttachments(paths);
    setIsDraggingFiles(false);
  };

  const handleRemoveAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const handlePreviewImage = (file: AttachmentFile) => {
    if (file.type !== "image" || !file.previewUrl) {
      console.warn("当前附件不是可预览图片或预览生成失败：", file);
      if (file.previewError) {
        setWarningMessage(`⚠️ ${file.previewError}`);
        setTimeout(() => setWarningMessage(null), 4000);
      }
      return;
    }
    // previewImage 状态在 UI 中管理，这里通过回调设置（为保持原接口，在主 hook 中处理）
  };

  return {
    attachments, setAttachments,
    handleSelectFiles, handleDropFiles, handleRemoveAttachment,
    mergeAttachments
  };
}