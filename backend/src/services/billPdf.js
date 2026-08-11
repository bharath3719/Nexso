import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit";
import { dbQuery } from "../db/index.js";
import { previousMonth, isValidMonth } from "../utils/params.js";
import { billUrlSecret } from "../utils/secrets.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Where generated bill PDFs live. Exported so server.js serves /bills from the
 * same directory this writes to — two independently-built paths drift.
 *
 * These files must outlive the container. On Render (and any host with an
 * ephemeral filesystem) the default in-repo path is wiped on every deploy,
 * restart and instance move, which 404s every bill link already delivered to a
 * resident. Set BILLS_DIR to a mounted persistent disk there.
 */
export const BILLS_DIR = process.env.BILLS_DIR
  ? path.resolve(process.env.BILLS_DIR)
  : path.join(__dirname, "..", "..", "bills");

fs.mkdirSync(BILLS_DIR, { recursive: true });

const DEFAULT_FIXED_ITEMS = [
  { particulars: "Sinking Fund",            total_amount: 0 },
  { particulars: "Structural Repair Fee",   total_amount: 0 },
  { particulars: "Insurance",               total_amount: 0 },
  { particulars: "Parking Fee",             total_amount: 0 },
  { particulars: "Security Fee",            total_amount: 0 },
  { particulars: "Housekeeping Fee",        total_amount: 0 },
  { particulars: "Society Management Fee",  total_amount: 0 },
  { particulars: "Lift Maintenance AMC",    total_amount: 0 },
];

const DEFAULT_VARIABLE_ITEMS = [
  { particulars: "Garbage Collection Fee",  total_amount: 0 },
  { particulars: "Electricity Bill",        total_amount: 0 },
  { particulars: "Generator Fuel",          total_amount: 0 },
  { particulars: "Water Tank Cleaning Fee", total_amount: 0 },
  { particulars: "Non-Occupancy Charges",   total_amount: 0 },
];

// ── Shared PDF helpers ────────────────────────────────────────────────────────

