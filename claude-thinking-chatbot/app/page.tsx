"use client";

import { useState } from "react";
import { ClaudeChat } from "./components/claude-chat";
import { streamWithClaude } from "./actions";

export default function ClaudeChatPage() {
  const [runId, setRunId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const handleStartChat = async (prompt: string) => {
    setIsInitializing(true);
    try {
      const { run, publicAccessToken } = await streamWithClaude(prompt);
      setRunId(run.id);
      setAccessToken(publicAccessToken);
    } catch (error) {
      console.error("Error starting chat:", error);
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <>
      {runId && accessToken ? (
        <ClaudeChat runId={runId} accessToken={accessToken} />
      ) : (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
          <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
            <h1 className="text-2xl font-bold mb-4">
              Start a Chat with Claude
            </h1>
            <p className="mb-4">
              Enter your first message to begin chatting with Claude.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const prompt = formData.get("prompt") as string;
                if (prompt.trim()) {
                  handleStartChat(prompt);
                }
              }}
              className="space-y-4"
            >
              <textarea
                name="prompt"
                className="w-full p-2 border border-gray-300 rounded-md"
                rows={4}
                placeholder="Type your message here..."
                disabled={isInitializing}
              />
              <button
                type="submit"
                className="w-full py-2 px-4 bg-black text-white rounded-md hover:bg-black/90 transition-colors"
                disabled={isInitializing}
              >
                {isInitializing ? "Starting chat..." : "Start Chat"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
