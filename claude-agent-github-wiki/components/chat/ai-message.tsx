import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface AiMessageProps {
  content: string;
  className?: string;
}

export function AiMessage({ content, className }: AiMessageProps) {
  return (
    <div className={cn("flex justify-start animate-in fade-in slide-in-from-left-4 duration-300", className)}>
      <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-muted px-4 py-3 shadow-sm">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
              ul: ({ children }) => <ul className="my-2 ml-4 list-disc space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="my-2 ml-4 list-decimal space-y-1">{children}</ol>,
              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              code: ({ children, ...props }) => {
                const isInline = !props.className;
                return isInline ? (
                  <code className="bg-secondary px-1.5 py-0.5 rounded text-sm">{children}</code>
                ) : (
                  <code className="block bg-secondary p-3 rounded-lg my-2 overflow-x-auto text-sm" {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
