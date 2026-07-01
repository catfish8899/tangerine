// src/components/automation/nodes/NodeSelect.tsx
import React from "react";

interface NodeSelectProps {
  value: string;
  options: Array<{ value: string; label: string }>;
  accentClass: string;
  onChange: (value: string) => void;
  onBeforeOpen?: () => void;
  disabled?: boolean;
}

export function NodeSelect({
  value,
  options,
  accentClass,
  onChange,
  onBeforeOpen,
  disabled = false
}: NodeSelectProps) {
  /**
   * 下拉选单展开前刷新选项。
   * 使用 pointer/mouse/focus 多事件兜底，兼容 Tauri WebView 中不同触发路径。
   */
  const handleBeforeOpen = () => {
    if (disabled) return;
    onBeforeOpen?.();
  };

  return (
    <select
      className={`nodrag mt-2 w-full rounded-lg border bg-black/25 px-2 py-1.5 text-[11px] outline-none ${accentClass} ${
        disabled ? "cursor-not-allowed opacity-60" : ""
      }`}
      value={value}
      onPointerDown={handleBeforeOpen}
      onMouseDown={handleBeforeOpen}
      onFocus={handleBeforeOpen}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
    >
      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
          className="bg-[#1f1f1f] text-gray-100"
        >
          {option.label}
        </option>
      ))}
    </select>
  );
}