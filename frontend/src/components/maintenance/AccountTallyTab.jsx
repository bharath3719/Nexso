import React, { useEffect, useState } from "react";
import { Spinner, Icon } from "@fluentui/react";
import { api } from "../../services/api.js";
import { fmtINR2 } from "./MaintenanceShared.jsx";
import { formatMonth } from "../../utils/formatDate.js";

function fmtSurplus(val) {
  const n = Number(val);
  if (n > 0) return <span style={{ color: "#16a34a" }}>+₹{Math.abs(n).toLocaleString("en-IN")}</span>;
  if (n < 0) return <span style={{ color: "#dc2626" }}>-₹{Math.abs(n).toLocaleString("en-IN")}</span>;
  return <span style={{ color: "#64748b" }}>₹0</span>;
}

export function AccountTallyTab({ showToast }) {
  const [year,        setYear]        = useState(String(new Date().getFullYear()));
  const [tally,       setTally]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await api.secretary.maintenance.getTally(year);
        if (!cancelled) setTally(data.tally || []);
      } catch {
        if (!cancelled) showToast("Failed to load tally.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [year, showToast]);

  const downloadClosure = async (month) => {
    setDownloading(month);
    try {
      await api.secretary.maintenance.downloadClosurePdf(month);
    } catch {
      showToast("Failed to download closure PDF.");
    } finally {
      setDownloading(null);
    }
  };

  const totals = tally.reduce((acc, row) => {
    acc.billed    += Number(row.total_billed    || 0);
    acc.collected += Number(row.total_collected || 0);
    acc.expenses  += Number(row.total_expenses  || 0);
    acc.surplus   += Number(row.surplus_deficit || 0);
    return acc;
  }, { billed: 0, collected: 0, expenses: 0, surplus: 0 });

  return (
    <div className="maint-tally">
      <div className="maint-controls" style={{ marginBottom: 16 }}>
        <div className="maint-filter-row">
          <span className="maint-filter-label">Year:</span>
          <select className="maint-filter-select" value={year} onChange={(e) => setYear(e.target.value)}>
            {[0, 1, 2].map((offset) => {
              const y = String(new Date().getFullYear() - offset);
              return <option key={y} value={y}>{y}</option>;
            })}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="sec-spinner-center"><Spinner label="Loading tally…" /></div>
      ) : tally.length === 0 ? (
        <div className="maint-empty">No dues data found for {year}. Generate dues first.</div>
      ) : (
        <div className="maint-card">
          <table className="maint-table maint-tally-table">
            <thead>
              <tr>
                <th>Month</th>
                <th style={{ textAlign: "right" }}>Billed</th>
                <th style={{ textAlign: "right" }}>Collected</th>
                <th style={{ textAlign: "right" }}>Expenses</th>
                <th style={{ textAlign: "right" }}>Surplus / Deficit</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tally.map((row) => (
                <tr key={row.month}>
                  <td style={{ fontWeight: 600 }}>{formatMonth(row.month)}</td>
                  <td style={{ textAlign: "right" }}>₹{Number(row.total_billed).toLocaleString("en-IN")}</td>
                  <td style={{ textAlign: "right", color: "#16a34a" }}>₹{Number(row.total_collected).toLocaleString("en-IN")}</td>
                  <td style={{ textAlign: "right", color: "#7c3aed" }}>₹{Number(row.total_expenses).toLocaleString("en-IN")}</td>
                  <td style={{ textAlign: "right" }}>{fmtSurplus(row.surplus_deficit)}</td>
                  <td>
                    <span className={`maint-badge ${row.status === "CLOSED" ? "maint-badge--closed" : "maint-badge--PENDING"}`}>
                      {row.status === "CLOSED" ? "Closed" : "Open"}
                    </span>
                  </td>
                  <td>
                    {row.status === "CLOSED" && (
                      <button className="maint-btn-pdf" onClick={() => downloadClosure(row.month)}
                        disabled={downloading === row.month} title="Download closure PDF">
                        {downloading === row.month ? "…" : <Icon iconName="PDF" />}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700, background: "#f1f5f9" }}>
                <td>Year Total ({year})</td>
                <td style={{ textAlign: "right" }}>₹{totals.billed.toLocaleString("en-IN")}</td>
                <td style={{ textAlign: "right", color: "#16a34a" }}>₹{totals.collected.toLocaleString("en-IN")}</td>
                <td style={{ textAlign: "right", color: "#7c3aed" }}>₹{totals.expenses.toLocaleString("en-IN")}</td>
                <td style={{ textAlign: "right" }}>{fmtSurplus(totals.surplus)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