function inr(n) {
  return `Rs.${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function monthLabel(m) {
  if (!isValidMonth(m)) return m || "";
  return new Date(m + "-01").toLocaleString("en-IN", { month: "long", year: "numeric" });
}

function fmtDate(d) {
  if (!d) return "—";
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const BRAND   = "#2563EB";
const LIGHT   = "#EFF6FF";
const MUTED   = "#6B7280";
const SUCCESS = "#10b981";
const DANGER  = "#ef4444";
const WARN    = "#f59e0b";

function drawPageHeader(doc, society) {
  const W = doc.page.width - 100;
  doc.rect(50, 50, W, 70).fillColor(BRAND).fill();
  doc.fillColor("#FFFFFF").fontSize(18).font("Helvetica-Bold")
     .text("NEXSO SOCIETY MANAGEMENT", 65, 56, { width: W - 20 });
  doc.fontSize(11).font("Helvetica")
     .text(society.name || "", 65, 78);
  if (society.address) {
    doc.fontSize(8).text(society.address, 65, 92, { width: W - 20 });
  }
  return 135; // returns starting y
}

// ── computeBill ───────────────────────────────────────────────────────────────

export async function computeBill(societyId, residentId, month) {
  const [sheetRes, resRes, countRes, socRes] = await Promise.all([
    dbQuery(
      `SELECT * FROM maintenance_expense_sheets WHERE society_id = $1 AND month = $2`,
      [societyId, month],
    ),
    dbQuery(
      `SELECT r.name, r.phone, u.unit_number,
              COALESCE(td.name, tf.name) AS tower_name,
              ms.amount AS base_amount,
              ms.due_day
       FROM residents r
       JOIN units u ON u.id = r.unit_id
       LEFT JOIN towers td ON td.id = u.tower_id
       LEFT JOIN floors f  ON f.id  = u.floor_id
       LEFT JOIN towers tf ON tf.id = f.tower_id
       LEFT JOIN maintenance_settings ms ON ms.unit_id = r.unit_id
       WHERE r.id = $1 AND r.society_id = $2`,
      [residentId, societyId],
    ),
    // Must match the divisor the secretary's bill-preview uses, or the PDF
    // total won't agree with the figure the preview showed.
    dbQuery(
      `SELECT COUNT(*) AS count FROM maintenance_settings
       WHERE society_id = $1 AND enabled = TRUE AND unit_id IS NOT NULL`,
      [societyId],
    ),
    dbQuery(
      `SELECT name, address FROM societies WHERE id = $1`,
      [societyId],
    ),
  ]);

  if (!resRes?.rows?.length) throw new Error("resident_not_found");

  const resident   = resRes.rows[0];
  const sheet      = sheetRes?.rows?.[0];
  const unitCount  = Math.max(1, Number(countRes?.rows?.[0]?.count || 1));
  const baseAmount = Number(resident.base_amount || 0);

  const fixedItems = (sheet?.fixed_items || DEFAULT_FIXED_ITEMS).map((item) => ({
    particulars:  item.particulars,
    total_amount: Number(item.total_amount || 0),
    per_unit:     Math.round((Number(item.total_amount || 0) / unitCount) * 100) / 100,
  }));

  const variableItems = (sheet?.variable_items || DEFAULT_VARIABLE_ITEMS).map((item) => ({
    particulars:  item.particulars,
    total_amount: Number(item.total_amount || 0),
    per_unit:     Math.round((Number(item.total_amount || 0) / unitCount) * 100) / 100,
  }));

  const fixedTotal    = fixedItems.reduce((s, i) => s + i.per_unit, 0);
  const variableTotal = variableItems.reduce((s, i) => s + i.per_unit, 0);
  const expenseShare  = Math.round((fixedTotal + variableTotal) * 100) / 100;

  const prevMonth = previousMonth(month);

  const prevRes = await dbQuery(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM maintenance_dues
     WHERE resident_id = $1 AND due_month = $2 AND status IN ('PENDING','OVERDUE')`,
    [residentId, prevMonth],
  );
  const previouslyDue  = Number(prevRes?.rows?.[0]?.total || 0);
  const interestRate   = Number(sheet?.interest_rate || 21.0);
  const interestAmount = Math.round((previouslyDue * interestRate / 1200) * 100) / 100;
  const total          = Math.round((baseAmount + expenseShare + previouslyDue + interestAmount) * 100) / 100;
  const society        = socRes?.rows?.[0] || {};

  return {
    society:         { name: society.name || "", address: society.address || "" },
    resident:        {
      name:        resident.name,
      unit_number: resident.tower_name
        ? `${resident.tower_name} · ${resident.unit_number}`
        : resident.unit_number,
    },
    month,
    fixed_items:     fixedItems,
    variable_items:  variableItems,
    fixed_total:     Math.round(fixedTotal    * 100) / 100,
    variable_total:  Math.round(variableTotal * 100) / 100,
    base_amount:     baseAmount,
    expense_share:   expenseShare,
    previously_due:  previouslyDue,
    interest_rate:   interestRate,
    interest_amount: interestAmount,
    total,
    unit_count:      unitCount,
  };
}

// ── Invoice number ─────────────────────────────────────────────────────────────
// Assigns a stable invoice number the first time a due's PDF is requested.
// Format: {SOCIETY_CODE}/{YYYY-MM}/{DUE_ID_PADDED}

export async function getOrCreateInvoiceNumber(dueId, societyId, societyCode) {
  const existing = await dbQuery(
    `SELECT invoice_number FROM maintenance_invoices WHERE due_id = $1`,
    [dueId],
  );
  if (existing?.rows?.length) return existing.rows[0].invoice_number;

  const due = await dbQuery(`SELECT due_month FROM maintenance_dues WHERE id = $1`, [dueId]);
  const month = due?.rows?.[0]?.due_month || new Date().toISOString().slice(0, 7);

  const code     = (societyCode || "SOC").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 8);
  const padded   = String(dueId).padStart(5, "0");
  const invoiceNo = `${code}/${month}/${padded}`;

  await dbQuery(
    `INSERT INTO maintenance_invoices (due_id, society_id, invoice_number)
     VALUES ($1, $2, $3) ON CONFLICT (due_id) DO NOTHING`,
    [dueId, societyId, invoiceNo],
  );

  return invoiceNo;
}

