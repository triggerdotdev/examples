import {
  OpenAILightIcon,
  SlackIcon,
  TriggerDotDevLightIcon,
} from "@trigger.dev/companyicons";

const logoStyles =
  "w-12 h-12 border border-slate-700 rounded-md bg-slate-800 p-2";
const plusStyles = "text-2xl text-slate-500";

export function PageHeader() {
  return (
    <>
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
    </>
  );
}
