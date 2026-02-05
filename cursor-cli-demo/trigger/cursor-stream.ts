import { streams } from "@trigger.dev/sdk";
import type { CursorEvent } from "@/lib/cursor-events";

export const cursorStream = streams.define<CursorEvent>({
  id: "cursor-events",
});
