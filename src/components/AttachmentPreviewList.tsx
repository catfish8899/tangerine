import React from "react";
import { X, FileCode, FileText, FileAudio, FileSpreadsheet, FileImage, Eye } from "lucide-react";
import { AttachmentFile } from "../types/chat";

interface AttachmentPreviewListProps {
  attachments: AttachmentFile[];
  onRemoveAttachment: (idx: number) => void;
  onPreviewImage: (file: AttachmentFile) => void;
}

export default function AttachmentPreviewList({
  attachments,
  onRemoveAttachment,
  onPreviewImage
}: AttachmentPreviewListProps) {
  // 根据文件类型渲染对应的图标
  const renderAttachmentIcon = (type: AttachmentFile["type"]) => {
    switch (type) {
      case "image":
        return <FileImage size={14} className="text-emerald-400" />;
      case "audio":
        return <FileAudio size={14} className="text-purple-400" />;
      case "code":
        return <FileCode size={14} className="text-blue-400" />;
      case "office":
        return <FileSpreadsheet size={14} className="text-orange-400" />;
      default:
        return <FileText size={14} className="text-gray-400" />;
    }
  };

  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-2 pb-2 border-b border-[#3e3e3e] mb-2 animate-in fade-in duration-100">
      {attachments.map((file, idx) =>
        file.type === "image" && file.previewUrl ? (
          <div
            key={idx}
            className="relative group rounded-xl overflow-hidden border border-[#3e3e3e] bg-[#252526] w-[84px] h-[84px]"
          >
            <button
              type="button"
              onClick={() => onPreviewImage(file)}
              className="w-full h-full cursor-pointer"
              title={`预览图片：${file.name}`}
            >
              <img
                src={file.previewUrl}
                alt={file.name}
                className="w-full h-full object-cover"
                draggable={false}
                onError={(e) => {
                  console.error("图片缩略图加载失败：", {
                    name: file.name,
                    path: file.path,
                    previewUrl: file.previewUrl
                  });
                  const target = e.currentTarget;
                  target.style.display = "none";
                }}
              />
            </button>

            <div className="absolute inset-x-0 bottom-0 px-1.5 py-1 bg-gradient-to-t from-black/80 to-transparent">
              <div className="text-[9px] text-white truncate">{file.name}</div>
            </div>

            <button
              type="button"
              onClick={() => onPreviewImage(file)}
              className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/55 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              title="查看大图"
            >
              <Eye size={12} />
            </button>

            <button
              type="button"
              onClick={() => onRemoveAttachment(idx)}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/55 text-white hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer"
              title="移除此附件"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div
            key={idx}
            className="flex items-center gap-1.5 bg-[#252526] px-2 py-1 rounded-md border border-[#3e3e3e] text-[10px] text-gray-300 font-mono relative group max-w-[180px]"
          >
            {renderAttachmentIcon(file.type)}
            <span className="max-w-[120px] truncate">{file.name}</span>
            <button
              type="button"
              onClick={() => onRemoveAttachment(idx)}
              className="ml-1 p-0.5 text-gray-500 hover:text-red-400 rounded-full transition-colors cursor-pointer"
            >
              <X size={10} />
            </button>
          </div>
        )
      )}
    </div>
  );
}