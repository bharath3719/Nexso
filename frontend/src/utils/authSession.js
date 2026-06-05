/**
 * authSession.js
 * ─────────────
 * Lightweight helpers for storing and reading the JWT session.
 * All portal-role logic goes here so App.jsx stays clean.
 */

const KEY_TOKEN        = "nexso_token";
const KEY_ROLE         = "nexso_role";
const KEY_SOCIETY_ID   = "nexso_society_id";
const KEY_SOCIETY_NAME = "nexso_society_name";
const KEY_USERNAME     = "nexso_username";
const KEY_VENDOR_ID    = "nexso_vendor_id";

export function saveSession({ token, portalRole, societyId, societyName, username, vendorId }) {
  localStorage.setItem(KEY_TOKEN,        token);
  localStorage.setItem(KEY_ROLE,         portalRole);
  localStorage.setItem(KEY_SOCIETY_ID,   societyId  != null ? String(societyId)  : "");
  localStorage.setItem(KEY_SOCIETY_NAME, societyName || "");
  localStorage.setItem(KEY_USERNAME,     username    || "");
  localStorage.setItem(KEY_VENDOR_ID,    vendorId   != null ? String(vendorId)   : "");
}

export function clearSession() {
  [KEY_TOKEN, KEY_ROLE, KEY_SOCIETY_ID, KEY_SOCIETY_NAME, KEY_USERNAME, KEY_VENDOR_ID].forEach(
    (k) => localStorage.removeItem(k),
  );
}

export function getToken()       { return localStorage.getItem(KEY_TOKEN)        || null; }
export function getRole()        { return localStorage.getItem(KEY_ROLE)         || null; }
export function getSocietyId()   { return localStorage.getItem(KEY_SOCIETY_ID)   || null; }
export function getSocietyName() { return localStorage.getItem(KEY_SOCIETY_NAME) || null; }
export function getUsername()    { return localStorage.getItem(KEY_USERNAME)     || null; }
export function getVendorId()    {
  const v = localStorage.getItem(KEY_VENDOR_ID);
  return v ? Number(v) : null;
}

export function isLoggedIn()     { return Boolean(getToken()); }
