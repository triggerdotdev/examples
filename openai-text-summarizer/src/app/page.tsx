import {
  OpenAILightIcon,
  SlackIcon,
  TriggerDotDevLightIcon,
} from "@trigger.dev/companyicons";

export default function Home() {
  return (
    <main className="flex h-screen flex-col items-center justify-between p-24">
      <div className="flex gap-x-4 mb-2">
        <TriggerDotDevLightIcon className="w-8 h-8" />
        <p>+</p>
        <OpenAILightIcon className="w-8 h-8" />
        <p>+</p>
        <SlackIcon className="w-8 h-8" />
      </div>
      <form className="flex flex-col gap-y-4 pb-4 px-4">
        <p className="text-sm text-gray-500">
          Paste your article or text to summarise and click Summarize.
        </p>
        <textarea
          rows={10}
          name="to"
          placeholder="Enter a 'to' email address"
          className="text-black rounded p-1.5"
        />
        <button className="w-full rounded transition bg-indigo-600 hover:bg-indigo-500 h-10 font-bold mt-2">
          Summarize
        </button>
        <h1 className="font-semibold text-2xl text-center">
          Open AI Text Summarizer
        </h1>
      </form>
    </main>
  );
}
