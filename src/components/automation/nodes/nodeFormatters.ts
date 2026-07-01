// src/components/automation/nodes/nodeFormatters.ts
import type { Role } from "../../../types/chat";

/**
 * 兼容读取角色提示词。
 * 当前项目 Role 类型中不一定叫 prompt，因此这里优先读取 systemPrompt，
 * 同时兼容历史数据或其他分支里可能出现的 prompt / description 字段。
 */
export function getRolePromptText(role: Role): string {
  const roleRecord = role as unknown as {
    systemPrompt?: unknown;
    prompt?: unknown;
    description?: unknown;
  };

  const value =
    roleRecord.systemPrompt ??
    roleRecord.prompt ??
    roleRecord.description ??
    "";

  return typeof value === "string" ? value : String(value || "");
}

/**
 * 数字补零。
 */
export function pad2(value: number | string) {
  return String(value).padStart(2, "0");
}

/**
 * 将日期格式化为中文日期。
 */
export function formatChineseDate(date: Date) {
  return `${date.getFullYear()}年${pad2(date.getMonth() + 1)}月${pad2(
    date.getDate()
  )}日`;
}

/**
 * 构建日期下拉选项。
 * 默认提供今天起未来 365 天，避免定时节点使用自由输入。
 */
export function buildDateOptions(days = 365) {
  const today = new Date();
  const options: Array<{ value: string; label: string }> = [];

  for (let index = 0; index <= days; index += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + index);

    const value = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
      date.getDate()
    )}`;

    let label = formatChineseDate(date);
    if (index === 0) label = `今天 · ${label}`;
    if (index === 1) label = `明天 · ${label}`;

    options.push({ value, label });
  }

  return options;
}

/**
 * 将日期 value 转为中文日期。
 */
export function dateValueToChineseDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return formatChineseDate(new Date());
  return `${year}年${month}月${day}日`;
}

/**
 * 获取定时节点的默认时间选择值。
 */
export function getDefaultTimerParts() {
  const now = new Date();
  const hour24 = now.getHours();
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  return {
    dateValue: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(
      now.getDate()
    )}`,
    period,
    hour12: String(hour12),
    minute: pad2(now.getMinutes()),
    second: pad2(now.getSeconds())
  };
}

/**
 * 根据定时节点的结构化字段生成最终展示/持久化文本。
 */
export function buildTimerText(parts: {
  dateValue: string;
  period: string;
  hour12: string;
  minute: string;
  second: string;
}) {
  const periodText = parts.period === "PM" ? "下午" : "上午";

  return `${dateValueToChineseDate(parts.dateValue)} ${periodText} ${Number(
    parts.hour12 || 1
  )}:${pad2(parts.minute || 0)}:${pad2(parts.second || 0)}`;
}