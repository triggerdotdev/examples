"use client";

import { sendText } from "./_actions";

export default function SendTextForm() {
  async function action(data: FormData) {
    const text = data.get("text");
    if (text === null || typeof text !== "string" || text.trim() === "") {
      window.alert("Please enter some text before clicking Summarize.");
      return;
    }
    await sendText(text);
    console.log(text);
  }
  return (
    <form action={action} className="flex flex-col gap-y-4 w-full max-w-lg">
      <textarea
        rows={10}
        name="text"
        placeholder="Paste some text or an article and click Summarize."
        className="text-white w-full bg-slate-800 rounded py-4 px-6 border border-slate-700"
      />
      <button className="w-full rounded transition bg-indigo-600 hover:bg-indigo-500 h-10 font-semibold">
        Summarize
      </button>
    </form>
  );
}