// ── generateBillPdf ───────────────────────────────────────────────────────────

export function generateBillPdf(bill, paymentLink = null, upiId = null, invoiceNumber = null) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end",  () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - 100;

    let y = drawPageHeader(doc, bill.society);

    // ── Invoice meta bar ─────────────────────────────────────────────────────
    doc.rect(50, y, W, 52).fillColor(LIGHT).fill();
    doc.fillColor("#111827").fontSize(9).font("Helvetica-Bold").text("Resident:", 65, y + 9);
    doc.font("Helvetica").text(bill.resident.name, 130, y + 9);
    doc.font("Helvetica-Bold").text("Unit:", 65, y + 25);
    doc.font("Helvetica").text(bill.resident.unit_number || "—", 130, y + 25);

    const ml = monthLabel(bill.month);
    doc.fontSize(11).font("Helvetica-Bold").fillColor(BRAND)
       .text(ml, 50, y + 9, { align: "right", width: W });

    if (invoiceNumber) {
      doc.fontSize(8).font("Helvetica").fillColor(MUTED)
         .text(`Invoice: ${invoiceNumber}`, 50, y + 38, { align: "right", width: W });
    }

    y += 65;

    // ── Table helpers ─────────────────────────────────────────────────────────
    function tableHeader(label) {
      doc.rect(50, y, W, 22).fillColor(BRAND).fill();
      doc.fillColor("#FFFFFF").fontSize(9).font("Helvetica-Bold")
         .text(label, 62, y + 6);
      doc.text("Society Total", 310, y + 6, { width: 100, align: "right" });
      doc.text("Per Unit", 420, y + 6, { width: W - 370, align: "right" });
      y += 22;
    }

    function tableRow(label, total, perUnit, shade) {
      if (shade) doc.rect(50, y, W, 18).fillColor("#F9FAFB").fill();
      doc.fillColor("#111827").fontSize(9).font("Helvetica")
         .text(label, 62, y + 4, { width: 240 });
      doc.fillColor(MUTED)
         .text(inr(total), 310, y + 4, { width: 100, align: "right" });
      doc.fillColor("#111827")
         .text(inr(perUnit), 420, y + 4, { width: W - 370, align: "right" });
      y += 18;
      doc.moveTo(50, y).lineTo(50 + W, y).strokeColor("#E5E7EB").lineWidth(0.5).stroke();
    }

    // ── Fixed items ───────────────────────────────────────────────────────────
    const activeFixed = bill.fixed_items.filter((i) => i.total_amount > 0);
    if (activeFixed.length) {
      tableHeader("FIXED EXPENSES");
      activeFixed.forEach((item, idx) =>
        tableRow(item.particulars, item.total_amount, item.per_unit, idx % 2 === 1));
      y += 6;
    }

    // ── Variable items ────────────────────────────────────────────────────────
    const activeVariable = bill.variable_items.filter((i) => i.total_amount > 0);
    if (activeVariable.length) {
      tableHeader("VARIABLE EXPENSES");
      activeVariable.forEach((item, idx) =>
        tableRow(item.particulars, item.total_amount, item.per_unit, idx % 2 === 1));
      y += 6;
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    doc.rect(50, y, W, 22).fillColor(BRAND).fill();
    doc.fillColor("#FFFFFF").fontSize(9).font("Helvetica-Bold").text("BILL SUMMARY", 62, y + 6);
    y += 22;

    let shade = false;
    function summaryRow(label, value, colour) {
      if (shade) doc.rect(50, y, W, 18).fillColor("#F9FAFB").fill();
      doc.fillColor("#111827").fontSize(9).font("Helvetica").text(label, 62, y + 4);
      doc.fillColor(colour || "#111827")
         .text(inr(value), 50, y + 4, { align: "right", width: W });
      y += 18;
      doc.moveTo(50, y).lineTo(50 + W, y).strokeColor("#E5E7EB").lineWidth(0.5).stroke();
      shade = !shade;
    }

    summaryRow("Base Maintenance",                                              bill.base_amount);
    summaryRow(`Expense Share (${bill.unit_count} units)`,                      bill.expense_share);
    if (bill.previously_due > 0) {
      summaryRow("Previously Due (Arrears)",                                    bill.previously_due, DANGER);
      summaryRow(`Interest on Arrears @ ${bill.interest_rate}% p.a.`,          bill.interest_amount, DANGER);
    }

    y += 4;
    doc.rect(50, y, W, 24).fillColor(BRAND).fill();
    doc.fillColor("#FFFFFF").fontSize(11).font("Helvetica-Bold")
       .text("TOTAL AMOUNT DUE", 62, y + 6);
    doc.text(inr(bill.total), 50, y + 6, { align: "right", width: W });
    y += 30;

    // ── Payment details ───────────────────────────────────────────────────────
    if (paymentLink || upiId) {
      y += 10;
      doc.fontSize(9).font("Helvetica-Bold").fillColor(BRAND).text("HOW TO PAY", 50, y);
      y += 14;
      if (paymentLink) {
        doc.fontSize(9).font("Helvetica").fillColor("#111827")
           .text("Pay Online: ", 50, y, { continued: true })
           .fillColor(BRAND).text(paymentLink, { underline: true });
        y += 14;
      }
      if (upiId) {
        doc.fillColor("#111827").font("Helvetica")
           .text("UPI ID: ", 50, y, { continued: true })
           .font("Helvetica-Bold").text(upiId);
        y += 14;
      }
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 50;
    doc.rect(50, footerY - 12, W, 0.5).fillColor("#E5E7EB").fill();
    doc.fontSize(8).font("Helvetica").fillColor(MUTED)
       .text(
         "This is a computer-generated document. For queries, contact your society management.",
         50, footerY, { align: "center", width: W },
       );

    doc.end();
  });
}

