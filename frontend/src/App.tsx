import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PropertyBookingsResult, ScrapeEvent, ScrapeStatus } from "./types";

const API_BASE = "";

function statusLabel(status: ScrapeStatus): string {
  switch (status) {
    case "idle":
      return "Ready";
    case "running":
      return "Scraping…";
    case "completed":
      return "Completed";
    case "error":
      return "Error";
  }
}

function formatTime(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString();
}

export default function App() {
  const [status, setStatus] = useState<ScrapeStatus>("idle");
  const [events, setEvents] = useState<ScrapeEvent[]>([]);
  const [results, setResults] = useState<PropertyBookingsResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ step: string; current?: number; total?: number } | null>(
    null
  );
  const logRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const totalBookings = useMemo(
    () => results.reduce((sum, item) => sum + item.bookings.length, 0),
    [results]
  );

  const connectEvents = useCallback(() => {
    eventSourceRef.current?.close();
    const source = new EventSource(`${API_BASE}/api/scrape/events`);
    eventSourceRef.current = source;

    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as ScrapeEvent;

      if (event.type === "status") {
        setStatus(event.status);
        return;
      }

      setEvents((prev) => [...prev, event]);

      if (event.type === "progress") {
        setProgress({ step: event.step, current: event.current, total: event.total });
      }

      if (event.type === "complete") {
        setResults(event.results);
        setStatus("completed");
        setProgress(null);
      }

      if (event.type === "error") {
        setError(event.message);
        setStatus("error");
        setProgress(null);
      }
    };

    source.onerror = () => {
      source.close();
    };
  }, []);

  useEffect(() => {
    connectEvents();

    fetch(`${API_BASE}/api/scrape/status`)
      .then((res) => res.json())
      .then((data) => {
        setStatus(data.status);
        setResults(data.results ?? []);
        setError(data.error ?? null);
        setEvents(data.events ?? []);
      })
      .catch(() => undefined);

    return () => eventSourceRef.current?.close();
  }, [connectEvents]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  const startScrape = async () => {
    setError(null);
    setResults([]);
    setEvents([]);
    setProgress(null);
    setStatus("running");

    const response = await fetch(`${API_BASE}/api/scrape/start`, { method: "POST" });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "Failed to start scrape.");
      setStatus("error");
      return;
    }

    connectEvents();
  };

  const renderLogLine = (event: ScrapeEvent, index: number) => {
    if (event.type === "navigate") {
      return (
        <div key={index} className="log-line log-navigate">
          <span className="log-icon">→</span>
          <div>
            <strong>{event.label}</strong>
            <a href={event.url} target="_blank" rel="noreferrer">
              {event.url}
            </a>
          </div>
        </div>
      );
    }

    if (event.type === "log") {
      return (
        <div key={index} className="log-line">
          <span className="log-icon">•</span>
          <span>{event.message}</span>
        </div>
      );
    }

    if (event.type === "property-found") {
      return (
        <div key={index} className="log-line log-property">
          <span className="log-icon">🏠</span>
          <span>
            Property found: <strong>{event.property.title}</strong> (ID {event.property.vrboId})
          </span>
        </div>
      );
    }

    if (event.type === "booking-found") {
      return (
        <div key={index} className="log-line log-booking">
          <span className="log-icon">📅</span>
          <span>
            Booking: <strong>{event.booking.guestName}</strong> — {event.booking.reservationId}
          </span>
        </div>
      );
    }

    if (event.type === "bot-challenge") {
      return (
        <div key={index} className="log-line log-warning">
          <span className="log-icon">⚠</span>
          <span>{event.message}</span>
        </div>
      );
    }

    if (event.type === "progress") {
      return (
        <div key={index} className="log-line">
          <span className="log-icon">…</span>
          <span>
            {event.step}
            {event.current && event.total ? ` (${event.current}/${event.total})` : ""}
          </span>
        </div>
      );
    }

    if (event.type === "property-done") {
      return (
        <div key={index} className="log-line log-success">
          <span className="log-icon">✓</span>
          <span>
            Finished {event.result.property.title}: {event.result.bookings.length} booking(s)
          </span>
        </div>
      );
    }

    if (event.type === "complete") {
      return (
        <div key={index} className="log-line log-success">
          <span className="log-icon">✓</span>
          <span>Scrape completed successfully.</span>
        </div>
      );
    }

    if (event.type === "error") {
      return (
        <div key={index} className="log-line log-error">
          <span className="log-icon">✕</span>
          <span>{event.message}</span>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Playwright + VRBO</p>
          <h1>Booking Scraper Dashboard</h1>
          <p className="subtitle">
            Start a scrape to open Playwright in a visible Chrome window, watch it navigate VRBO pages,
            and view all bookings here when finished.
          </p>
        </div>

        <div className="hero-actions">
          <div className={`status-pill status-${status}`}>{statusLabel(status)}</div>
          <button
            className="start-button"
            onClick={startScrape}
            disabled={status === "running"}
          >
            {status === "running" ? "Scraping in progress…" : "Start Scraping"}
          </button>
        </div>
      </header>

      {status === "running" && (
        <section className="panel notice-panel">
          <strong>Playwright is running.</strong> A Chrome window opens separately. If you see{" "}
          <em>“Slide right to secure your access”</em>, complete the captcha there — the scraper waits
          automatically (up to 5 minutes).
          {progress && (
            <p className="progress-text">
              {progress.step}
              {progress.current && progress.total
                ? ` — ${Math.round((progress.current / progress.total) * 100)}%`
                : ""}
            </p>
          )}
        </section>
      )}

      {error && (
        <section className="panel error-panel">
          <strong>Error:</strong> {error}
        </section>
      )}

      <div className="grid">
        <section className="panel">
          <div className="panel-header">
            <h2>Live navigation log</h2>
            <span>{events.length} events</span>
          </div>
          <div className="log-feed" ref={logRef}>
            {events.length === 0 ? (
              <p className="empty-state">Click Start Scraping to watch Playwright navigate VRBO.</p>
            ) : (
              events.map(renderLogLine)
            )}
          </div>
        </section>

        <section className="panel stats-panel">
          <h2>Summary</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-value">{results.length}</span>
              <span className="stat-label">Properties</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{totalBookings}</span>
              <span className="stat-label">Bookings</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">300</span>
              <span className="stat-label">Days scanned</span>
            </div>
          </div>
        </section>
      </div>

      <section className="panel results-panel">
        <div className="panel-header">
          <h2>Booking results</h2>
          {status === "completed" && <span>Scraped at {formatTime(results[0]?.scrapedAt)}</span>}
        </div>

        {results.length === 0 ? (
          <p className="empty-state">Results will appear here after scraping completes.</p>
        ) : (
          <div className="property-results">
            {results.map((result) => (
              <article key={result.property.propertyId} className="property-card">
                <header>
                  <div>
                    <h3>{result.property.title}</h3>
                    <p>
                      {result.property.address ?? "No address"} · Vrbo {result.property.vrboId}
                    </p>
                  </div>
                  <span className="booking-count">
                    {result.bookings.length} booking{result.bookings.length === 1 ? "" : "s"}
                  </span>
                </header>

                {result.bookings.length === 0 ? (
                  <p className="empty-state">No bookings found in the next 300 days.</p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Guest</th>
                          <th>Reservation ID</th>
                          <th>Dates</th>
                          <th>Nights</th>
                          <th>Guests</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.bookings.map((booking) => (
                          <tr key={booking.reservationId}>
                            <td>{booking.guestName}</td>
                            <td>
                              <code>{booking.reservationId}</code>
                            </td>
                            <td>{booking.dateRange}</td>
                            <td>{booking.nights}</td>
                            <td>{booking.guests}</td>
                            <td>{booking.status ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
