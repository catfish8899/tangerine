// src/hooks/chat/useAttachmentManager.ts
import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AttachmentFile, getFileType } from "../../types/chat";
import { copyAttachmentToLocal, getLocalPreviewUrl } from "../../utils/fileStorageService";

export function useAttachmentManager(
  activeSessionId: string,
  setWarningMessage: (msg: string | null) => void,
  setIsDraggingFiles: (dragging: boolean) => void
) {
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);

  const buildAttachmentFromPath = async (path: string): Promise<AttachmentFile> => {
    const parts = path.split(/[\\/]/);
    const name = parts[parts.length - 1] || "未命名文件";
    const type = getFileType(name);
    const attachment: AttachmentFile = { name, path, type };

    try {
      const localRelativePath = await copyAttachmentToLocal(path, activeSessionId);
      attachment.localRelativePath = localRelativePath;
      
      if (type === "image") {
        const previewUrl = await getLocalPreviewUrl(localRelativePath);
        attachment.previewUrl = previewUrl;
      }
    } catch (error: any) {
      const message = error?.message || String(error) || "未知错误";
      console.error("附件物理复制或预览生成失败：", { path, name, error });
      attachment.previewError = `文件处理失败：${message}`;
    }
    
    return attachment;
  };

  const mergeAttachments = async (incomingPaths: string[]) => {
    const normalizedPaths = incomingPaths.filter(Boolean).map(p => p.trim()).filter(Boolean);
    if (normalizedPaths.length === 0) return;

    const uniqueIncomingPaths = Array.from(new Set(normalizedPaths));
    const newAttachments = await Promise.all(uniqueIncomingPaths.map(buildAttachmentFromPath));

    const failedFiles = newAttachments.filter(file => file.previewError);
    if (failedFiles.length > 0) {
      console.warn("以下文件未能成功处理：", failedFiles);
      setWarningMessage("⚠️ 某些文件未能成功处理，请检查控制台输出。");
      setTimeout(() => setWarningMessage(null), 4000);
    }

    setAttachments(prev => {
      const existingPaths = new Set(prev.map(a => a.path));
      const filteredNew = newAttachments.filter(a => !existingPaths.has(a.path) && !a.previewError); 
      return [...prev, ...filteredNew];
    });
  };

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
  }, [activeSessionId]);

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
  };

  return {
    attachments, setAttachments,
    handleSelectFiles, handleDropFiles, handleRemoveAttachment,
    mergeAttachments, handlePreviewImage
  };
}