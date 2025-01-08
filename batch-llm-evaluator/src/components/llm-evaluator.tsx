"use client";

import { createAndRunEval } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  evaluateAnthropic,
  evaluateXAI,
  evaluateOpenAI,
  summarizeEvals,
  LLMProviders,
} from "@/trigger/batch";
import { useRealtimeRunsWithTag } from "@trigger.dev/react-hooks";
import { Sparkles } from "lucide-react";
import { useState } from "react";

import AnthropicEval from "@/components/evals/Anthropic";
import XIAEval from "@/components/evals/XAI";
import OpenAIEval from "@/components/evals/OpenAI";

export default function LLMEvaluator() {
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState<LLMProviders | undefined>(
    undefined
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [accessToken, setAccessToken] = useState<string | undefined>(undefined);
  const [evaluationId, setEvaluationId] = useState<string | undefined>(
    undefined
  );

  const { runs } = useRealtimeRunsWithTag<
    | typeof evaluateAnthropic
    | typeof evaluateXAI
    | typeof evaluateOpenAI
    | typeof summarizeEvals
  >(`eval:${evaluationId}`, {
    enabled: !!evaluationId,
    accessToken,
    baseURL: process.env.NEXT_PUBLIC_TRIGGER_API_URL,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSelectedModel(undefined);
    setIsSubmitted(false);
    const { evaluation, accessToken } = await createAndRunEval(prompt);

    setAccessToken(accessToken);
    setEvaluationId(evaluation.id);

    setIsLoading(false);
  };

  const handleSubmitEvaluation = () => {
    setIsSubmitted(true);
    console.log(
      `Submitted evaluation: ${selectedModel} was chosen as the best model.`
    );
  };

  const summarizeEvalsRun = runs.find(
    (run) => run.taskIdentifier === "summarize-evals"
  );

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-tr from-gray-900 via-gray-900/90 to-gray-900/80" />

      <div className="relative">
        {/* Header with gradient text */}
        <div className="border-b border-gray-800">
          <div className="container mx-auto px-4 py-6">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-gray-400">
              LLM Evaluator
            </h1>
          </div>
        </div>

        {/* Main content */}
        <div className="container mx-auto px-4 py-8 space-y-8">
          {/* Prompt input section */}
          <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
            <div className="space-y-2">
              <Label
                htmlFor="prompt"
                className="text-sm font-medium text-gray-300"
              >
                Enter your prompt:
              </Label>
              <div className="relative">
                <Textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[100px] bg-gray-900/50 backdrop-blur-sm border-gray-800 focus:border-gray-700 focus:ring-gray-700 resize-none"
                  placeholder="Type your prompt here..."
                  required
                />
                <div className="absolute inset-0 rounded-md pointer-events-none bg-gradient-to-tr from-gray-800/5 via-transparent to-transparent" />
              </div>
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className={cn(
                "w-full sm:w-auto transition-all duration-300",
                "bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800",
                "border border-gray-700 hover:border-gray-600",
                "text-gray-100 shadow-lg",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  <span>Evaluating...</span>
                </div>
              ) : (
                "Evaluate"
              )}
            </Button>
          </form>

          {/* Results section */}
          {runs.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-200">Results:</h2>
              <RadioGroup
                value={selectedModel}
                onValueChange={(value) =>
                  setSelectedModel(value as LLMProviders)
                }
                disabled={isSubmitted}
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
              >
                {runs.map((run) => {
                  switch (run.taskIdentifier) {
                    case "eval-anthropic": {
                      return (
                        <AnthropicEval
                          key={run.id}
                          run={run}
                          accessToken={accessToken!}
                          isSelected={selectedModel === "anthropic"}
                          tag={summarizeEvalsRun?.output?.anthropic}
                        />
                      );
                    }
                    case "eval-xai": {
                      return (
                        <XIAEval
                          key={run.id}
                          run={run}
                          accessToken={accessToken!}
                          isSelected={selectedModel === "xai"}
                          tag={summarizeEvalsRun?.output?.xai}
                        />
                      );
                    }
                    case "eval-openai": {
                      return (
                        <OpenAIEval
                          key={run.id}
                          run={run}
                          accessToken={accessToken!}
                          isSelected={selectedModel === "openai"}
                          tag={summarizeEvalsRun?.output?.openai}
                        />
                      );
                    }
                  }
                })}
              </RadioGroup>

              {/* Evaluation submission */}
              <div className="flex flex-col items-center gap-4 pt-4">
                {selectedModel && !isSubmitted && (
                  <>
                    <p className="text-sm text-gray-400">
                      You selected{" "}
                      <span className="font-medium text-gray-200">
                        {selectedModel}
                      </span>{" "}
                      as the best model.
                    </p>
                    <Button
                      onClick={handleSubmitEvaluation}
                      className={cn(
                        "transition-all duration-300",
                        "bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800",
                        "border border-gray-700 hover:border-gray-600",
                        "text-gray-100 shadow-lg"
                      )}
                    >
                      Submit Evaluation
                    </Button>
                  </>
                )}
                {isSubmitted && (
                  <div className="flex items-center gap-2 text-sm text-emerald-400">
                    <Sparkles className="w-4 h-4" />
                    <p>
                      Evaluation submitted successfully! You chose{" "}
                      <span className="font-medium">{selectedModel}</span> as
                      the best model.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
