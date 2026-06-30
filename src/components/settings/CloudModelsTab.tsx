// 云端模型设置 Tab 内容

import { Plus } from "lucide-react";
import { ApiProviderConfig } from "./types";
import ApiProviderCard from "./ApiProviderCard";

interface CloudModelsTabProps {
  cloudConfigs: ApiProviderConfig[];
  totalConfigsCount: number;
  savedStatus: { [key: string]: boolean };
  collapsedModels: { [key: string]: boolean };
  onSave: (id: string) => void;
  onDelete: (id: string) => void;
  onAddBlock: () => void;
  onFieldChange: (id: string, field: keyof ApiProviderConfig, value: any) => void;
  onModelChange: (id: string, index: number, value: string) => void;
  onAddModel: (id: string) => void;
  onRemoveModel: (id: string, index: number) => void;
  onToggleCollapse: (id: string) => void;
}

export default function CloudModelsTab({
  cloudConfigs,
  totalConfigsCount,
  savedStatus,
  collapsedModels,
  onSave,
  onDelete,
  onAddBlock,
  onFieldChange,
  onModelChange,
  onAddModel,
  onRemoveModel,
  onToggleCollapse
}: CloudModelsTabProps) {
  return (
    <>
      {cloudConfigs.map((config) => (
        <ApiProviderCard
          key={config.id}
          config={config}
          isSaved={!!savedStatus[config.id]}
          isCollapsed={!!collapsedModels[config.id]}
          canDelete={totalConfigsCount > 1}
          onSave={() => onSave(config.id)}
          onDelete={() => onDelete(config.id)}
          onFieldChange={(field, value) => onFieldChange(config.id, field, value)}
          onModelChange={(index, value) => onModelChange(config.id, index, value)}
          onAddModel={() => onAddModel(config.id)}
          onRemoveModel={(index) => onRemoveModel(config.id, index)}
          onToggleCollapse={() => onToggleCollapse(config.id)}
        />
      ))}

      <button
        onClick={onAddBlock}
        className="w-full py-5 border border-dashed border-white/10 hover:border-[#4ea1db]/50 rounded-xl flex items-center justify-center gap-2 hover:bg-white/5 text-xs text-gray-400 hover:text-[#4ea1db] transition-all cursor-pointer group"
      >
        <Plus size={14} className="group-hover:rotate-90 transition-transform duration-200" />
        <span className="font-semibold">添加一个新 API 提供商配置块</span>
      </button>
    </>
  );
}