"use client";

import { TriggerChatTransport } from "@trigger.dev/sdk/chat";
import { useEffect, useRef, useState } from "react";
import { Buddy } from "./buddy";

// The Recall bot loads this page twice:
// - view=camera: the agent's own tile. It watches the agent's session on Trigger.dev, and when
//   the agent has something to say it waits for a pause in the meeting, then speaks.
// - view=screen: the lead brief the agent screenshares. Silent; it only shows the latest brief.

// What present_lead returns: the email as it arrived and the CRM record as stored. Nothing model-written.
type Crm = { company: string; contact?: string; plan?: string; usage?: string; openDeal?: string; notes?: string };
type Lead = { email: { from: string; subject: string; body: string }; crm: Crm | null };
type Draft = { to: string; subject: string; body: string };
type Status = "listening" | "thinking" | "waiting" | "speaking";

const PAUSE_MS = 1200; // the room must be quiet this long before the agent speaks
const VOICE_LEVEL = 0.015; // RMS above this counts as someone talking
const REPLAY_WINDOW_MS = 2500; // chunks that arrive right after connecting are old turns being replayed
const LEAD_TOOLS = new Set(["present_lead", "show_on_screen"]);

export default function BotPage() {
  const [view, setView] = useState<"camera" | "screen">("camera");
  const [agentName, setAgentName] = useState("Scout");
  const [status, setStatus] = useState<Status>("listening");
  const [lead, setLead] = useState<Lead | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [screenMode, setScreenMode] = useState<"lead" | "draft">("lead");
  const [caption, setCaption] = useState("");
  const [problem, setProblem] = useState("");
  const lastVoiceAt = useRef(Date.now());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const api = params.get("api") ?? "https://api.trigger.dev";
    const chatId = params.get("chat") ?? "live-meeting";
    const screen = params.get("view") === "screen";
    setAgentName(params.get("name") ?? "Scout");
    setView(screen ? "screen" : "camera");
    if (params.has("demo")) {
      // Preview the layout without a meeting: /?demo&view=screen
      if (params.get("demo") !== "idle") setLead(DEMO_LEAD);
      const demoState = params.get("state");
      if (demoState === "speaking" || demoState === "thinking" || demoState === "waiting") setStatus(demoState);
      if (params.get("demo") === "draft") {
        setDraft(DEMO_DRAFT);
        setScreenMode("draft");
      }
      return;
    }
    if (!token) {
      setProblem("Open this page from the join-meeting task (it needs a watch token).");
      return;
    }

    let stopped = false;
    type Utterance = { text: string; audio: Promise<Blob>; lead?: Lead; draft?: Draft; shareBot?: string; stopShare?: boolean };
    const queue: Utterance[] = [];
    let sharing = false;
    // The screenshare is this same page in view=screen, with the same token and bypass params.
    const screenUrl = new URL(window.location.href);
    screenUrl.searchParams.set("view", "screen");
    let speaking = false;
    let speaker: ReturnType<typeof setInterval> | undefined;

    if (!screen) {
      // 1. Hear the room, so we know when there's a pause.
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          const ctx = new AudioContext();
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          ctx.createMediaStreamSource(stream).connect(analyser);
          const buf = new Float32Array(analyser.fftSize);
          const tick = () => {
            if (stopped) return;
            analyser.getFloatTimeDomainData(buf);
            let sum = 0;
            for (const v of buf) sum += v * v;
            if (Math.sqrt(sum / buf.length) > VOICE_LEVEL) lastVoiceAt.current = Date.now();
            setTimeout(tick, 50);
          };
          tick();
        })
        .catch(() => {
          // Outside the bot (a normal browser tab) there may be no mic; then it just speaks right away.
        });

      // 2. Speak queued answers once the room is quiet.
      speaker = setInterval(async () => {
        if (speaking || queue.length === 0) return;
        if (Date.now() - lastVoiceAt.current < PAUSE_MS) {
          setStatus("waiting");
          return;
        }
        const next = queue.shift()!;
        speaking = true;
        setStatus("speaking");
        setCaption(next.text);
        // What the turn put on screen appears as it starts speaking, not before.
        if (next.lead) {
          setLead(next.lead);
          setScreenMode("lead");
        }
        if (next.draft) {
          setDraft(next.draft);
          setScreenMode("draft");
        }
        if (next.stopShare) sharing = false;
        if (next.shareBot && !sharing) {
          sharing = true;
          fetch("/api/share", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ botId: next.shareBot, url: screenUrl.toString() }),
          })
            .then((res) => {
              if (!res.ok) sharing = false;
            })
            .catch(() => {
              sharing = false;
            });
        }
        try {
          const audio = new Audio(URL.createObjectURL(await next.audio));
          await new Promise<void>((resolve) => {
            audio.onended = () => resolve();
            audio.onerror = () => resolve();
            audio.play().catch(() => resolve());
          });
        } catch {
          // A failed voice still leaves the caption and the card on screen.
        } finally {
          speaking = false;
          setStatus(queue.length ? "waiting" : "listening");
        }
      }, 100);
    }

    // 3. Watch the agent's session for new turns.
    const transport = new TriggerChatTransport({
      task: "meeting-agent",
      accessToken: () => token,
      baseURL: api,
      watch: true,
      // reconnectToStream only subscribes to sessions the transport already knows.
      sessions: { [chatId]: { publicAccessToken: token } },
    });

    async function watch() {
      while (!stopped) {
        const connectedAt = Date.now();
        try {
          const stream = await transport.reconnectToStream({ chatId });
          if (!stream) {
            await sleep(3000);
            continue;
          }
          setProblem("");
          let text = "";
          const toolNames = new Map<string, string>(); // tool outputs only carry the call id
          const draftInputs = new Map<string, Draft>(); // a draft shows only once draft_reply reports it saved
          let turn: Pick<Utterance, "lead" | "draft" | "shareBot" | "stopShare"> = {};
          for await (const chunk of iterate(stream)) {
            const live = Date.now() - connectedAt > REPLAY_WINDOW_MS;
            switch (chunk.type) {
              case "start":
                text = "";
                turn = {};
                if (live && !screen) setStatus("thinking");
                break;
              case "start-step":
                // Only the final step (after the last tool call) is the answer; earlier text is narration.
                text = "";
                break;
              case "text-delta":
                text += chunk.delta;
                break;
              case "tool-input-available":
                toolNames.set(chunk.toolCallId, chunk.toolName);
                if (screen) {
                  // The screen view opens mid-turn, so it shows the latest email or draft, replay included.
                  if (chunk.toolName === "draft_reply") draftInputs.set(chunk.toolCallId, chunk.input as Draft);
                  break;
                }
                if (!live) break;
                // The camera holds these until it speaks.
                if (chunk.toolName === "draft_reply") draftInputs.set(chunk.toolCallId, chunk.input as Draft);
                else if (chunk.toolName === "stop_sharing") turn.stopShare = true;
                break;
              case "tool-output-available": {
                const out = chunk.output as ({ botId?: string } & Partial<Lead>) | undefined;
                // The email card comes from the tool's output: the email and CRM record verbatim.
                const isLead = LEAD_TOOLS.has(toolNames.get(chunk.toolCallId) ?? "") && out?.email;
                const savedDraft = draftInputs.get(chunk.toolCallId);
                if (savedDraft && (chunk.output as { saved?: boolean } | undefined)?.saved) {
                  if (screen) {
                    setDraft(savedDraft);
                    setScreenMode("draft");
                  } else if (live) turn.draft = savedDraft;
                }
                if (screen) {
                  if (isLead) {
                    setLead({ email: out.email!, crm: out.crm ?? null });
                    setScreenMode("lead");
                  }
                  break;
                }
                if (!live) break;
                if (isLead) turn.lead = { email: out.email!, crm: out.crm ?? null };
                if (out?.botId) turn.shareBot = out.botId;
                break;
              }
              case "finish": {
                const said = text.trim();
                const parts = turn;
                text = "";
                turn = {};
                if (screen) break;
                // SILENT: it was woken by something not meant for it, and chose to stay out of it.
                if (!live || !said || /^\W*SILENT\W*$/i.test(said)) {
                  if (live) setStatus("listening");
                  break;
                }
                queue.push({ text: said, audio: speech(said), ...parts }); // start the voice now, play it at the pause
                setStatus("waiting");
                break;
              }
            }
          }
          // The stream ended (the session settled): pause briefly before reconnecting.
          await sleep(500);
        } catch (error) {
          setProblem(String(error));
          await sleep(3000);
        }
      }
    }
    watch();

    return () => {
      stopped = true;
      if (speaker) clearInterval(speaker);
    };
  }, []);

  if (view === "screen" && screenMode === "draft" && draft) {
    return (
      <div className="screen">
        <div className="screen-head">
          <div className="eyebrow">Draft reply · not sent</div>
          <div className="brand">Shared by {agentName}</div>
        </div>
        <div className="draft">
          <div className="draft-meta">
            <span className="draft-label">To</span>
            <span>{draft.to}</span>
            <span className="draft-label">Subject</span>
            <span>{draft.subject}</span>
          </div>
          <div className="draft-body">{draft.body}</div>
        </div>
        <div className="draft-foot">Saved as a draft in the team inbox. Tell me what to change.</div>
      </div>
    );
  }

  if (view === "screen") {
    return (
      <div className="screen">
        {lead ? (
          <>
            <div className="screen-head">
              <div className="eyebrow">New email · sales inbox</div>
              <div className="brand">Shared by {agentName}</div>
            </div>
            <div className="mail-grid">
              <section className="mail">
                <div className="draft-meta">
                  <span className="draft-label">From</span>
                  <span>{lead.email.from}</span>
                  <span className="draft-label">Subject</span>
                  <span>{lead.email.subject}</span>
                </div>
                <div className="draft-body">{lead.email.body}</div>
              </section>
              {lead.crm && (
                <section className="crm">
                  <h3>CRM · {lead.crm.company}</h3>
                  <dl>
                    {(
                      [
                        ["Contact", lead.crm.contact],
                        ["Plan", lead.crm.plan],
                        ["Usage", lead.crm.usage],
                        ["Open deal", lead.crm.openDeal],
                        ["Notes", lead.crm.notes],
                      ] as const
                    )
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                  </dl>
                </section>
              )}
            </div>
          </>
        ) : (
          <div className="idle">{problem || "Pulling up the email…"}</div>
        )}
      </div>
    );
  }

  const statusText: Record<Status, string> = {
    listening: "Listening",
    thinking: "Looking into something…",
    waiting: "Waiting for a pause",
    speaking: "Speaking",
  };

  return (
    // Meet crops the sides of a camera tile, so everything lives in one centered column.
    <div className="tile">
      <div className="tile-col">
        <div className={`self-row ${lead ? "compact" : ""}`}>
          <Buddy state={status} size={lead ? 120 : 260} />
          <div>
            <div className="name">{agentName}</div>
            <div className="status">{problem || statusText[status]}</div>
          </div>
        </div>
        {lead ? (
          <div className="card">
            <div className="eyebrow">New email</div>
            <div className="title">{lead.email.from}</div>
            <div className="subtitle">{lead.email.subject}</div>
            {lead.crm && (
              <ul className="points">
                {[lead.crm.plan && `Plan: ${lead.crm.plan}`, lead.crm.usage].filter(Boolean).map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="idle">
            Keeping an eye on the inbox.
            <br />
            Say <b>&ldquo;Hey {agentName}&rdquo;</b> if you need me.
          </div>
        )}
        <div className="caption">{status === "speaking" ? caption : ""}</div>
      </div>
    </div>
  );
}

async function speech(text: string) {
  const res = await fetch("/api/speak", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`speak ${res.status}`);
  return res.blob();
}

async function* iterate<T>(stream: ReadableStream<T>) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const DEMO_LEAD: Lead = {
  email: {
    from: "Erlich Bachman",
    subject: "Going annual",
    body: "Hi,\n\nWe'll go annual, but I want 20% off and an equity stake.\n\nErlich Bachman\nPied Piper",
  },
  crm: {
    company: "Pied Piper",
    contact: "Erlich Bachman",
    plan: "Monthly",
    usage: "Usage has doubled this month compared with last month",
    openDeal: "Moving to an annual plan. In negotiation; discount not agreed yet",
    notes: "Growing fast. Very happy with the product, but Erlich always pushes hard on price",
  },
};

const DEMO_DRAFT: Draft = {
  to: "Alex Rivera",
  subject: "Re: Running our planning agents with Acme",
  body: "Hi Alex,\n\nThanks for reaching out, and congrats on the Series A. Overnight planning agents are exactly what Acme is built for: runs that last hours, retry on their own, and pause for a human when they need one.\n\nWould Thursday at 2pm work for a call? We'll bring an engineer to walk through long-running agents and approvals with your team.\n\nBest,\nThe Acme team",
};
