import { SummarizeProgress } from "@/app/SummarizeProgress";
import {
  OpenAILightIcon,
  SlackIcon,
  TriggerDotDevLightIcon,
} from "@trigger.dev/companyicons";

const logoStyles =
  "w-12 h-12 border border-slate-700 rounded-md bg-slate-800 p-2";
const plusStyles = "text-2xl text-slate-500";

export default function Page({
  params: { eventId },
}: {
  params: { eventId: string };
}) {
  return (
    <main className="h-screen w-full bg-slate-900">
      <div className="flex flex-col gap-y-6 mx-auto items-center pt-40">
        <div className="flex gap-x-4 mb-2 items-center">
          <TriggerDotDevLightIcon className={logoStyles} />
          <p className={plusStyles}>+</p>
          <OpenAILightIcon className={logoStyles} />
          <p className={plusStyles}>+</p>
          <SlackIcon className={logoStyles} />
        </div>
        <h1 className="font-medium font-sans max-w-2xl text-3xl text-center">
          Summarize an article using Open AI and post the result to a Slack
          channel
        </h1>

        <div className="bg-slate-800 p-10 max-w-2xl items-center rounded-md border border-slate-700 flex flex-col gap-10 w-full">
          <SummarizeProgress eventId={eventId} />
        </div>
      </div>
    </main>
  );
}
