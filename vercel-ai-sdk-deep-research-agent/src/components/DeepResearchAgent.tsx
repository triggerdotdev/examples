"use client";

import { deepResearchAction } from "@/app/actions/deep-research";
import { ProgressSection } from "@/components/progress-section";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeDeepResearch } from "@/hooks/useRealtimeDeepResearch";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search } from "lucide-react";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

const formSchema = z.object({
  prompt: z
    .string()
    .min(30, {
      message: "Research prompt must be at least 50 characters.",
    })
    .max(1000, {
      message: "Research prompt must be less than 1000 characters.",
    }),
});

export default function DeepResearchAgent() {
  const [runHandle, setRunHandle] = useState<{
    id: string;
    publicAccessToken: string;
  } | null>(null);

  const { progress, label } = useRealtimeDeepResearch(runHandle?.id);

  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: "",
    },
  });

  const onSubmit = useCallback(
    async (values: z.infer<typeof formSchema>) => {
      if (runHandle && progress !== 100) {
        return;
      }

      try {
        const handle = await deepResearchAction(values.prompt);
        setRunHandle(handle);
        form.reset();
        toast({
          title: "Research started",
          description: "Your deep research request has been submitted.",
        });
      } catch (error) {
        toast({
          title: "Failed to start research",
          description:
            error instanceof Error
              ? error.message
              : "An unknown error occurred.",
          variant: "destructive",
        });
      }
    },
    [toast, form, progress, runHandle]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.handleSubmit(onSubmit)();
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-2 mb-8">
          <Search className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Deep Research Agent</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>
                  {runHandle?.id
                    ? `Research: "${runHandle.id}"`
                    : "New Research"}
                </CardTitle>
                <CardDescription>{label}</CardDescription>
              </div>
              <StatusBadge label={label} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {(!runHandle || progress !== 100) && (
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                  <FormField
                    control={form.control}
                    name="prompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Research Prompt</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter your research question or topic here... (Press Enter to start)"
                            className="min-h-[120px] resize-none"
                            onKeyDown={handleKeyDown}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Describe what you'd like to research. Be specific for
                          better results.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    disabled={
                      !form.formState.isValid || form.formState.isSubmitting
                    }
                    className="w-full"
                  >
                    <Search className="w-4 h-4 mr-2" />
                    Start Deep Research
                  </Button>
                </form>
              </Form>
            )}

            <ProgressSection
              status={label}
              progress={progress}
              message={label}
            />

            {progress === 100 && (
              <div className="space-y-4 text-center">
                <h3 className="text-2xl font-bold">Research Complete!</h3>
                <p>
                  Your detailed research report is ready. You can view and
                  download it now.
                </p>
                <Button asChild>
                  <a href={""} target="_blank" rel="noopener noreferrer">
                    View Final Report
                  </a>
                </Button>
              </div>
            )}

            {progress === 100 && (
              <div className="space-y-4 text-center">
                <h3 className="text-2xl font-bold text-destructive">
                  Research Failed
                </h3>
                <p>Unfortunately, the research could not be completed.</p>
                <Button
                  onClick={() => {
                    setRunHandle(null);
                    form.reset();
                  }}
                >
                  Start a New Research
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
