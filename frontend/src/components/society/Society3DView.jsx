import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@fluentui/react";
import { TOWER_GRADIENTS } from "../../styles/cssConstants.js";
import "../../styles/society3d.css";

// ─── Society3DView ────────────────────────────────────────────────────────────
// A drag-to-orbit 3D model of the society, built entirely from CSS 3D transforms
// (no WebGL / three.js — a society is a handful of boxes and a grid of windows,
// which the compositor handles far more cheaply than a canvas would).
//
// Every unit is a window on the facade: lit = someone lives there, dark = vacant.
// Hover a window for its residents, click it to manage them.
//
// Geometry is computed in px at zoom 1 and the whole scene is scaled to fit the
// container, so a 4-unit tower and a 20-unit tower both land on screen.

// ─── Geometry constants (px, zoom 1) ──────────────────────────────────────────
const WIN_W     = 46;   // window glass width
const WIN_H     = 34;   // window glass height
const WIN_GAP   = 10;   // horizontal gap between windows
const LABEL_H   = 14;   // unit-number label sitting above each window
const FLOOR_PAD = 9;    // vertical padding inside one floor band
const FLOOR_H   = LABEL_H + WIN_H + FLOOR_PAD * 2;
const TAG_W     = 32;   // left gutter on the facade holding the floor tag
const SIDE_PAD  = 16;
const DEPTH     = 130;  // building depth (front face → back face)
const PARAPET   = 20;   // roof lip carrying the tower name
const PLINTH_H  = 16;   // base slab the tower stands on
const TOWER_GAP = 96;

// ─── The compound ─────────────────────────────────────────────────────────────
// Padding between the tower row and the boundary wall. Kept tight on purpose:
// every px here is px the auto-fit has to shrink the towers by.
const SITE_PAD_X  = 120;
const SITE_PAD_Z  = 100;
const WALL_H      = 34;
const WALL_T      = 9;
const GATE_W      = 132;  // clear span in the front wall
const PILLAR_W    = 18;
const PILLAR_H    = 52;
const ARCH_H      = 26;   // lintel across the pillars, carrying the name
const GATE_LEAF_H = PILLAR_H - 14;
const TREE_W      = 62;
const TREE_H      = 96;

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 1.6;

// Orbit limits. Azimuth (ry) is unbounded — the model is closed on every side,
// so the camera may circle it freely. Elevation (rx) never reaches the horizon:
// below ~10° the ground plane collapses towards an edge-on sliver that fills the
// frame, and at 0 the site is a line. It also stops well short of going under —
// solids are built from five faces with no underside, so a view from below would
// look straight up into hollow shells.
const RX_MIN = 10;
const RX_MAX = 80;

// How long the hover card survives after the pointer leaves the window, giving
// the pointer time to travel the gap into the card itself.
const TIP_GRACE_MS = 160;
const TIP_W        = 248;
const TIP_MAX_H    = 268;
const TIP_GAP      = 10;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Shortest signed path from one angle to another, so "reset" spins home the
// near way instead of unwinding every turn the user made.
const nearestAngle = (from, to) => from + (((((to - from) % 360) + 540) % 360) - 180);

