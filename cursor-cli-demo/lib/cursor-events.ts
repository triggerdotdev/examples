/** Event types emitted by cursor-agent --output-format stream-json */

export type CursorEvent =
  | SystemEvent
  | UserEvent
  | AssistantEvent
  | ToolCallEvent
  | ResultEvent;

export type SystemEvent = {
  type: "system";
  subtype: "init";
  model: string;
  cwd: string;
  session_id: string;
  apiKeySource?: string;
  permissionMode?: string;
};

export type UserEvent = {
  type: "user";
  message: {
    role: "user";
    content: Array<{ type: string; text: string }>;
  };
  session_id: string;
};

export type AssistantEvent = {
  type: "assistant";
  message: {
    role: "assistant";
    content: Array<{ type: string; text: string }>;
  };
  session_id: string;
};

export type ToolCallKind =
  | "shellToolCall"
  | "readToolCall"
  | "editToolCall"
  | "writeToolCall"
  | "deleteToolCall"
  | "grepToolCall"
  | "lsToolCall"
  | "globToolCall"
  | "todoToolCall";

export type ToolCallEvent = {
  type: "tool_call";
  subtype: "started" | "completed";
  call_id: string;
  tool_call: Partial<Record<ToolCallKind, { args?: Record<string, unknown>; result?: Record<string, unknown> }>>;
  session_id: string;
};

export type ResultEvent = {
  type: "result";
  subtype: "success" | "error";
  duration_ms: number;
  duration_api_ms?: number;
  is_error: boolean;
  result: string;
  session_id: string;
};

const knownTypes = new Set(["system", "user", "assistant", "tool_call", "result"]);

/** Parse raw JSON into a CursorEvent, returns null for unknown types */
export function parseCursorEvent(data: unknown): CursorEvent | null {
  if (typeof data !== "object" || data === null || !("type" in data)) return null;
  const typed = data as { type: string };
  if (!knownTypes.has(typed.type)) return null;
  return data as CursorEvent;
}

/** Extract the tool name from a tool_call event */
export function getToolName(event: ToolCallEvent): ToolCallKind | "unknown" {
  const keys = Object.keys(event.tool_call) as ToolCallKind[];
  return keys[0] ?? "unknown";
}

/** Extract the tool args from a tool_call event */
export function getToolArgs(event: ToolCallEvent): Record<string, unknown> {
  const name = getToolName(event);
  if (name === "unknown") return {};
  return event.tool_call[name]?.args ?? {};
}