// ── generateCollectionRegisterPdf ─────────────────────────────────────────────
// Tabular register of all dues for a month — what the secretary uses for records.

export function generateCollectionRegisterPdf(dues, stats, society, month, closureStatus = "OPEN") {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, layout: "landscape" });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end",  () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W  = doc.page.width  - 100;
    const ml = monthLabel(month);

    // ── Page header ───────────────────────────────────────────────────────────
    doc.rect(50, 50, W, 65).fillColor(BRAND).fill();
    doc.fillColor("#FFFFFF").fontSize(16).font("Helvetica-Bold")
       .text("MAINTENANCE COLLECTION REGISTER", 65, 56, { width: W - 20 });
    doc.fontSize(11).font("Helvetica").text(`${society.name || ""}  —  ${ml}`, 65, 78);
    if (society.address) {
      doc.fontSize(8).text(society.address, 65, 94, { width: W - 20 });
    }

    let y = 130;

    // ── Status banner ─────────────────────────────────────────────────────────
    const bannerColor = closureStatus === "CLOSED" ? "#1e3a5f" : "#374151";
    doc.rect(50, y, W, 20).fillColor(bannerColor).fill();
    doc.fillColor("#FFFFFF").fontSize(8).font("Helvetica-Bold")
       .text(`Status: ${closureStatus === "CLOSED" ? "ACCOUNTS CLOSED" : "OPEN — Not Yet Closed"}  |  Generated: ${fmtDate(new Date())}`, 62, y + 6);
    y += 28;

    // ── Column definitions (landscape) ───────────────────────────────────────
    const COL = {
      sl:    { x: 50,  w: 30  },
      name:  { x: 80,  w: 165 },
      unit:  { x: 245, w: 80  },
      amt:   { x: 325, w: 80  },
      date:  { x: 405, w: 80  },
      status:{ x: 485, w: 65  },
      ref:   { x: 550, w: W - 500 },
    };

    // Table header row
    doc.rect(50, y, W, 20).fillColor("#1e293b").fill();
    doc.fillColor("#FFFFFF").fontSize(8).font("Helvetica-Bold");
    [["Sl", COL.sl], ["Resident", COL.name], ["Unit", COL.unit],
     ["Amount", COL.amt], ["Due Date", COL.date], ["Status", COL.status], ["Payment Ref", COL.ref]
    ].forEach(([label, col]) => {
      doc.text(label, col.x + 3, y + 6, { width: col.w - 6, align: col === COL.amt ? "right" : "left" });
    });
    y += 20;

    // Table rows
    dues.forEach((due, idx) => {
      const rowH = 16;
      if (idx % 2 === 0) doc.rect(50, y, W, rowH).fillColor("#F8FAFC").fill();
      else               doc.rect(50, y, W, rowH).fillColor("#FFFFFF").fill();

      const statusColor =
        due.status === "PAID"    ? SUCCESS :
        due.status === "OVERDUE" ? DANGER  :
        due.status === "WAIVED"  ? MUTED   : "#374151";

      doc.fillColor("#111827").fontSize(8).font("Helvetica");
      doc.text(String(idx + 1),             COL.sl.x   + 3, y + 4, { width: COL.sl.w   - 6 });
      doc.text(due.resident_name || "—",    COL.name.x + 3, y + 4, { width: COL.name.w - 6 });
      const unitLabel = due.tower_name ? `${due.tower_name}·${due.unit_number}` : (due.unit_number || "—");
      doc.text(unitLabel,                   COL.unit.x + 3, y + 4, { width: COL.unit.w - 6 });
      doc.text(inr(due.amount),             COL.amt.x  + 3, y + 4, { width: COL.amt.w  - 6, align: "right" });
      doc.text(fmtDate(due.due_date),       COL.date.x + 3, y + 4, { width: COL.date.w - 6 });
      doc.fillColor(statusColor).font("Helvetica-Bold")
         .text(due.status,                  COL.status.x + 3, y + 4, { width: COL.status.w - 6 });
      doc.fillColor(MUTED).font("Helvetica")
         .text(due.payment_reference || "—", COL.ref.x  + 3, y + 4, { width: COL.ref.w  - 6 });

      y += rowH;
      doc.moveTo(50, y).lineTo(50 + W, y).strokeColor("#E5E7EB").lineWidth(0.3).stroke();

      // New page if needed
      if (y > doc.page.height - 120) {
        doc.addPage({ size: "A4", layout: "landscape" });
        y = 50;
      }
    });

    y += 16;

    // ── Summary totals ────────────────────────────────────────────────────────
    doc.rect(50, y, W, 22).fillColor(BRAND).fill();
    doc.fillColor("#FFFFFF").fontSize(9).font("Helvetica-Bold").text("SUMMARY", 62, y + 6);
    y += 22;

    const summaries = [
      ["Total Billed", inr(stats.totalAmount)],
      ["Collected", inr(stats.collectedAmount)],
      ["Pending", `${stats.pending} dues`],
      ["Overdue", `${stats.overdue} dues`],
      ["Waived", inr(dues.filter(d => d.status === "WAIVED").reduce((s, d) => s + Number(d.amount || 0), 0))],
    ];

    const colW = W / summaries.length;
    doc.rect(50, y, W, 36).fillColor(LIGHT).fill();
    summaries.forEach(([label, val], i) => {
      doc.fillColor(MUTED).fontSize(7).font("Helvetica")
         .text(label, 50 + i * colW + 8, y + 6, { width: colW - 16 });
      doc.fillColor("#111827").fontSize(10).font("Helvetica-Bold")
         .text(val, 50 + i * colW + 8, y + 18, { width: colW - 16 });
    });
    y += 44;

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.rect(50, y, W, 0.5).fillColor("#E5E7EB").fill();
    y += 8;
    doc.fontSize(8).font("Helvetica").fillColor(MUTED)
       .text("Nexso Society Management Platform  —  nexso.in", 50, y, { align: "center", width: W });

    doc.end();
  });
}