// ─── One cube ─────────────────────────────────────────────────────────────────
// Five faces (the underside is never visible). Each face is centred on the
// parent's origin, then rotated into place and pushed out along its own normal.
function BoxFaces({ w, h, d, front }) {
  return (
    <>
      <div className="s3d-face s3d-face--front" style={{ width: w, height: h, transform: `translate(-50%,-50%) translateZ(${d / 2}px)` }}>
        {front}
      </div>
      <div className="s3d-face s3d-face--back"  style={{ width: w, height: h, transform: `translate(-50%,-50%) rotateY(180deg) translateZ(${d / 2}px)` }} />
      <div className="s3d-face s3d-face--right" style={{ width: d, height: h, transform: `translate(-50%,-50%) rotateY(90deg) translateZ(${w / 2}px)` }} />
      <div className="s3d-face s3d-face--left"  style={{ width: d, height: h, transform: `translate(-50%,-50%) rotateY(-90deg) translateZ(${w / 2}px)` }} />
      <div className="s3d-face s3d-face--roof"  style={{ width: w, height: d, transform: `translate(-50%,-50%) rotateX(90deg) translateZ(${h / 2}px)` }} />
    </>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────
export function Society3DView({ towers, residentMap, onUnitClick, selectedUnitId, societyName }) {
  const stageRef  = useRef(null);
  const [rx, setRx]     = useState(14);
  const [ry, setRy]     = useState(-22);
  const [zoom, setZoom] = useState(1);
  const [night, setNight]   = useState(false);
  const [hover, setHover]   = useState(null); // { rect, unit, floor, tower, residents }
  const [autoFit, setAutoFit] = useState(1);

  // ── Hover card lifetime ────────────────────────────────────────────────────
  // The card is interactive (it carries the action button), so it cannot simply
  // vanish on pointerleave — the pointer has to cross a few px of stage to
  // reach it. Closing is therefore deferred and cancelled if the pointer lands
  // on the card. It is also anchored to the window's screen box rather than
  // following the cursor, so it holds still long enough to be aimed at.
  const hoverTimer = useRef(null);
  const cancelHoverClose = useCallback(() => {
    if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; }
  }, []);
  const scheduleHoverClose = useCallback((delay = TIP_GRACE_MS) => {
    cancelHoverClose();
    hoverTimer.current = setTimeout(() => { hoverTimer.current = null; setHover(null); }, delay);
  }, [cancelHoverClose]);
  const closeHoverNow = useCallback(() => { cancelHoverClose(); setHover(null); }, [cancelHoverClose]);
  useEffect(() => cancelHoverClose, [cancelHoverClose]);

  // ── Layout: size every tower from its own floor/unit counts ────────────────
  const layout = useMemo(() => {
    let cursor = 0;
    const placed = towers.map((tower, ti) => {
      const floors    = tower.floors || [];
      const maxUnits  = Math.max(1, ...floors.map((f) => (f.units || []).length));
      const w = TAG_W + SIDE_PAD * 2 + maxUnits * WIN_W + (maxUnits - 1) * WIN_GAP;
      const h = floors.length * FLOOR_H + PARAPET;
      const x = cursor + w / 2;
      cursor += w + TOWER_GAP;
      const [accent, accent2] = TOWER_GRADIENTS[ti % TOWER_GRADIENTS.length];
      return { tower, ti, floors, w, h, x, accent, accent2 };
    });
    const totalW = Math.max(0, cursor - TOWER_GAP);
    // Re-centre the row on the world origin
    placed.forEach((p) => { p.x -= totalW / 2; });

    // The plot the wall encloses
    const siteW = Math.max(380, totalW + SITE_PAD_X * 2);
    const siteD = DEPTH + SITE_PAD_Z * 2;

    // ── Trees ────────────────────────────────────────────────────────────────
    // Placed deterministically (no RNG — the model must not reshuffle on every
    // render). Front-row trees only go in the gaps between towers, so they
    // never stand in front of a window.
    const inset  = 34;
    const halfW  = siteW / 2;
    const halfD  = siteD / 2;
    const trees  = [];

    const backCount = Math.max(3, Math.round(siteW / 140));
    for (let i = 0; i < backCount; i++) {
      const t = (i + 0.5) / backCount;
      trees.push({
        x: -halfW + inset + t * (siteW - inset * 2),
        z: -halfD + inset,
        s: i % 2 ? 1 : 0.88,
      });
    }
    for (const sx of [-1, 1]) {
      for (const tz of [-0.3, 0.24]) {
        trees.push({ x: sx * (halfW - inset), z: tz * siteD, s: tz < 0 ? 0.95 : 0.82 });
      }
    }
    const frontZ = halfD - inset;
    const gaps   = placed.slice(0, -1).map((p, i) =>
      (p.x + p.w / 2 + placed[i + 1].x - placed[i + 1].w / 2) / 2);
    gaps.push(-totalW / 2 - 58, totalW / 2 + 58);
    for (const gx of gaps) {
      // clear of the gate mouth, and inside the wall
      if (Math.abs(gx) > GATE_W / 2 + 42 && Math.abs(gx) < halfW - inset) {
        trees.push({ x: gx, z: frontZ, s: 0.8 });
      }
    }

    return { placed, totalW, siteW, siteD, trees, maxH: Math.max(0, ...placed.map((p) => p.h)) };
  }, [towers]);

  const stageH = clamp(layout.maxH * 1.3 + 210, 440, 780);

  // ── Fit the model to the container on mount / resize ───────────────────────
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const fit = () => {
      const avail = el.clientWidth - 72;
      // The wall, not the tower row, is now the widest thing in the scene.
      const need  = layout.siteW + layout.siteD * 0.35;
      setAutoFit(need > 0 ? clamp(avail / need, MIN_ZOOM, 1) : 1);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout.siteW, layout.siteD]);

  // ── Drag to orbit ──────────────────────────────────────────────────────────
  const drag     = useRef(null);
  const suppress = useRef(false);   // swallow the click that ends a drag

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    suppress.current = false;
    closeHoverNow();               // the card is anchored to a screen box the orbit is about to move
    drag.current = { x: e.clientX, y: e.clientY, rx, ry, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true;
    setRy(drag.current.ry + dx * 0.4);   // free spin — no azimuth limit
    setRx(clamp(drag.current.rx - dy * 0.24, RX_MIN, RX_MAX));
  };

  const endDrag = () => {
    if (!drag.current) return;
    suppress.current = drag.current.moved;
    drag.current = null;
  };

  // Wheel zoom needs a non-passive listener, which React's synthetic onWheel
  // cannot give us — so bind it by hand.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!e.ctrlKey && Math.abs(e.deltaY) < 1) return;
      e.preventDefault();
      closeHoverNow();   // zooming moves the window the card is pinned beside
      setZoom((z) => clamp(z - e.deltaY * 0.0012, MIN_ZOOM, MAX_ZOOM));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    // Same reason: the card is position:fixed against a rect captured on enter.
    window.addEventListener("scroll", closeHoverNow, true);
    return () => {
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", closeHoverNow, true);
    };
  }, [closeHoverNow]);

  const reset = () => { setRx(14); setRy((v) => nearestAngle(v, -22)); setZoom(1); };

  // A vacant unit has nothing to manage yet — landing on its empty state would
  // only ask for the same click again — so the intent travels with the unit and
  // the modal opens straight into the add-resident form.
  const handleWindowClick = useCallback((tower, floor, unit, intent) => {
    if (suppress.current) { suppress.current = false; return; }
    closeHoverNow();
    onUnitClick?.(tower, floor, unit, intent);
  }, [onUnitClick, closeHoverNow]);

  // ── Occupancy tallies for the legend ───────────────────────────────────────
  const tally = useMemo(() => {
    let total = 0, lit = 0;
    for (const t of towers) {
      for (const f of t.floors || []) {
        for (const u of f.units || []) {
          total += 1;
          if ((residentMap[u.id] || []).length > 0) lit += 1;
        }
      }
    }
    return { total, lit, dark: total - lit };
  }, [towers, residentMap]);

  if (towers.length === 0) return null;

  return (
    <div className={`s3d-root${night ? " s3d-root--night" : ""}`}>
      {/* ── Nameplate ───────────────────────────────────────────────────────── */}
      {societyName && (
        <div className="s3d-titlebar">
          <Icon iconName="CityNext" styles={{ root: { fontSize: 15 } }} />
          <span className="s3d-title">{societyName}</span>
          <span className="s3d-title-meta">
            {towers.length} tower{towers.length !== 1 ? "s" : ""} · {tally.total} home{tally.total !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* ── Control bar ─────────────────────────────────────────────────────── */}
      <div className="s3d-controls">
        <div className="s3d-legend">
          <span className="s3d-legend-item">
            <i className="s3d-swatch s3d-swatch--lit" />
            {tally.lit} occupied
          </span>
          <span className="s3d-legend-item">
            <i className="s3d-swatch s3d-swatch--dark" />
            {tally.dark} vacant
          </span>
          <span className="s3d-legend-hint">drag to orbit 360° · scroll to zoom · click a window to manage</span>
        </div>

        <div className="s3d-buttons">
          <button className="s3d-btn" onClick={() => setRy((v) => v - 20)} title="Rotate left">
            <Icon iconName="Rotate90CounterClockwise" styles={{ root: { fontSize: 13 } }} />
          </button>
          <button className="s3d-btn" onClick={() => setRy((v) => v + 20)} title="Rotate right">
            <Icon iconName="Rotate90Clockwise" styles={{ root: { fontSize: 13 } }} />
          </button>
          <button className="s3d-btn" onClick={() => setZoom((z) => clamp(z - 0.15, MIN_ZOOM, MAX_ZOOM))} title="Zoom out">
            <Icon iconName="Remove" styles={{ root: { fontSize: 13 } }} />
          </button>
          <button className="s3d-btn" onClick={() => setZoom((z) => clamp(z + 0.15, MIN_ZOOM, MAX_ZOOM))} title="Zoom in">
            <Icon iconName="Add" styles={{ root: { fontSize: 13 } }} />
          </button>
          <button className="s3d-btn" onClick={reset} title="Reset camera">
            <Icon iconName="Refresh" styles={{ root: { fontSize: 13 } }} />
          </button>
          <button
            className={`s3d-btn s3d-btn--toggle${night ? " s3d-btn--on" : ""}`}
            onClick={() => setNight((n) => !n)}
            title={night ? "Switch to day" : "Switch to night — lit windows are occupied homes"}
          >
            <Icon iconName={night ? "ClearNight" : "Sunny"} styles={{ root: { fontSize: 13 } }} />
            {night ? "Night" : "Day"}
          </button>
        </div>
      </div>

      {/* ── Stage ───────────────────────────────────────────────────────────── */}
      <div
        ref={stageRef}
        className="s3d-stage"
        style={{ height: stageH }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => { endDrag(); scheduleHoverClose(); }}
      >
        <div
          className="s3d-camera"
          style={{ transform: `translateY(${stageH * 0.2}px) scale(${zoom * autoFit}) rotateX(${rx}deg) rotateY(${ry}deg)` }}
        >
          {/* Ground haze, then the walled plot sitting a hair above it */}
          <div
            className="s3d-ground"
            style={{ width: layout.siteW + 240, height: layout.siteD + 200, transform: "translate(-50%,-50%) rotateX(90deg)" }}
          />
          <div
            className="s3d-plot"
            style={{ width: layout.siteW, height: layout.siteD, transform: "translate(-50%,-50%) rotateX(90deg) translateZ(0.5px)" }}
          />

          {/* ── Compound wall ─────────────────────────────────────────────────
              Back and sides are single runs; the front is two segments with the
              gate span left open between them. */}
          <div className="s3d-solid s3d-solid--wall" style={{ transform: `translateY(${-WALL_H / 2}px) translateZ(${-layout.siteD / 2}px)` }}>
            <BoxFaces w={layout.siteW} h={WALL_H} d={WALL_T} />
          </div>
          {[-1, 1].map((sx) => (
            <div
              key={`side${sx}`}
              className="s3d-solid s3d-solid--wall"
              style={{ transform: `translateX(${(sx * layout.siteW) / 2}px) translateY(${-WALL_H / 2}px)` }}
            >
              <BoxFaces w={WALL_T} h={WALL_H} d={layout.siteD} />
            </div>
          ))}
          {[-1, 1].map((sx) => (
            <div
              key={`front${sx}`}
              className="s3d-solid s3d-solid--wall"
              style={{
                transform: `translateX(${(sx * (layout.siteW + GATE_W)) / 4}px) translateY(${-WALL_H / 2}px) translateZ(${layout.siteD / 2}px)`,
              }}
            >
              <BoxFaces w={(layout.siteW - GATE_W) / 2} h={WALL_H} d={WALL_T} />
            </div>
          ))}

          {/* ── Gate: two pillars, two leaves, and a lintel carrying the name ── */}
          {[-1, 1].map((sx) => (
            <div
              key={`pillar${sx}`}
              className="s3d-solid s3d-solid--pillar"
              style={{ transform: `translateX(${(sx * GATE_W) / 2}px) translateY(${-PILLAR_H / 2}px) translateZ(${layout.siteD / 2}px)` }}
            >
              <BoxFaces w={PILLAR_W} h={PILLAR_H} d={PILLAR_W + 4} />
            </div>
          ))}
          {[-1, 1].map((sx) => (
            <div
              key={`leaf${sx}`}
              className="s3d-solid s3d-solid--gate"
              style={{
                transform: `translateX(${(sx * (GATE_W - PILLAR_W)) / 4}px) translateY(${-GATE_LEAF_H / 2}px) translateZ(${layout.siteD / 2}px)`,
              }}
            >
              <BoxFaces w={(GATE_W - PILLAR_W) / 2} h={GATE_LEAF_H} d={5} />
            </div>
          ))}
          <div
            className="s3d-solid s3d-solid--arch"
            style={{ transform: `translateY(${-(PILLAR_H + ARCH_H / 2)}px) translateZ(${layout.siteD / 2}px)` }}
          >
            <BoxFaces
              w={GATE_W + PILLAR_W} h={ARCH_H} d={PILLAR_W + 6}
              front={<span className="s3d-arch-name">{societyName}</span>}
            />
          </div>

          {/* ── Trees ─────────────────────────────────────────────────────────
              Each is two crossed planes carrying the same painted silhouette, so
              the canopy still has volume from any angle the camera can reach. */}
          {layout.trees.map((t, i) => (
            <div key={`tree${i}`} className="s3d-tree" style={{ transform: `translateX(${t.x}px) translateZ(${t.z}px)` }}>
              <div className="s3d-tree-plane" style={{ width: TREE_W * t.s, height: TREE_H * t.s }} />
              <div className="s3d-tree-plane s3d-tree-plane--cross" style={{ width: TREE_W * t.s, height: TREE_H * t.s }} />
            </div>
          ))}

          {layout.placed.map(({ tower, ti, floors, w, h, x, accent, accent2 }) => (
            <React.Fragment key={tower.id}>
              {/* Contact shadow on the ground */}
              <div
                className="s3d-shadow"
                style={{
                  width:  w + 70,
                  height: DEPTH + 70,
                  transform: `translate(-50%,-50%) translateX(${x}px) rotateX(90deg) translateZ(1px)`,
                }}
              />

              {/* Base slab */}
              <div
                className="s3d-solid s3d-solid--plinth"
                style={{ transform: `translateX(${x}px) translateY(${-PLINTH_H / 2}px)`, "--acc": accent }}
              >
                <BoxFaces w={w + 26} h={PLINTH_H} d={DEPTH + 26} />
              </div>

              {/* The tower itself */}
              <div
                className="s3d-solid s3d-tower"
                style={{ transform: `translateX(${x}px) translateY(${-(PLINTH_H + h / 2)}px)`, "--acc": accent, "--acc2": accent2 }}
              >
                <BoxFaces
                  w={w} h={h} d={DEPTH}
                  front={
                    <div className="s3d-facade">
                      <div className="s3d-parapet" style={{ height: PARAPET }}>
                        <span className="s3d-tower-name">{tower.name}</span>
                      </div>

                      {/* column-reverse so floor 1 sits on the ground */}
                      <div className="s3d-floors">
                        {floors.map((floor) => {
                          const units = floor.units || [];
                          return (
                            <div key={floor.id} className="s3d-floor" style={{ height: FLOOR_H }}>
                              <div className="s3d-floor-tag" style={{ width: TAG_W }}>{floor.floor_number}</div>
                              <div className="s3d-windows" style={{ gap: WIN_GAP }}>
                                {units.map((unit) => {
                                  const residents = residentMap[unit.id] || [];
                                  const lit       = residents.length > 0;
                                  const isSel     = selectedUnitId === unit.id;
                                  return (
                                    <button
                                      key={unit.id}
                                      type="button"
                                      className={
                                        "s3d-window"
                                        + (lit ? " s3d-window--lit" : " s3d-window--vacant")
                                        + (isSel ? " s3d-window--selected" : "")
                                      }
                                      style={{ width: WIN_W }}
                                      onClick={() => handleWindowClick(tower, floor, unit, lit ? "manage" : "add")}
                                      onPointerEnter={(e) => {
                                        cancelHoverClose();
                                        setHover({
                                          rect: e.currentTarget.getBoundingClientRect(),
                                          unit, floor, tower, residents,
                                        });
                                      }}
                                      onPointerLeave={() => scheduleHoverClose()}
                                    >
                                      <span className="s3d-window-num" style={{ height: LABEL_H }}>
                                        {unit.unit_number}
                                      </span>
                                      <span className="s3d-glass" style={{ height: WIN_H }}>
                                        {lit && residents.length > 1 && (
                                          <span className="s3d-glass-count">{residents.length}</span>
                                        )}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  }
                />
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Hover card ─────────────────────────────────────────────────────────
          Fixed to the viewport so the 3D transform can't skew it, and anchored
          to the window's screen box: it sits beside the window (flipping to the
          other side near the viewport edge) instead of chasing the cursor, so
          the pointer can be walked into it and land on the button. */}
      {hover && (() => {
        const r      = hover.rect;
        const flip   = r.right + TIP_GAP + TIP_W > window.innerWidth - 8;
        const left   = clamp(flip ? r.left - TIP_GAP - TIP_W : r.right + TIP_GAP,
                             8, Math.max(8, window.innerWidth - TIP_W - 8));
        const top    = clamp(r.top - 10, 8, Math.max(8, window.innerHeight - TIP_MAX_H - 8));
        const vacant = hover.residents.length === 0;
       const manage = () => {
         closeHoverNow();
         onUnitClick?.(hover.tower, hover.floor, hover.unit, vacant ? "add" : "manage");
       };
        return (
          <div
            className="s3d-tip"
            style={{ left, top }}
            onPointerEnter={cancelHoverClose}
            onPointerLeave={() => scheduleHoverClose(0)}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="s3d-tip-head">
              <span className="s3d-tip-unit">{hover.unit.unit_number}</span>
              <span className="s3d-tip-loc">{hover.tower.name} · Floor {hover.floor.floor_number}</span>
            </div>
            {vacant ? (
              <div className="s3d-tip-vacant">
                <Icon iconName="Home" styles={{ root: { fontSize: 11 } }} />
                Vacant — no residents yet
              </div>
            ) : (
              hover.residents.map((res) => (
                <div key={res.id} className="s3d-tip-resident">
                  <div className="s3d-tip-name">{res.name}</div>
                  <div className="s3d-tip-meta">
                    {res.resident_type === "TENANT" ? "Tenant" : "Owner"}
                    {res.bhk ? ` · ${res.bhk}` : ""}
                    {res.phone ? ` · ${res.phone}` : ""}
                  </div>
                </div>
              ))
            )}
            <div className="s3d-tip-actions">
              <button type="button" className="s3d-tip-btn" onClick={manage}>
                <Icon
                  iconName={vacant ? "AddFriend" : "ContactCard"}
                  styles={{ root: { fontSize: 12 } }}
                />
                {vacant ? "Assign a resident" : "Manage this home"}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
