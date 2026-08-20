"use client";

import { JSONUIProvider, Renderer } from "@json-render/react";
import { Component, type ReactNode, useMemo } from "react";
import { VisualizationElementKeyContext } from "@/components/visualization-element-key";
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

  componentDidCatch(error: unknown) {
    // Surface the cause in dev; without this a bad spec fails silently.
    console.error("Visualization render failed", error);
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

export function Visualization({
  spec,
  instanceKey,
}: {
  spec: VisualizationSpec;
  instanceKey: string;
}) {
  // A rejected spec latches the boundary's `failed` state. Key the boundary on
  // the spec's content so a repaired spec mounts a fresh instance instead of
  // staying stuck on the error, and so identical re-renders while streaming
  // don't remount it.
  const specKey = useMemo(() => JSON.stringify(spec), [spec]);
  const resolveElementKey = useMemo(() => {
    const byIdentity = new WeakMap<object, string>();
    const byFingerprint = new Map<string, string>();

    for (const [elementKey, element] of Object.entries(spec.elements)) {
      const persistedKey = `${instanceKey}:${elementKey}`;
      byIdentity.set(element.props, persistedKey);
      // json-render can clone an element when it resolves bound props. Quiz
      // specs do not use bindings, but this deterministic fallback keeps the
      // persisted key stable if that changes later.
      byFingerprint.set(JSON.stringify(element.props), persistedKey);
    }

    return (element: object) =>
      byIdentity.get(element) ??
      byFingerprint.get(JSON.stringify(element)) ??
      `${instanceKey}:unknown`;
  }, [instanceKey, spec]);

  return (
    <div>
      <VisualizationErrorBoundary key={specKey}>
        <VisualizationElementKeyContext.Provider value={resolveElementKey}>
          <JSONUIProvider registry={registry}>
            <Renderer spec={spec} registry={registry} />
          </JSONUIProvider>
        </VisualizationElementKeyContext.Provider>
      </VisualizationErrorBoundary>
    </div>
  );
}
