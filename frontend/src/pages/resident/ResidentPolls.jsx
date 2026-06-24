import React, { useCallback, useEffect, useState } from "react";
import { Spinner } from "@fluentui/react";
import { PageHeader } from "../../components/shared/PageHeader.jsx";
import { ErrorBanner, getErrMsg } from "../../components/shared/ErrorBanner.jsx";
import { api } from "../../services/api.js";
import { formatDateShort } from "../../utils/formatDate.js";
import "../../styles/ResidentLayout.css";

function PollCard({ poll, onVote, submitting }) {
  const isOpen = poll.is_open;
  const hasVoted = poll.my_vote !== null && poll.my_vote !== undefined;
  const total = Number(poll.total_votes) || 0;
  const options = poll.options || [];
  const locked = !isOpen || hasVoted;

  return (
    <div className="res-poll-card">
      <div className="res-poll-head">
        <div>
          <div className="res-poll-q">{poll.question}</div>
          <div className="res-poll-meta">
            {total} vote{total !== 1 ? "s" : ""}
            {poll.closes_at && ` · ${isOpen ? "Closes" : "Closed"} ${formatDateShort(poll.closes_at)}`}
          </div>
        </div>
        <span className={`res-poll-badge res-poll-badge--${isOpen ? "open" : "closed"}`}>
          {isOpen ? "Open" : "Closed"}
        </span>
      </div>

      <div className="res-poll-options">
        {options.map((opt, i) => {
          const isMyVote = Number(poll.my_vote) === i;
          return (
            <button
              key={i}
              className={`res-poll-opt${isMyVote ? " res-poll-opt--mine" : ""}`}
              onClick={() => !locked && submitting !== poll.id && onVote(poll.id, i)}
              disabled={locked || submitting === poll.id}
            >
              <span>{opt}</span>
              {isMyVote && <span className="res-poll-opt-mark">✓ Your vote</span>}
            </button>
          );
        })}
      </div>

      {submitting === poll.id && <div className="res-poll-submitting">Submitting vote…</div>}

      {hasVoted && isOpen && (
        <div className="res-poll-note">
          Your vote has been recorded. Results will be visible when the poll closes.
        </div>
      )}

      {!isOpen && <ResultsBars poll={poll} />}
    </div>
  );
}

function ResultsBars({ poll }) {
  const [data, setData] = useState(null);
  const [, setLoading] = useState(true);

  useEffect(() => {
    if (!api.secretary?.polls?.results) { setLoading(false); return; }
    api.secretary.polls.results(poll.id)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [poll.id]);

  if (!data) return null;

  const total = (data.options || []).reduce((s, o) => s + o.votes, 0);

  return (
    <div className="res-poll-results">
      <div className="res-poll-results-heading">
        Final Results · {total} vote{total !== 1 ? "s" : ""}
      </div>
      <div className="res-poll-results-list">
        {(data.options || []).map((opt) => {
          const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
          return (
            <div key={opt.index}>
              <div className="res-poll-result-top">
                <span className="res-poll-result-label">{opt.label}</span>
                <span className="res-poll-result-pct">{pct}%</span>
              </div>
              <div className="res-poll-bar">
                <div className="res-poll-bar-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ResidentPolls() {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.resident.polls.list()
      .then((d) => setPolls(d.polls || []))
      .catch((e) => setError(getErrMsg(e, "Failed to load polls.")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  async function handleVote(pollId, optionIndex) {
    setSubmitting(pollId);
    try {
      await api.resident.polls.vote(pollId, optionIndex);
      setPolls((ps) => ps.map((p) =>
        p.id !== pollId ? p : { ...p, my_vote: optionIndex, total_votes: Number(p.total_votes || 0) + 1 },
      ));
    } catch (err) {
      setError(getErrMsg(err, "Failed to submit vote."));
    } finally {
      setSubmitting(null);
    }
  }

  const openPolls = polls.filter((p) => p.is_open);
  const closedPolls = polls.filter((p) => !p.is_open);

  return (
    <div className="res-page">
      <PageHeader title="Polls" subtitle="Cast your vote on society matters" />

      <ErrorBanner message={error} onRetry={load} />

      {loading ? (
        <Spinner label="Loading polls…" />
      ) : polls.length === 0 ? (
        <div className="res-card">
          <div className="res-empty">No polls available right now.</div>
        </div>
      ) : (
        <>
          {openPolls.length > 0 && (
            <div className="res-group">
              <div className="res-group-heading">Active</div>
              {openPolls.map((p) => (
                <PollCard key={p.id} poll={p} onVote={handleVote} submitting={submitting} />
              ))}
            </div>
          )}

          {closedPolls.length > 0 && (
            <div className="res-group">
              <div className="res-group-heading res-group-heading--muted">Closed</div>
              {closedPolls.map((p) => (
                <PollCard key={p.id} poll={p} onVote={handleVote} submitting={submitting} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
