"use client";

import { useState } from "react";
import { Button } from "./Button";
import { sendText } from "./_actions";
import { howYCombinatorStarted } from "./howYCombinatorStarted";
import { CheckIcon } from "./checkIcon";

const textLinkStyle =
  "hover:cursor-pointer underline underline-offset-2 decoration-slate-600 hover:decoration-slate-50 transition";

export default function SendTextForm() {
  const [isLoading, setHasSumbitted] = useState(false);

  const handleSubmit = () => {
    setHasSumbitted(true);
  };

  const handleReset = () => {
    setHasSumbitted(false);
    setText("");
  };

  async function action(data: FormData) {
    const text = data.get("text");
    if (text === null || typeof text !== "string" || text.trim() === "") {
      window.alert("Please enter some text before clicking Summarize.");
      return;
    }
    await sendText(text);
  }

  const [text, setText] = useState("");

  const handleInventingOnPrincipleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    setText(howYCombinatorStarted);
  };

  return (
    <>
      {isLoading ? (
        <div className="bg-slate-800 p-10 max-w-lg items-center rounded-md border border-slate-700 flex flex-col gap-10">
          <CheckIcon />
          <p className="text-center text-slate-400">
            Your text has been submitted and a message in Slack should appear in
            about 10 seconds.
          </p>
          <Button onClick={handleReset}>Try again</Button>
        </div>
      ) : (
        <>
          <p className="max-w-2xl text-center text-slate-400">
            Test it out by inserting the essay{" "}
            <a
              className={textLinkStyle}
              onClick={handleInventingOnPrincipleClick}
            >
              How Y Combinator Started
            </a>{" "}
            by Paul Graham.
          </p>
          <form
            action={action}
            onSubmit={handleSubmit}
            className="flex max-w-2xl flex-col gap-y-4 w-full"
          >
            <textarea
              rows={20}
              name="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste some long text here or an article and click Summarize."
              className="text-white w-full bg-slate-800 rounded py-4 px-6 border border-slate-700"
            />
            <Button>✨ Summarize ✨</Button>
          </form>
        </>
      )}
    </>
  );
}
