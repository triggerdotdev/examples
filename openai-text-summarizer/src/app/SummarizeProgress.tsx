"use client";

import { useEventRunDetails, useTriggerProvider } from "@trigger.dev/react";
import { ButtonLink } from "./Button";
import { CompanyIcon } from "@trigger.dev/companyicons";
import { Spinner } from "./Spinner";
import { CheckCircleIcon } from "@heroicons/react/24/solid";

export function SummarizeProgress({ eventId }: { eventId: string }) {
  const { isLoading, isError, data, error } = useEventRunDetails(eventId);

  if (isError) {
    return <p>Error</p>;
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <>
          <ProgressItem
            completed={data?.tasks !== undefined && data.tasks.length > 0}
            name="Starting up"
          />
          {data?.tasks?.map((task) => (
            <ProgressItem
              key={task.id}
              completed={task.status === "COMPLETED"}
              name={task.displayKey ?? task.name ?? ""}
              icon={task.icon}
            />
          ))}
        </>
      </div>
      {data?.output && (
        <div className="flex flex-col gap-0.5">
          <h4 className="text-base font-semibold">Posted to Slack</h4>
          <p className="text-slate-400 text-sm mb-4">{data.output.summary}</p>
          <ButtonLink href={"/"}>Summarize another</ButtonLink>
        </div>
      )}
    </div>
  );
}

type ProgressItemProps = {
  icon?: string;
  completed: boolean;
  name: string;
};

function ProgressItem({ icon, completed, name }: ProgressItemProps) {
  return (
    <div className="flex gap-2 items-center">
      {completed ? (
        <CheckCircleIcon className="w-6 h-6 text-emerald-600" />
      ) : (
        <Spinner className="w-6 h-6" />
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
