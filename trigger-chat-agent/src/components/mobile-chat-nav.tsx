"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ChatSidebar } from "@/components/chat-sidebar";
import { TriggerLogo } from "@/components/trigger-logo";

const DIALOG_ID = "mobile-chat-navigation";

/** Accessible modal navigation for viewports where the desktop sidebar hides. */
export function MobileChatNav() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      closeRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      triggerRef.current?.focus();
    }
  }, [open]);

  function close() {
    setOpen(false);
  }

  return (
    <div data-chat-sidebar className="md:hidden">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open chat navigation"
        aria-controls={DIALOG_ID}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-30 flex size-10 items-center justify-center rounded-xl border border-charcoal-700 bg-charcoal-950/90 text-dimmed backdrop-blur-md transition-colors hover:bg-charcoal-850 hover:text-bright"
      >
        <Menu className="size-5" />
      </button>

      <dialog
        ref={dialogRef}
        id={DIALOG_ID}
        aria-labelledby={`${DIALOG_ID}-title`}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          const dialog = event.currentTarget;
          const bounds = dialog.getBoundingClientRect();
          const outside =
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom;
          if (outside) close();
        }}
        className="m-0 h-dvh max-h-none w-[min(20rem,calc(100vw-3rem))] max-w-none border-0 border-r border-grid-dimmed bg-charcoal-950 p-0 text-foreground shadow-2xl backdrop:bg-black/65"
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-grid-dimmed px-4">
            <TriggerLogo className="size-5" />
            <span
              id={`${DIALOG_ID}-title`}
              className="font-mono text-sm font-medium text-bright"
            >
              Ask Trigger
            </span>
            <button
              ref={closeRef}
              type="button"
              aria-label="Close chat navigation"
              onClick={close}
              className="ml-auto flex size-10 items-center justify-center rounded-xl text-dimmed transition-colors hover:bg-charcoal-850 hover:text-bright"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <ChatSidebar onNavigate={close} />
          </div>
        </div>
      </dialog>
    </div>
  );
}
