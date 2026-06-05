import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit";
import { dbQuery } from "../db/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BILLS_DIR = path.join(__dirname, "..", "..", "bills");

fs.mkdirSync(BILLS_DIR, { recursive: true });

const DEFAULT_FIXED_ITEMS = [
  { particulars: "Sinking Fund", total_amount: 0 },
  { particulars: "Structural Repair Fee", total_amount: 0 },
  { particulars: "Insurance", total_amount: 0 },
  { particulars: "Parking Fee", total_amount: 0 },
  { particulars: "Security Fee", total_amount: 0 },
  { particulars: "Housekeeping Fee", total_amount: 0 },
  { particulars: "Society Management Fee", total_amount: 0 },
  { particulars: "Lift Maintenance AMC", total_amount: 0 },
];

const DEFAULT_VARIABLE_ITEMS = [
  { particulars: "Garbage Collection Fee", total_amount: 0 },
  { particulars: "Electricity Bill", total_amount: 0 },
  { particulars: "Generator Fuel", total_amount: 0 },
  { particulars: "Water Tank Cleaning Fee", total_amount: 0 },
  { particulars: "Non-Occupancy Charges", total_amount: 0 },
];

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
       LEFT JOIN maintenance_settings ms ON ms.resident_id = r.id
       WHERE r.id = $1 AND r.society_id = $2`,
      [residentId, societyId],
    ),
    dbQuery(
      `SELECT COUNT(*) AS count FROM maintenance_settings WHERE society_id = $1 AND enabled = TRUE`,
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

  const prevMonthDate = new Date(month + "-01");
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const prevMonth = prevMonthDate.toISOString().slice(0, 7);

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

function inr(n) {
  return `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function generateBillPdf(bill, paymentLink = null, upiId = null) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end",  () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W     = doc.page.width - 100;
    const BRAND = "#2563EB";
    const LIGHT = "#EFF6FF";
    const MUTED = "#6B7280";

    // ── Header ──────────────────────────────────────────────────────────────────
    doc.rect(50, 50, W, 70).fillColor(BRAND).fill();
    doc.fillColor("#FFFFFF").fontSize(18).font("Helvetica-Bold")
       .text("MAINTENANCE INVOICE", 65, 63);
    doc.fontSize(10).font("Helvetica")
       .text(bill.society.name, 65, 87);
    if (bill.society.address) {
      doc.fontSize(8).text(bill.society.address, 65, 100, { width: W - 20 });
    }

    let y = 135;

    // ── Resident info ────────────────────────────────────────────────────────────
    doc.rect(50, y, W, 52).fillColor(LIGHT).fill();
    doc.fillColor("#111827").fontSize(9).font("Helvetica-Bold")
       .text("Resident:", 65, y + 9);
    doc.font("Helvetica")
       .text(bill.resident.name, 130, y + 9);
    doc.font("Helvetica-Bold")
       .text("Unit:", 65, y + 25);
    doc.font("Helvetica")
       .text(bill.resident.unit_number || "—", 130, y + 25);

    const monthLabel = new Date(bill.month + "-01").toLocaleString("en-IN", {
      month: "long", year: "numeric",
    });
    doc.fontSize(11).font("Helvetica-Bold").fillColor(BRAND)
       .text(monthLabel, 50, y + 9, { align: "right", width: W });

    y += 65;

    // ── Table helpers ────────────────────────────────────────────────────────────
    function tableHeader(label) {
      doc.rect(50, y, W, 22).fillColor(BRAND).fill();
      doc.fillColor("#FFFFFF").fontSize(9).font("Helvetica-Bold")
         .text(label, 62, y + 6);
      doc.text("Total", 340, y + 6, { width: 80, align: "right" });
      doc.text("Per Unit", 420, y + 6, { width: W - 370, align: "right" });
      y += 22;
    }

    function tableRow(label, total, perUnit, shade) {
      if (shade) doc.rect(50, y, W, 18).fillColor("#F9FAFB").fill();
      doc.fillColor("#111827").fontSize(9).font("Helvetica")
         .text(label, 62, y + 4, { width: 270 });
      doc.fillColor(MUTED)
         .text(inr(total), 340, y + 4, { width: 80, align: "right" });
      doc.fillColor("#111827")
         .text(inr(perUnit), 420, y + 4, { width: W - 370, align: "right" });
      y += 18;
      doc.moveTo(50, y).lineTo(50 + W, y).strokeColor("#E5E7EB").lineWidth(0.5).stroke();
    }

    // ── Fixed items ──────────────────────────────────────────────────────────────
    const activeFixed = bill.fixed_items.filter((i) => i.total_amount > 0);
    if (activeFixed.length) {
      tableHeader("FIXED EXPENSES");
      activeFixed.forEach((item, idx) => tableRow(item.particulars, item.total_amount, item.per_unit, idx % 2 === 1));
      y += 6;
    }

    // ── Variable items ───────────────────────────────────────────────────────────
    const activeVariable = bill.variable_items.filter((i) => i.total_amount > 0);
    if (activeVariable.length) {
      tableHeader("VARIABLE EXPENSES");
      activeVariable.forEach((item, idx) => tableRow(item.particulars, item.total_amount, item.per_unit, idx % 2 === 1));
      y += 6;
    }

    // ── Summary ──────────────────────────────────────────────────────────────────
    doc.rect(50, y, W, 22).fillColor(BRAND).fill();
    doc.fillColor("#FFFFFF").fontSize(9).font("Helvetica-Bold")
       .text("SUMMARY", 62, y + 6);
    y += 22;

    let shade = false;
    function summaryRow(label, value) {
      if (shade) doc.rect(50, y, W, 18).fillColor("#F9FAFB").fill();
      doc.fillColor("#111827").fontSize(9).font("Helvetica")
         .text(label, 62, y + 4);
      doc.text(inr(value), 50, y + 4, { align: "right", width: W });
      y += 18;
      doc.moveTo(50, y).lineTo(50 + W, y).strokeColor("#E5E7EB").lineWidth(0.5).stroke();
      shade = !shade;
    }

    summaryRow("Base Maintenance", bill.base_amount);
    summaryRow("Expense Share", bill.expense_share);
    if (bill.previously_due > 0) {
      summaryRow("Previously Due", bill.previously_due);
      summaryRow(`Interest on Arrears (${bill.interest_rate}% p.a.)`, bill.interest_amount);
    }

    // Total row
    y += 4;
    doc.rect(50, y, W, 24).fillColor(BRAND).fill();
    doc.fillColor("#FFFFFF").fontSize(11).font("Helvetica-Bold")
       .text("TOTAL AMOUNT DUE", 62, y + 6);
    doc.text(inr(bill.total), 50, y + 6, { align: "right", width: W });
    y += 30;

    // ── Payment details ──────────────────────────────────────────────────────────
    if (paymentLink || upiId) {
      y += 10;
      doc.fontSize(9).font("Helvetica-Bold").fillColor(BRAND)
         .text("HOW TO PAY", 50, y);
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

    // ── Footer ───────────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 50;
    doc.rect(50, footerY - 12, W, 0.5).fillColor("#E5E7EB").fill();
    doc.fontSize(8).font("Helvetica").fillColor(MUTED)
       .text(
         "This is a computer-generated invoice. For queries, contact your society management.",
         50, footerY, { align: "center", width: W },
       );

    doc.end();
  });
}

export async function saveBillAndGetUrl(societyId, residentId, month, paymentLink = null, upiId = null) {
  const bill     = await computeBill(societyId, residentId, month);
  const buffer   = await generateBillPdf(bill, paymentLink, upiId);
  const filename = `bill-${societyId}-${residentId}-${month}.pdf`;
  const filepath = path.join(BILLS_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  const baseUrl = (process.env.BACKEND_PUBLIC_URL || "").replace(/\/+$/, "");
  return { url: `${baseUrl}/bills/${filename}`, bill };
}
