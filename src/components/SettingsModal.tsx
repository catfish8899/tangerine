// src/components/SettingsModal.tsx
// 设置面板主入口，负责组件组装与弹窗显隐控制

import { SettingsModalProps } from "./settings/types";
import { useSettingsManager } from "./settings/useSettingsManager";
import SettingsSidebar from "./settings/SettingsSidebar";
import SettingsHeader from "./settings/SettingsHeader";
import CloudModelsTab from "./settings/CloudModelsTab";
import OllamaModelsTab from "./settings/OllamaModelsTab";
import FormatSettingsTab from "./settings/FormatSettingsTab";

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  // 如果弹窗未打开，不渲染任何内容
  if (!isOpen) return null;

  // 获取所有状态和业务逻辑方法
  const {
    activeTab, setActiveTab,
    configs, savedStatus, collapsedModels,
    ollamaStatus, ollamaStatusMsg, isSyncing,
    fontSize, fontSizeSaved,
    cloudConfigs, ollamaConfig,
    checkOllamaStatus, syncOllamaModels,
    updateConfigField, handleModelChange, handleAddModel, handleRemoveModel,
    handleSaveConfig, handleAddConfigBlock, handleRemoveConfigBlock,
    handleSaveFontSize, toggleCollapse
  } = useSettingsManager(isOpen);

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#1c1c1d] select-text">
      <div className="w-full h-full flex overflow-hidden">

        {/* 左栏选项导航 */}
        <SettingsSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* 右侧主配置面板 */}
        <div className="flex-1 flex flex-col h-full bg-[#1e1e1f] overflow-hidden">
          
          {/* 顶栏标题区与关闭按钮 */}
          <SettingsHeader activeTab={activeTab} onClose={onClose} />

          {/* 内容滚动区域 */}
          <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-thin">
            {activeTab === "api" && (
              <CloudModelsTab
                cloudConfigs={cloudConfigs}
                totalConfigsCount={configs.length}
                savedStatus={savedStatus}
                collapsedModels={collapsedModels}
                onSave={handleSaveConfig}
                onDelete={handleRemoveConfigBlock}
                onAddBlock={handleAddConfigBlock}
                onFieldChange={updateConfigField}
                onModelChange={handleModelChange}
                onAddModel={handleAddModel}
                onRemoveModel={handleRemoveModel}
                onToggleCollapse={toggleCollapse}
              />
            )}

            {activeTab === "local" && (
              <OllamaModelsTab
                ollamaStatus={ollamaStatus}
                ollamaStatusMsg={ollamaStatusMsg}
                isSyncing={isSyncing}
                ollamaConfig={ollamaConfig}
                savedStatus={savedStatus}
                collapsedModels={collapsedModels}
                onCheckStatus={checkOllamaStatus}
                onSyncModels={syncOllamaModels}
                onSave={handleSaveConfig}
                onFieldChange={updateConfigField}
                onModelChange={handleModelChange}
                onAddModel={handleAddModel}
                onRemoveModel={handleRemoveModel}
                onToggleCollapse={toggleCollapse}
              />
            )}

            {activeTab === "format" && (
              <FormatSettingsTab
                fontSize={fontSize}
                fontSizeSaved={fontSizeSaved}
                onSaveFontSize={handleSaveFontSize}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}