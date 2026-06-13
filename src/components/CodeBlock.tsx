import { useState, useRef } from "react";
import { Copy, Check } from "lucide-react";

interface CodeBlockProps {
  children: React.ReactNode;
  className?: string;
}

export default function CodeBlock({ children, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLPreElement>(null);

  const handleCopy = async () => {
    if (codeRef.current) {
      const text = codeRef.current.innerText || "";
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative group my-4 rounded-lg border border-white/10 bg-black/30 overflow-hidden shadow-md">
      {/* 代码框头部工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5 text-[10px] text-gray-400 font-mono">
        <span>{className?.replace("language-", "") || "code"}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check size={11} className="text-green-400" />
              <span className="text-green-400">已复制!</span>
            </>
          ) : (
            <>
              <Copy size={11} />
              <span>复制代码</span>
            </>
          )}
        </button>
      </div>
      {/* 代码内容区 */}
      <pre ref={codeRef} className={`${className || ""} p-4 font-mono text-xs overflow-x-auto text-gray-200 leading-relaxed scrollbar-thin`}>
        {children}
      </pre>
    </div>
  );
}
