import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  DollarSign,
  Percent,
  Paintbrush,
  Filter,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function ToolbarDivider() {
  return <div className="w-px h-5 bg-border mx-1" />;
}

function ToolbarButton({ children }: { children: React.ReactNode }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-muted-foreground hover:text-foreground"
    >
      {children}
    </Button>
  );
}

export function Toolbar() {
  return (
    <div className="shrink-0 h-10 px-4 border-b border-border flex items-center gap-0.5 bg-background">
      {/* Text formatting */}
      <ToolbarButton>
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton>
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton>
        <Underline className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Alignment */}
      <ToolbarButton>
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton>
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton>
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Number formatting */}
      <ToolbarButton>
        <DollarSign className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton>
        <Percent className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Other tools */}
      <ToolbarButton>
        <Paintbrush className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton>
        <Filter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton>
        <MoreHorizontal className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}
