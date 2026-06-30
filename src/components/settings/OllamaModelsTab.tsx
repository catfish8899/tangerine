// Ollama 模型设置 Tab 内容

import { RefreshCw } from "lucide-react";
import { ApiProviderConfig, OllamaStatus } from "./types";
import ApiProviderCard from "./ApiProviderCard";

interface OllamaModelsTabProps {
  ollamaStatus: OllamaStatus;
  ollamaStatusMsg: string;
  isSyncing: boolean;
  ollamaConfig?: ApiProviderConfig;
  savedStatus: { [key: string]: boolean };
  collapsedModels: { [key: string]: boolean };
  onCheckStatus: () => void;
  onSyncModels: () => void;
  onSave: (id: string) => void;
  onFieldChange: (id: string, field: keyof ApiProviderConfig, value: any) => void;
  onModelChange: (id: string, index: number, value: string) => void;
  onAddModel: (id: string) => void;
  onRemoveModel: (id: string, index: number) => void;
  onToggleCollapse: (id: string) => void;
}

export default function OllamaModelsTab({
  ollamaStatus,
  ollamaStatusMsg,
  isSyncing,
  ollamaConfig,
  savedStatus,
  collapsedModels,
  onCheckStatus,
  onSyncModels,
  onSave,
  onFieldChange,
  onModelChange,
  onAddModel,
  onRemoveModel,
  onToggleCollapse
}: OllamaModelsTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-amber-400 tracking-wider uppercase font-mono mb-2">
          OLLAMA 接口状态
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          检测当前配置的 Ollama 接口是否可用，并同步该接口已暴露的模型列表。该接口既可以指向本机服务，也可以指向兼容的远程部署端点。
        </p>
      </div>

      <div className="rounded-xl border border-white/5 bg-[#141415] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3.5 w-3.5">
              {ollamaStatus === "online" && (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                </>
              )}
              {ollamaStatus === "offline" && (
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500"></span>
              )}
              {(ollamaStatus === "unknown" || ollamaStatus === "checking") && (
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 animate-pulse"></span>
              )}
            </span>
            <div>
              <div className="text-xs text-gray-400 font-semibold">Ollama 接口状态</div>
              <div className="text-sm font-bold text-white mt-0.5">{ollamaStatusMsg}</div>
            </div>
          </div>

          <button
            onClick={onCheckStatus}
            className="flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 px-3.5 py-2 text-xs font-bold text-gray-200 transition border border-white/10 cursor-pointer"
          >
            <RefreshCw size={13} className={ollamaStatus === "checking" ? "animate-spin" : ""} />
            检测状态
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/5 bg-[#141415] p-6 space-y-4">
        <div>
          <h4 className="text-xs font-bold text-white mb-1">同步 Ollama 模型列表</h4>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            从当前 Ollama 接口读取可用模型，并自动写入下方配置区。若该接口指向本机服务，通常返回的是本地已下载模型；若指向远程端点，则返回远程可调用模型。
          </p>
        </div>

        <button
          onClick={onSyncModels}
          disabled={isSyncing}
          className="flex items-center gap-2 rounded-md bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800/50 px-4 py-2.5 text-xs font-bold text-white shadow-lg transition-all cursor-pointer"
        >
          {isSyncing ? "正在同步模型..." : "查询当前 Ollama 模型并写入配置"}
        </button>
      </div>

      {ollamaConfig && (
        <ApiProviderCard
          config={ollamaConfig}
          isOllama={true}
          isSaved={!!savedStatus[ollamaConfig.id]}
          isCollapsed={!!collapsedModels[ollamaConfig.id]}
          onSave={() => onSave(ollamaConfig.id)}
          onFieldChange={(field, value) => onFieldChange(ollamaConfig.id, field, value)}
          onModelChange={(index, value) => onModelChange(ollamaConfig.id, index, value)}
          onAddModel={() => onAddModel(ollamaConfig.id)}
          onRemoveModel={(index) => onRemoveModel(ollamaConfig.id, index)}
          onToggleCollapse={() => onToggleCollapse(ollamaConfig.id)}
        />
      )}
    </div>
  );
}