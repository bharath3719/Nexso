/**
 * GuideDrawer.jsx
 * ────────────────
 * The in-app guide, opened from the header of every portal shell.
 *
 * A full-screen overlay with a table of contents on the left and one section at
 * a time on the right. Content is data, not markup — see guideContent.js.
 *
 * Search filters the table of contents by matching against a section's title
 * and its flattened text, so a secretary who types "utr" lands on the
 * verification section without knowing what it is called.
 */

import React from "react";
import { createPortal } from "react-dom";
import { Icon } from "@fluentui/react";
import { getGuide } from "./guideContent.js";
import "../../styles/Guide.css";

// ── Inline markup: **bold** and `code` ────────────────────────────────────────

function RichText({ text }) {
  if (text == null) return null;
  const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
          return <code key={i} className="guide-code">{part.slice(1, -1)}</code>;
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

// ── Block renderers ───────────────────────────────────────────────────────────

const NOTE_ICON = {
  info:    "Info",
  tip:     "Lightbulb",
  warn:    "Warning",
  danger:  "Blocked2",
  success: "CompletedSolid",
};

function Block({ block }) {
  switch (block.type) {
    case "p":
      return <p className="guide-p"><RichText text={block.text} /></p>;

    case "where":
      return (
        <div className="guide-where">
          <Icon iconName="POI" className="guide-where__icon" />
          {block.path.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="guide-where__sep">›</span>}
              <span className="guide-where__crumb">{crumb}</span>
            </React.Fragment>
          ))}
        </div>
      );

    case "steps":
      return (
        <ol className="guide-steps">
          {block.items.map((item, i) => (
            <li key={i} className="guide-step">
              <span className="guide-step__num">{i + 1}</span>
              <div className="guide-step__body">
                <div className="guide-step__title"><RichText text={item.t} /></div>
                {item.d && <div className="guide-step__desc"><RichText text={item.d} /></div>}
              </div>
            </li>
          ))}
        </ol>
      );

    case "bullets":
      return (
        <ul className="guide-bullets">
          {block.items.map((item, i) => (
            <li key={i}><RichText text={item} /></li>
          ))}
        </ul>
      );

    case "note":
      return (
        <div className={`guide-note guide-note--${block.tone || "info"}`}>
          <Icon iconName={NOTE_ICON[block.tone] || "Info"} className="guide-note__icon" />
          <div>
            {block.title && <div className="guide-note__title">{block.title}</div>}
            <div className="guide-note__text"><RichText text={block.text} /></div>
          </div>
        </div>
      );

    case "table":
      return (
        <div className="guide-table-wrap">
          <table className="guide-table">
            <thead>
              <tr>{block.head.map((h, i) => <th key={i}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}><RichText text={cell} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "chips":
      return (
        <div className="guide-chips">
          {block.items.map((item, i) => (
            <div key={i} className="guide-chip-row">
              <span className={`guide-chip guide-chip--${item.tone || "slate"}`}>{item.label}</span>
              <span className="guide-chip-desc"><RichText text={item.d} /></span>
            </div>
          ))}
        </div>
      );

    case "faq":
      return (
        <div className="guide-faq">
          {block.items.map((item, i) => (
            <details key={i} className="guide-faq__item">
              <summary className="guide-faq__q">{item.q}</summary>
              <div className="guide-faq__a"><RichText text={item.a} /></div>
            </details>
          ))}
        </div>
      );

    default:
      return null;
  }
}

// ── Search helpers ────────────────────────────────────────────────────────────

/** Flatten every string in a section so search can match anything visible. */
function sectionText(section) {
  const out = [section.title];
  const walk = (value) => {
    if (typeof value === "string") { out.push(value); return; }
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (value && typeof value === "object") { Object.values(value).forEach(walk); }
  };
  walk(section.blocks);
  return out.join(" ").toLowerCase();
}

// ── Main component ────────────────────────────────────────────────────────────

export function GuideDrawer({ role, onClose }) {
  const guide = getGuide(role);

  const [query,    setQuery]    = React.useState("");
  const [activeId, setActiveId] = React.useState(guide?.sections?.[0]?.id ?? null);
  const bodyRef  = React.useRef(null);
  const panelRef = React.useRef(null);

  // Search index — built once per guide, not per keystroke.
  const searchIndex = React.useMemo(() => {
    const map = {};
    (guide?.sections || []).forEach((s) => { map[s.id] = sectionText(s); });
    return map;
  }, [guide]);

  const sections = React.useMemo(() => guide?.sections || [], [guide]);
  const q = query.trim().toLowerCase();
  const matches = React.useMemo(
    () => (q ? sections.filter((s) => searchIndex[s.id]?.includes(q)) : sections),
    [q, sections, searchIndex],
  );

  // When a search excludes the open section, jump to the first match.
  React.useEffect(() => {
    setActiveId((current) =>
      matches.length && !matches.some((s) => s.id === current) ? matches[0].id : current,
    );
  }, [matches]);

  // Esc to close, and don't let the page behind scroll.
  React.useEffect(() => {
    if (!guide) return undefined;
    const onKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [guide, onClose]);

  // A new section always starts at the top.
  React.useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [activeId]);

  if (!guide) return null;

  const active = sections.find((s) => s.id === activeId) || sections[0];
  const activeIndex = sections.findIndex((s) => s.id === active?.id);
  const next = sections[activeIndex + 1] || null;

  // Rendered into <body> so the shell's fixed header can never clip or stack
  // above it.
  return createPortal(
    <div className="guide-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="guide-panel"
        role="dialog"
        aria-modal="true"
        aria-label={guide.title}
        tabIndex={-1}
        ref={panelRef}
      >
        {/* Header */}
        <header className="guide-header">
          <div className="guide-header__titles">
            <div className="guide-header__title">{guide.title}</div>
            <div className="guide-header__subtitle">{guide.subtitle}</div>
          </div>
          <div className="guide-header__tools">
            <div className="guide-search">
              <Icon iconName="Search" className="guide-search__icon" />
              <input
                className="guide-search__input"
                type="search"
                placeholder="Search the guide…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search the guide"
              />
            </div>
            <button className="guide-close" onClick={onClose} aria-label="Close guide" title="Close (Esc)">✕</button>
          </div>
        </header>

        {/* Body */}
        <div className="guide-body">
          <nav className="guide-toc" aria-label="Guide contents">
            {matches.length === 0 ? (
              <div className="guide-toc__empty">No section matches “{query}”.</div>
            ) : (
              matches.map((s) => (
                <button
                  key={s.id}
                  className={`guide-toc__item${s.id === active?.id ? " guide-toc__item--active" : ""}`}
                  onClick={() => setActiveId(s.id)}
                >
                  <Icon iconName={s.icon || "TextDocument"} className="guide-toc__icon" />
                  <span>{s.title}</span>
                </button>
              ))
            )}
          </nav>

          <div className="guide-content" ref={bodyRef}>
            {matches.length === 0 ? (
              <div className="guide-noresults">
                <Icon iconName="SearchIssue" className="guide-noresults__icon" />
                <div>Nothing in this guide mentions “{query.trim()}”.</div>
                <button className="guide-next" onClick={() => setQuery("")}>Clear search</button>
              </div>
            ) : active && (
              <>
                <h2 className="guide-section-title">{active.title}</h2>
                {active.blocks.map((block, i) => <Block key={i} block={block} />)}

                {next && !q && (
                  <button className="guide-next" onClick={() => setActiveId(next.id)}>
                    Next: {next.title}
                    <Icon iconName="ChevronRight" className="guide-next__icon" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
