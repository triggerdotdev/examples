"use client";

import { useState } from "react";
import { Button } from "./Button";
import { sendText } from "./_actions";
import { howYCombinatorStarted } from "./howYCombinatorStarted";
import { CheckIcon } from "./checkIcon";

const textLinkStyle =
  "hover:cursor-pointer underline underline-offset-2 decoration-slate-600 hover:decoration-slate-50 transition";

type State =
  | {
      status: "idle";
      text: string;
    }
  | {
      status: "submitting";
      text: string;
    }
  | {
      status: "processing";
      text: string;
      eventId: string;
    };

export default function SendTextForm() {
  const [formState, setFormState] = useState<State>({
    status: "idle",
    text: "",
  });

  const handleSubmit = () => {
    setFormState((s) => ({ status: "submitting", text: s.text }));
  };

  const handleReset = () => {
    setFormState({ status: "idle", text: "" });
  };

  async function action(data: FormData) {
    const text = data.get("text");
    if (text === null || typeof text !== "string" || text.trim() === "") {
      window.alert("Please enter some text before clicking Summarize.");
      return;
    }
    const event = await sendText(text);
    setFormState((s) => ({
      status: "processing",
      text: s.text,
      eventId: event.id,
    }));
  }

  const handleInventingOnPrincipleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    setFormState({ status: "idle", text: howYCombinatorStarted });
  };

  return (
    <>
      {formState.status === "idle" || formState.status === "submitting" ? (
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
              rows={16}
              name="text"
              value={formState.text}
              onChange={(e) =>
                setFormState({ status: "idle", text: e.target.value })
              }
              disabled={formState.status === "submitting"}
              placeholder="Paste some long text here or an article and click Summarize."
              className="text-white w-full bg-slate-800 rounded py-4 px-6 border border-slate-700"
            />
            <Button
              disabled={
                formState.text === "" || formState.status === "submitting"
              }
            >
              {formState.status === "idle" ? "✨ Summarize ✨" : "Loading..."}
            </Button>
          </form>
        </>
      ) : (
        <div className="bg-slate-800 p-10 max-w-lg items-center rounded-md border border-slate-700 flex flex-col gap-10">
          <CheckIcon />
          <p className="text-center text-slate-400">
            Summarizing {formState.text.slice(0, 20)}...
          </p>
          {formState.eventId}
          <Button onClick={handleReset}>Try again</Button>
        </div>
      )}
    </>
  );
}
