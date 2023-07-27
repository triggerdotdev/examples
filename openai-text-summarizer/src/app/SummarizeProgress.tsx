"use client";

import { useEventRunDetails, useTriggerProvider } from "@trigger.dev/react";
import { ButtonLink } from "./Button";
import { CompanyIcon } from "@trigger.dev/companyicons";
import { Spinner } from "./Spinner";
import { CheckCircleIcon } from "@heroicons/react/24/solid";

export function SummarizeProgress({ eventId }: { eventId: string }) {
  const { isLoading, isError, data, error } = useEventRunDetails(eventId);

  if (isLoading || !data) {
    return <Loading />;
  }

  if (isError) {
    return <p>Error</p>;
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {!data.tasks || data.tasks.length === 0 ? (
          <Loading />
        ) : (
          data.tasks.map((task) => (
            <div key={task.id} className="flex gap-2 items-center">
              {task.status === "RUNNING" ? (
                <Spinner className="w-6 h-6" />
              ) : (
                <CheckCircleIcon className="w-6 h-6 text-emerald-600" />
              )}
              <div className="flex gap-2 items-center">
                {task.icon && (
                  <CompanyIcon
                    name={task.icon}
                    className="w-4 h-4"
                    variant="light"
                  />
                )}
                <h4>{task.displayKey ?? task.name}</h4>
              </div>
            </div>
          ))
        )}
      </div>
      {data.output && (
        <div className="flex flex-col gap-2">
          <h4 className="text-base font-semibold">Posted to Slack</h4>
          <p className="text-slate-400 text-sm mb-2">{data.output.summary}</p>
          <ButtonLink href={"/"}>Summarize another</ButtonLink>
        </div>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center">
      <Spinner className="w-6 h-6" />
    </div>
  );
}
