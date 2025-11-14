import { cn } from "@/lib/utils";

interface UserMessageProps {
  content: string;
  className?: string;
}

export function UserMessage({ content, className }: UserMessageProps) {
  return (
    <div className={cn("flex justify-end animate-in fade-in slide-in-from-right-4 duration-300", className)}>
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-3 shadow-sm">
        <p className="text-sm leading-relaxed">{content}</p>
      </div>
    </div>
  );
}
