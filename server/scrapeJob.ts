import { runScraper } from "../src/runScraper.js";
import type { PropertyBookingsResult, ScrapeEvent, ScrapeStatus } from "../src/types.js";

type Listener = (event: ScrapeEvent) => void;

interface JobState {
  status: ScrapeStatus;
  events: ScrapeEvent[];
  results: PropertyBookingsResult[];
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

const state: JobState = {
  status: "idle",
  events: [],
  results: [],
  error: null,
  startedAt: null,
  finishedAt: null,
};

const listeners = new Set<Listener>();
let running = false;

function resetState(): void {
  state.status = "idle";
  state.events = [];
  state.results = [];
  state.error = null;
  state.startedAt = null;
  state.finishedAt = null;
}

function pushEvent(event: ScrapeEvent): void {
  state.events.push(event);
  listeners.forEach((listener) => listener(event));

  if (event.type === "complete") {
    state.status = "completed";
    state.results = event.results;
    state.finishedAt = new Date().toISOString();
    running = false;
  }

  if (event.type === "error") {
    state.status = "error";
    state.error = event.message;
    state.finishedAt = new Date().toISOString();
    running = false;
  }
}

export function getJobState(): JobState {
  return {
    status: state.status,
    events: [...state.events],
    results: [...state.results],
    error: state.error,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
  };
}

export function isJobRunning(): boolean {
  return running;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function startScrapeJob(): Promise<void> {
  if (running) {
    throw new Error("A scrape is already running.");
  }

  resetState();
  running = true;
  state.status = "running";
  state.startedAt = new Date().toISOString();

  pushEvent({ type: "log", message: "Scrape job started." });

  try {
    await runScraper(pushEvent);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    pushEvent({ type: "error", message });
    throw error;
  }
}