// ── generateClosurePdf ────────────────────────────────────────────────────────
// Monthly Account Closure Statement — the document the secretary archives.

export function generateClosurePdf(closure, expenseSheet, society) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end",  () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W  = doc.page.width - 100;
    const ml = monthLabel(closure.month);

    // ── Page header ───────────────────────────────────────────────────────────
    let y = drawPageHeader(doc, society);

    // Title band
    doc.rect(50, y, W, 28).fillColor("#1e293b").fill();
    doc.fillColor("#FFFFFF").fontSize(13).font("Helvetica-Bold")
       .text("MONTHLY ACCOUNT CLOSURE STATEMENT", 50, y + 8, { align: "center", width: W });
    y += 36;

    doc.fontSize(12).font("Helvetica-Bold").fillColor("#111827")
       .text(ml, 50, y, { align: "center", width: W });
    y += 24;

    // ── Section helper ────────────────────────────────────────────────────────
    function sectionHeader(title, color = BRAND) {
      doc.rect(50, y, W, 22).fillColor(color).fill();
      doc.fillColor("#FFFFFF").fontSize(10).font("Helvetica-Bold").text(title, 62, y + 6);
      y += 22;
    }

    function summaryRow(label, value, bold = false, color = "#111827") {
      doc.rect(50, y, W, 20).fillColor("#F8FAFC").fill();
      doc.fillColor(color).fontSize(9)
         .font(bold ? "Helvetica-Bold" : "Helvetica")
         .text(label, 62, y + 5, { width: W - 120 });
      doc.font("Helvetica-Bold").fillColor(color)
         .text(inr(value), 50, y + 5, { align: "right", width: W });
      y += 20;
      doc.moveTo(50, y).lineTo(50 + W, y).strokeColor("#E5E7EB").lineWidth(0.3).stroke();
    }

    // ── Income section ────────────────────────────────────────────────────────
    sectionHeader("INCOME", "#166534");
    summaryRow(`Maintenance Collected  (${closure.total_dues} dues generated)`, closure.total_collected);
    summaryRow("Waived (non-collectible)", closure.total_waived, false, MUTED);
    summaryRow("Outstanding Arrears carried forward", closure.total_overdue, false, DANGER);
    y += 4;
    doc.rect(50, y, W, 22).fillColor("#dcfce7").fill();
    doc.fillColor("#166534").fontSize(10).font("Helvetica-Bold")
       .text("TOTAL INCOME (COLLECTED)", 62, y + 6);
    doc.text(inr(closure.total_collected), 50, y + 6, { align: "right", width: W });
    y += 30;

    // ── Expenditure section ───────────────────────────────────────────────────
    sectionHeader("EXPENDITURE", "#7f1d1d");
    const allItems = [
      ...(expenseSheet?.fixed_items    || []),
      ...(expenseSheet?.variable_items || []),
    ];
    if (allItems.length > 0) {
      allItems.forEach((item) => {
        if (Number(item.total_amount) > 0) {
          summaryRow(item.particulars, item.total_amount);
        }
      });
    } else {
      doc.fillColor(MUTED).fontSize(9).font("Helvetica")
         .text("No expense sheet saved for this month.", 62, y + 5);
      y += 20;
    }
    y += 4;
    doc.rect(50, y, W, 22).fillColor("#fee2e2").fill();
    doc.fillColor("#7f1d1d").fontSize(10).font("Helvetica-Bold")
       .text("TOTAL EXPENDITURE", 62, y + 6);
    doc.text(inr(closure.total_expenses), 50, y + 6, { align: "right", width: W });
    y += 30;

    // ── Surplus / Deficit ─────────────────────────────────────────────────────
    const surplus = Number(closure.surplus_deficit);
    const isPositive = surplus >= 0;
    doc.rect(50, y, W, 30).fillColor(isPositive ? "#dcfce7" : "#fee2e2").fill();
    doc.fillColor(isPositive ? "#166534" : "#7f1d1d")
       .fontSize(13).font("Helvetica-Bold")
       .text(isPositive ? "SURPLUS FOR THE MONTH" : "DEFICIT FOR THE MONTH", 62, y + 8);
    doc.text(inr(Math.abs(surplus)), 50, y + 8, { align: "right", width: W });
    y += 38;

    // ── Arrears note ──────────────────────────────────────────────────────────
    if (Number(closure.total_overdue) > 0) {
      doc.rect(50, y, W, 22).fillColor(WARN + "33").fill();
      doc.fillColor("#92400e").fontSize(9).font("Helvetica-Bold")
         .text(`Arrears of ${inr(closure.total_overdue)} carried forward to next month.`, 62, y + 6);
      y += 30;
    }

    // ── Closure metadata ──────────────────────────────────────────────────────
    y += 10;
    doc.rect(50, y, W, 0.5).fillColor("#CBD5E1").fill();
    y += 12;
    doc.fillColor(MUTED).fontSize(8).font("Helvetica")
       .text(`Accounts closed on: ${fmtDate(closure.closed_at)}`, 62, y);
    if (closure.closed_by_username) {
      y += 14;
      doc.text(`Closed by: ${closure.closed_by_username}`, 62, y);
    }
    if (closure.notes) {
      y += 14;
      doc.text(`Notes: ${closure.notes}`, 62, y, { width: W - 30 });
    }

    // ── Signature block ───────────────────────────────────────────────────────
    y += 36;
    doc.moveTo(50 + W - 200, y).lineTo(50 + W, y).strokeColor("#374151").lineWidth(0.8).stroke();
    y += 8;
    doc.fillColor(MUTED).fontSize(8).font("Helvetica")
       .text("Secretary's Signature", 50 + W - 200, y, { width: 200, align: "center" });

    // ── Footer ────────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 50;
    doc.rect(50, footerY - 12, W, 0.5).fillColor("#E5E7EB").fill();
    doc.fontSize(8).font("Helvetica").fillColor(MUTED)
       .text(
         "This is a computer-generated document. For queries, contact your society management.",
         50, footerY, { align: "center", width: W },
       );

    doc.end();
  });
}

