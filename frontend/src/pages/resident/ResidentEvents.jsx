import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Spinner } from "@fluentui/react";
import { PageHeader } from "../../components/shared/PageHeader.jsx";
import { ErrorBanner, getErrMsg } from "../../components/shared/ErrorBanner.jsx";
import { api } from "../../services/api.js";
import "../../styles/ResidentLayout.css";

const RSVP_OPTIONS = [
  { key: "YES",   label: "Going"     },
  { key: "MAYBE", label: "Maybe"     },
  { key: "NO",    label: "Not Going" },
];

function fmtEventDate(iso) {
  const d = new Date(iso);
  return {
    day:  d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" }),
    time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
  };
}

function EventCard({ event, isPast, onRsvp, submitting }) {
  const { day, time } = fmtEventDate(event.event_date);
  const myRsvp = event.my_response;

  return (
    <div className={`res-event-card${isPast ? " res-event-card--past" : ""}`}>
      <div className="res-event-top">
        <div className={`res-event-datechip${isPast ? " res-event-datechip--past" : ""}`}>
          <div className="res-event-day">{day}</div>
          <div className="res-event-time">{time}</div>
        </div>
        <div className="res-event-body">
          <div className="res-event-title">{event.title}</div>
          {event.location && <div className="res-event-loc">📍 {event.location}</div>}
          {event.description && <p className="res-event-desc">{event.description}</p>}
        </div>
      </div>

      <div className="res-event-footer">
        <div className="res-event-counts">
          Going: {Number(event.rsvp_yes) || 0} · Maybe: {Number(event.rsvp_maybe) || 0} · Not going: {Number(event.rsvp_no) || 0}
        </div>
        {isPast ? (
          <span className="res-event-ended">Event ended</span>
        ) : (
          <div className="res-rsvp-row">
            {RSVP_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                className={`res-rsvp-btn res-rsvp-btn--${opt.key}${myRsvp === opt.key ? " is-active" : ""}`}
                onClick={() => onRsvp(event.id, opt.key)}
                disabled={submitting === event.id}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ResidentEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.resident.events.list()
      .then((d) => setEvents(d.events || []))
      .catch((e) => setError(getErrMsg(e, "Failed to load events.")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  async function handleRsvp(eventId, response) {
    setSubmitting(eventId);
    try {
      await api.resident.events.rsvp(eventId, response);
      setEvents((evs) => evs.map((e) => {
        if (e.id !== eventId) return e;
        const prev = e.my_response;
        const next = { ...e, my_response: response };
        if (prev) {
          next[`rsvp_${prev.toLowerCase()}`] = Math.max(0, Number(e[`rsvp_${prev.toLowerCase()}`] || 0) - 1);
        }
        next[`rsvp_${response.toLowerCase()}`] = Number(e[`rsvp_${response.toLowerCase()}`] || 0) + 1;
        return next;
      }));
    } catch (err) {
      setError(getErrMsg(err, "Failed to update RSVP."));
    } finally {
      setSubmitting(null);
    }
  }

  // Partition once: anything before "now" is past.
  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const u = [], p = [];
    for (const e of events) {
      (new Date(e.event_date).getTime() < now ? p : u).push(e);
    }
    return { upcoming: u, past: p };
  }, [events]);

  return (
    <div className="res-page">
      <PageHeader title="Events" subtitle="Upcoming and past society events" />

      <ErrorBanner message={error} onRetry={load} />

      {loading ? (
        <Spinner label="Loading events…" />
      ) : events.length === 0 ? (
        <div className="res-card">
          <div className="res-empty">No events scheduled. Check back later.</div>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="res-event-group">
              <div className="res-event-section">Upcoming</div>
              {upcoming.map((ev) => (
                <EventCard key={ev.id} event={ev} isPast={false} onRsvp={handleRsvp} submitting={submitting} />
              ))}
            </div>
          )}

          {past.length > 0 && (
            <div className="res-event-group">
              <div className="res-event-section res-event-section--muted">Past</div>
              {past.map((ev) => (
                <EventCard key={ev.id} event={ev} isPast onRsvp={handleRsvp} submitting={submitting} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
