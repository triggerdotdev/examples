"use client";

import { JSONUIProvider, Renderer } from "@json-render/react";
import type { VisualizationSpec } from "@/lib/catalog";
import { registry } from "@/lib/registry";

export function Visualization({ spec }: { spec: VisualizationSpec }) {
  return (
    <div className="my-3">
      <JSONUIProvider registry={registry}>
        <Renderer spec={spec} registry={registry} />
      </JSONUIProvider>
    </div>
  );
}
