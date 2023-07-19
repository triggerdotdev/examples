import {
  OpenAILightIcon,
  SlackIcon,
  TriggerDotDevLightIcon,
} from "@trigger.dev/companyicons";
import Form from "./Form";

export default function Home() {
  return (
    <main className="flex h-screen flex-col gap-y-4 items-center justify-center bg-slate-900">
      <div className="flex gap-x-4 mb-2">
        <TriggerDotDevLightIcon className="w-8 h-8" />
        <p>+</p>
        <OpenAILightIcon className="w-8 h-8" />
        <p>+</p>
        <SlackIcon className="w-8 h-8" />
      </div>
      <h1 className="font-medium text-3xl text-center">
        Open AI Text Summarizer
      </h1>
      <Form />
    </main>
  );
}
