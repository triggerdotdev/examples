"use client";

import { useEventRunDetails, useTriggerProvider } from "@trigger.dev/react";
import { ButtonLink } from "./Button";

export function SummarizeProgress({ eventId }: { eventId: string }) {
  const { isLoading, isError, data, error } = useEventRunDetails(eventId);

  if (isLoading) {
    return <p>Loading...</p>;
  }

  if (isError) {
    return <p>Error</p>;
  }

  if (!data) {
    return <p>Loading...</p>;
  }

  return (
    <>
      <div>Run status: {data.status}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
        {data.tasks?.map((task) => (
          <div
            key={task.id}
            style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}
          >
            <h4>{task.displayKey ?? task.name}</h4>
            <p>{task.icon}</p>
            <p>Status: {task.status}</p>
          </div>
        ))}
      </div>
      {data.output && (
        <code>
          <pre>{JSON.stringify(data.output, null, 2)}</pre>
        </code>
      )}
      <ButtonLink href={"/"}>Try again</ButtonLink>
    </>
  );
}

type ProcessingStepProps = {
  icon?: string;
  state: "idle" | "submitting" | "processing";
  title: string;
};

function ProcessingStep({ icon }: ProcessingStepProps) {}
