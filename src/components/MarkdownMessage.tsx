// src/components/MarkdownMessage.tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import CodeBlock from "./CodeBlock";

interface MarkdownMessageProps {
  text: string;
  fontSize?: string; // 👈 动态传入当前字号
}

export default function MarkdownMessage({ text, fontSize = "12px" }: MarkdownMessageProps) {
  // 根据主字体大小，推算行内代码和不同阶标题的适当大小
  const numericSize = parseFloat(fontSize);
  const unit = fontSize.replace(/[0-9.]/g, "");
  
  const inlineCodeSize = `${numericSize * 0.9}${unit}`;
  const h3Size = `${numericSize * 1.05}${unit}`;
  const h2Size = `${numericSize * 1.15}${unit}`;
  const h1Size = `${numericSize * 1.3}${unit}`;

  return (
    <div className="markdown-body text-gray-200 space-y-2 select-text" style={{ fontSize: fontSize }}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]} 
        rehypePlugins={[rehypeHighlight]}
        components={{
          // 重写 pre 组件，引入解耦后的带复制功能代码框
          pre: ({ children }) => {
            const codeProps = (children as any)?.props || {};
            const className = codeProps.className || "";
            return (
              <CodeBlock className={className} fontSize={fontSize}>
                {codeProps.children || children}
              </CodeBlock>
            );
          },
          // 自定义行内代码样式
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            return isInline ? (
              <code 
                {...props} 
                className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-orange-300"
                style={{ fontSize: inlineCodeSize }}
              >
                {children}
              </code>
            ) : (
              <code {...props} className={`${className} block font-mono`}>
                {children}
              </code>
            );
          },
          // 优化段落外边距
          p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
          // 样式化超链接
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-[#4ea1db] hover:underline">
              {children}
            </a>
          ),
          // 列表样式美化
          ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          // 表格样式美化
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 border border-[#3e3e3e] rounded-lg">
              <table className="w-full text-left border-collapse" style={{ fontSize: inlineCodeSize }}>{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-[#1e1e1e] border-b border-[#3e3e3e]">{children}</thead>,
          th: ({ children }) => <th className="p-2 font-semibold text-gray-300">{children}</th>,
          td: ({ children }) => <td className="p-2 border-t border-[#3e3e3e] text-gray-400">{children}</td>,
          // 标题级别美化
          h1: ({ children }) => <h1 className="font-bold text-white mt-4 mb-2" style={{ fontSize: h1Size }}>{children}</h1>,
          h2: ({ children }) => <h2 className="font-bold text-white mt-3 mb-1.5" style={{ fontSize: h2Size }}>{children}</h2>,
          h3: ({ children }) => <h3 className="font-bold text-white mt-2 mb-1" style={{ fontSize: h3Size }}>{children}</h3>,
          blockquote: ({ children }) => <blockquote className="border-l-4 border-amber-500 bg-white/5 pl-3 py-1.5 my-2 italic text-gray-400 rounded-r">{children}</blockquote>,
        }}
      >
        {text || ""}
      </ReactMarkdown>
    </div>
  );
}
