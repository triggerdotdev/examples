"use client";

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
import { deepResearch } from "@/trigger/deepResearch";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRealtimeTaskTrigger } from "@trigger.dev/react-hooks";
import { Search } from "lucide-react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { parseStatus, ProgressMetadata } from "@/lib/schemas";

const formSchema = z.object({
  prompt: z
    .string()
    .min(1, {
      message: "Research prompt must be at least 30 characters.",
    })
    .max(1000, {
      message: "Research prompt must be less than 1000 characters.",
    }),
});

export function DeepResearchAgent({ triggerToken }: { triggerToken: string }) {
  const triggerInstance = useRealtimeTaskTrigger<typeof deepResearch>(
    "deep-research",
    {
      accessToken: triggerToken,
      baseURL: process.env.NEXT_PUBLIC_TRIGGER_API_URL,
    }
  );

  const run = triggerInstance.run;

  const status: ProgressMetadata = {
    status: {
      progress: 0,
      label: " ",
    },
  };

  if (run?.metadata) {
    const {
      status: { progress, label },
    } = parseStatus(run.metadata);
    status.status.progress = progress;
    status.status.label = label;
  }

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: "",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    console.log("values", triggerInstance.run);
    triggerInstance.submit({ prompt: values.prompt });
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
                  {run?.id ? `Research: "${run.id}"` : "New Research"}
                </CardTitle>
                <CardDescription>{run?.status}</CardDescription>
              </div>
              <StatusBadge label={run?.status || " "} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {(!run || run.status !== "COMPLETED") && (
              <Form {...form}>
                <form className="space-y-6">
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
                    onClick={form.handleSubmit(onSubmit)}
                    disabled={!form.formState.isValid}
                    className="w-full"
                  >
                    <Search className="w-4 h-4 mr-2" />
                    Start Deep Research
                  </Button>
                </form>
              </Form>
            )}

            <ProgressSection
              status={run?.status || " "}
              progress={status.status.progress}
              message={status.status.label}
            />

            {run?.status === "COMPLETED" && (
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

            {run?.status === "FAILED" && (
              <div className="space-y-4 text-center">
                <h3 className="text-2xl font-bold text-destructive">
                  Research Failed
                </h3>
                <p>Unfortunately, the research could not be completed.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
