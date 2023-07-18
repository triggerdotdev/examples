import {
  OpenAILightIcon,
  SlackIcon,
  TriggerDotDevLightIcon,
} from "@trigger.dev/companyicons";

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
      <form className="flex flex-col gap-y-4 w-full max-w-lg">
        <textarea
          rows={10}
          name="to"
          placeholder="Paste some text or an article and click Summarize."
          className="text-white w-full bg-slate-800 rounded py-4 px-6 border border-slate-700"
        />
        <button className="w-full rounded transition bg-indigo-600 hover:bg-indigo-500 h-10 font-semibold">
          Summarize
        </button>
      </form>
    </main>
  );
}
