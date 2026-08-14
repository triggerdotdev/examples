// Device-local chat storage. This demo has no server database, so a chat's
// transcript and a lightweight index of every chat live in the browser's
// IndexedDB, keyed by chatId. Everything is therefore per-device: clearing
// site data or switching browsers loses the history — which is the point, the
// transcripts never leave the machine.
//
// The module is imported by client components but must stay SSR-safe: it never
// touches `indexedDB` at import time or on the server. Every entry point guards
// on `typeof indexedDB === "undefined"` and resolves to an empty/no-op result
// there, and the raw IndexedDB request/transaction callbacks are wrapped in
// small typed Promise helpers so the rest of the file reads as async/await.

import type { UIMessage } from "ai";

// `createdAt` fixes a chat's position in the sidebar (newest created on top, and
// it never moves when you send another message); `updatedAt` drives the 48h
// read-only expiry only.
export type ChatMeta = { chatId: string; title: string | null; createdAt: number; updatedAt: number };

const DB_NAME = "trigger-chat-agent";
const DB_VERSION = 1;
const MESSAGES_STORE = "messages";
const CHATS_STORE = "chats";

// Stable empty array for SSR — a fresh `[]` each call would make
// useSyncExternalStore think the snapshot changed and loop forever.
const EMPTY_CHATS: readonly ChatMeta[] = Object.freeze([]);

function isBrowser(): boolean {
  return typeof indexedDB !== "undefined";
}

// --- typed wrappers around the raw IndexedDB callback API ------------------

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionToPromise(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
        // Value is a UIMessage[] with no natural key — use out-of-line keys.
        db.createObjectStore(MESSAGES_STORE);
      }
      if (!db.objectStoreNames.contains(CHATS_STORE)) {
        db.createObjectStore(CHATS_STORE, { keyPath: "chatId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

// --- narrowing --------------------------------------------------------------

// Validate a stored record and normalize it. `createdAt` was added later, so a
// record written before this falls back to its `updatedAt` (best available).
function toChatMeta(value: unknown): ChatMeta | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.chatId !== "string") return null;
  if (!(v.title === null || typeof v.title === "string")) return null;
  if (typeof v.updatedAt !== "number") return null;
  const createdAt = typeof v.createdAt === "number" ? v.createdAt : v.updatedAt;
  return { chatId: v.chatId, title: v.title, createdAt, updatedAt: v.updatedAt };
}

async function readMeta(db: IDBDatabase, chatId: string): Promise<ChatMeta | null> {
  const tx = db.transaction(CHATS_STORE, "readonly");
  const value = await requestToPromise<unknown>(tx.objectStore(CHATS_STORE).get(chatId));
  return toChatMeta(value);
}

// --- public read/write API --------------------------------------------------

export async function loadMessages(chatId: string): Promise<UIMessage[]> {
  if (!isBrowser()) return [];
  const db = await openDb();
  const tx = db.transaction(MESSAGES_STORE, "readonly");
  const value = await requestToPromise<unknown>(tx.objectStore(MESSAGES_STORE).get(chatId));
  return Array.isArray(value) ? (value as UIMessage[]) : [];
}

export async function saveMessages(chatId: string, messages: UIMessage[]): Promise<void> {
  if (!isBrowser()) return;
  const db = await openDb();
  // Read the existing meta in its own transaction: interleaving awaits inside a
  // single readwrite transaction can let IndexedDB auto-commit between steps.
  const existing = await readMeta(db, chatId);
  const meta: ChatMeta = {
    chatId,
    title: existing ? existing.title : null,
    createdAt: existing ? existing.createdAt : Date.now(),
    updatedAt: Date.now(),
  };
  const tx = db.transaction([MESSAGES_STORE, CHATS_STORE], "readwrite");
  tx.objectStore(MESSAGES_STORE).put(messages, chatId);
  tx.objectStore(CHATS_STORE).put(meta);
  await transactionToPromise(tx);
  await refreshSnapshot();
}

export async function listChats(): Promise<ChatMeta[]> {
  if (!isBrowser()) return [];
  const db = await openDb();
  const tx = db.transaction(CHATS_STORE, "readonly");
  const all = await requestToPromise<unknown[]>(tx.objectStore(CHATS_STORE).getAll());
  const metas = Array.isArray(all)
    ? all.map(toChatMeta).filter((m): m is ChatMeta => m !== null)
    : [];
  // Newest created first, and stable: sending a message doesn't reorder.
  return metas.sort((a, b) => b.createdAt - a.createdAt);
}

export async function setTitle(chatId: string, title: string): Promise<void> {
  if (!isBrowser()) return;
  const db = await openDb();
  const existing = await readMeta(db, chatId);
  const meta: ChatMeta = {
    chatId,
    title,
    createdAt: existing ? existing.createdAt : Date.now(),
    updatedAt: existing ? existing.updatedAt : Date.now(),
  };
  const tx = db.transaction(CHATS_STORE, "readwrite");
  tx.objectStore(CHATS_STORE).put(meta);
  await transactionToPromise(tx);
  await refreshSnapshot();
}

export async function removeChat(chatId: string): Promise<void> {
  if (!isBrowser()) return;
  const db = await openDb();
  const tx = db.transaction([MESSAGES_STORE, CHATS_STORE], "readwrite");
  tx.objectStore(MESSAGES_STORE).delete(chatId);
  tx.objectStore(CHATS_STORE).delete(chatId);
  await transactionToPromise(tx);
  await refreshSnapshot();
}

// --- useSyncExternalStore surface for the chat list -------------------------

const listeners = new Set<() => void>();
let cachedChats: ChatMeta[] = [];
let hydrated = false;

function sameList(a: ChatMeta[], b: ChatMeta[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].chatId !== b[i].chatId ||
      a[i].title !== b[i].title ||
      a[i].updatedAt !== b[i].updatedAt
    ) {
      return false;
    }
  }
  return true;
}

function emit(): void {
  for (const listener of listeners) listener();
}

// Reload the list from IndexedDB and, only if it actually changed, swap the
// cached reference and notify subscribers. Keeping the reference stable when
// nothing changed is what makes getChatsSnapshot safe for useSyncExternalStore.
async function refreshSnapshot(): Promise<void> {
  if (!isBrowser()) return;
  const next = await listChats();
  if (!sameList(cachedChats, next)) {
    cachedChats = next;
    emit();
  }
}

export function subscribeChats(callback: () => void): () => void {
  if (!isBrowser()) return () => {};
  listeners.add(callback);
  void refreshSnapshot();
  return () => {
    listeners.delete(callback);
  };
}

export function getChatsSnapshot(): ChatMeta[] {
  // Lazily kick off the first load; the background refresh will notify
  // subscribers once real data lands. No render loop, no polling.
  if (!hydrated && isBrowser()) {
    hydrated = true;
    void refreshSnapshot();
  }
  return cachedChats;
}

export function getServerChatsSnapshot(): ChatMeta[] {
  return EMPTY_CHATS as ChatMeta[];
}
