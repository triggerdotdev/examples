"use client";

import { useTaskTrigger } from "@trigger.dev/react-hooks";
import { RefreshCw, Send } from "lucide-react";
import { useState } from "react";
import type { generateImage } from "../trigger/generate-images";
import { GeneratedCard } from "./GeneratedCard";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

interface CustomPromptCardProps {
  id: string;
  fileUrl?: string;
  generateToken?: string;
}

export default function CustomPromptCard({
  id,
  fileUrl,
  generateToken,
}: CustomPromptCardProps) {
  // Subscribe to the run if we have a runId and token
  const { submit, handle, error, isLoading } = useTaskTrigger<
    typeof generateImage
  >("generate-image", {
    accessToken: generateToken,
    enabled: !!generateToken,
  });

  const [customPrompt, setCustomPrompt] = useState("");

  return handle ? (
    <GeneratedCard
      id={id}
      accessToken={handle.publicAccessToken}
      runId={handle.id}
      promptTitle="Custom Prompt"
    />
  ) : (
    <Card
      className={`aspect-[3/4] ${
        fileUrl
          ? "border transition-colors relative overflow-hidden group bg-card p-0"
          : "border transition-colors relative overflow-hidden group bg-card p-0"
      }`}
    >
      <div className="h-full flex flex-col p-4">
        <div className="flex-1 flex flex-col justify-center">
          {fileUrl ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit({
                  id,
                  baseImageUrl: fileUrl ?? "",
                  promptStyle: "custom",
                  customPrompt,
                });
              }}
              className="space-y-4"
            >
              <div className="flex flex-col gap-2 items-center">
                <label
                  htmlFor="custom-prompt"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  Add another product shot
                </label>
                <textarea
                  id="custom-prompt"
                  placeholder="e.g. 'product being used by someone outdoors'"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  disabled={isLoading}
                  className="w-full h-48 p-3 text-sm border border-input bg-transparent rounded-md shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  rows={3}
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 gap-2"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <div className="text-center text-xs text-muted-foreground">
              Upload an image to enable custom prompts
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
