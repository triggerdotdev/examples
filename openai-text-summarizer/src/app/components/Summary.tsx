"use client";

import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";
import { CompanyIcon } from "@trigger.dev/companyicons";
import { useEventRunDetails } from "@trigger.dev/react";
import { ButtonLink } from "./Button";
import { Spinner } from "./Spinner";

export function Summary({ eventId }: { eventId: string }) {
  const { isLoading, isError, data, error } = useEventRunDetails(eventId);

  if (isError) {
    return <p>Error</p>;
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <>
          <ProgressItem
            state={
              data?.tasks === undefined || data.tasks.length === 0
                ? "progress"
                : "completed"
            }
            name="Starting up"
          />
          {data?.tasks?.map((task) => (
            <ProgressItem
              key={task.id}
              state={
                task.status === "COMPLETED"
                  ? "completed"
                  : task.status === "ERRORED"
                  ? "failed"
                  : "progress"
              }
              name={task.displayKey ?? task.name ?? ""}
              icon={task.icon}
            />
          ))}
        </>
      </div>
      {data?.output && data.status === "SUCCESS" && (
        <div className="flex flex-col gap-0.5">
          <h4 className="text-base font-semibold">Posted to Slack</h4>
          <p className="text-slate-400 text-sm mb-4">{data.output.summary}</p>
        </div>
      )}
      {(data?.status === "SUCCESS" || data?.status === "FAILURE") && (
        <ButtonLink href={"/"}>Summarize another</ButtonLink>
      )}
    </div>
  );
}

type ProgressItemProps = {
  icon?: string;
  state: "progress" | "completed" | "failed";
  name: string;
};

function ProgressItem({ icon, state, name }: ProgressItemProps) {
  return (
    <div className="flex gap-2 items-center">
      {state === "progress" ? (
        <Spinner className="w-6 h-6" />
      ) : state === "completed" ? (
        <CheckCircleIcon className="w-6 h-6 text-emerald-600" />
      ) : (
        <XCircleIcon className="w-6 h-6 text-red-600" />
      )}
      <div className="flex gap-1.5 items-center">
        {icon && (
          <CompanyIcon name={icon} className="w-5 h-5" variant="light" />
        )}
        <h4 className="text-base">{name}</h4>
      </div>
    </div>
  );
}
