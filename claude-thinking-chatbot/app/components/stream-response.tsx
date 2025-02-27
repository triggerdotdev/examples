"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { claudeStream, STREAMS } from "@/src/trigger/claude-stream";
import { useRealtimeRunWithStreams } from "@trigger.dev/react-hooks";
import { useEffect, useRef } from "react";

interface StreamResponseProps {
  runId: string;
  accessToken: string;
}

export function StreamResponse({ runId, accessToken }: StreamResponseProps) {
  const hasCalledCompleteRef = useRef(false);

  const { streams, run } = useRealtimeRunWithStreams<
    typeof claudeStream,
    STREAMS
  >(runId, { accessToken });

  // Debug what's coming in
  useEffect(() => {
    console.log("Streams:", streams);
  }, [streams]);

  // Check if the run has completed
  useEffect(() => {
    if (run?.status === "COMPLETED") {
      console.log("Run completed:", run);
      hasCalledCompleteRef.current = true;
    }
  }, [run?.status]);

  const displayText = streams?.text ?? "";
  const reasoning = streams?.reasoning ?? "";

  return (
    <div className="flex justify-start">
      <div className="flex items-start gap-3 max-w-[80%]">
        <Avatar className="mt-0.5 border">
          <AvatarFallback className="bg-black text-white">AI</AvatarFallback>
          <AvatarImage src="" />
        </Avatar>

        <div className="bg-muted rounded-lg px-4 py-2 whitespace-pre-wrap break-words">
          {reasoning && displayText ? (
            <div className="flex flex-col gap-2">
              <span className="italic text-muted-foreground">{reasoning}</span>
              <span> {displayText}</span>
            </div>
          ) : (
            "Thinking..."
          )}
        </div>
      </div>
    </div>
  );
}
