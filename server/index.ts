import express from "express";
import cors from "cors";
import { getJobState, isJobRunning, startScrapeJob, subscribe } from "./scrapeJob.js";

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/scrape/status", (_req, res) => {
  res.json(getJobState());
});

app.get("/api/scrape/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const current = getJobState();
  current.events.forEach((event) => send(event));
  send({ type: "status", status: current.status });

  const unsubscribe = subscribe((event) => {
    send(event);
    if (event.type === "complete" || event.type === "error") {
      send({ type: "status", status: getJobState().status });
    }
  });

  req.on("close", () => {
    unsubscribe();
  });
});

app.post("/api/scrape/start", async (_req, res) => {
  if (isJobRunning()) {
    res.status(409).json({ error: "Scrape is already running." });
    return;
  }

  res.json({ ok: true, message: "Scrape started. Playwright will open in a new browser window." });

  startScrapeJob().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Scrape job failed:", message);
  });
});

app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});
