"use client";

import { useState } from "react";
import { Button } from "./Button";
import { sendText } from "../_actions";
import { howYCombinatorStarted } from "./howYCombinatorStarted";

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
    };

export default function SendTextForm() {
  const [formState, setFormState] = useState<State>({
    status: "idle",
    text: "",
  });

  const handleSubmit = () => {
    setFormState((s) => ({ status: "submitting", text: s.text }));
  };

  const handleInventingOnPrincipleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    setFormState({ status: "idle", text: howYCombinatorStarted });
  };

  return (
    <>
      <p className="max-w-2xl text-center text-slate-400">
        Test it out by inserting the essay{" "}
        <a className={textLinkStyle} onClick={handleInventingOnPrincipleClick}>
          How Y Combinator Started
        </a>{" "}
        by Paul Graham.
      </p>
      <form
        action={sendText}
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
          disabled={formState.text === "" || formState.status === "submitting"}
        >
          {formState.status === "idle" ? "✨ Summarize ✨" : "Loading..."}
        </Button>
      </form>
    </>
  );
}
