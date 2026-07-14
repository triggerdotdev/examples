"use client";

import { JSONUIProvider, Renderer } from "@json-render/react";
import { Component, type ReactNode } from "react";
import type { VisualizationSpec } from "@/lib/catalog";
import { registry } from "@/lib/registry";

// Specs render as soon as they finish streaming — before the tool's
// validation result lands — so a bad spec must degrade to an inline
// message rather than crash the chat.
class VisualizationErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="my-3 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          Couldn&apos;t render this visualization.
        </div>
      );
    }
    return this.props.children;
  }
}

export function Visualization({ spec }: { spec: VisualizationSpec }) {
  return (
    <div className="my-3">
      <VisualizationErrorBoundary>
        <JSONUIProvider registry={registry}>
          <Renderer spec={spec} registry={registry} />
        </JSONUIProvider>
      </VisualizationErrorBoundary>
    </div>
  );
}