// ── saveBillAndGetUrl (unchanged — used by WhatsApp flow) ─────────────────────

/**
 * Unguessable but stable filename for a resident's bill.
 *
 * `bill-{societyId}-{residentId}-{month}.pdf` was trivially enumerable, and
 * /bills is served as unauthenticated static files — so anyone could walk small
 * integers and pull every resident's name, unit and arrears. Deriving the name
 * from a keyed HMAC keeps it stable (regenerating a bill reuses one file rather
 * than growing the directory) while making it infeasible to guess.
 */
function billFilename(societyId, residentId, month) {
  const digest = crypto
    .createHmac("sha256", billUrlSecret())
    .update(`bill:${societyId}:${residentId}:${month}`)
    .digest("hex")
    .slice(0, 32);
  return `bill-${digest}.pdf`;
}

export async function saveBillAndGetUrl(societyId, residentId, month, paymentLink = null, upiId = null) {
  const bill     = await computeBill(societyId, residentId, month);
  const buffer   = await generateBillPdf(bill, paymentLink, upiId);
  const filename = billFilename(societyId, residentId, month);
  const filepath = path.join(BILLS_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  const baseUrl = (process.env.BACKEND_PUBLIC_URL || "").replace(/\/+$/, "");
  return { url: `${baseUrl}/bills/${filename}`, bill };
}
