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
const KEY_RESIDENT_ID  = "nexso_resident_id";
const KEY_UNIT_ID      = "nexso_unit_id";
const KEY_UNIT_NUMBER  = "nexso_unit_number";
const KEY_RESIDENT_NAME = "nexso_resident_name";

export function saveSession({ token, portalRole, societyId, societyName, username, vendorId, residentId, unitId, unitNumber, name }) {
  localStorage.setItem(KEY_TOKEN,         token);
  localStorage.setItem(KEY_ROLE,          portalRole);
  localStorage.setItem(KEY_SOCIETY_ID,    societyId    != null ? String(societyId)   : "");
  localStorage.setItem(KEY_SOCIETY_NAME,  societyName  || "");
  localStorage.setItem(KEY_USERNAME,      username     || "");
  localStorage.setItem(KEY_VENDOR_ID,     vendorId     != null ? String(vendorId)    : "");
  localStorage.setItem(KEY_RESIDENT_ID,   residentId   != null ? String(residentId)  : "");
  localStorage.setItem(KEY_UNIT_ID,       unitId       != null ? String(unitId)      : "");
  localStorage.setItem(KEY_UNIT_NUMBER,   unitNumber   || "");
  localStorage.setItem(KEY_RESIDENT_NAME, name         || "");
}

export function clearSession() {
  [KEY_TOKEN, KEY_ROLE, KEY_SOCIETY_ID, KEY_SOCIETY_NAME, KEY_USERNAME, KEY_VENDOR_ID,
   KEY_RESIDENT_ID, KEY_UNIT_ID, KEY_UNIT_NUMBER, KEY_RESIDENT_NAME].forEach(
    (k) => localStorage.removeItem(k),
  );
}

export function getToken()        { return localStorage.getItem(KEY_TOKEN)         || null; }
export function getRole()         { return localStorage.getItem(KEY_ROLE)          || null; }
export function getSocietyId()    { return localStorage.getItem(KEY_SOCIETY_ID)    || null; }
export function getSocietyName()  { return localStorage.getItem(KEY_SOCIETY_NAME)  || null; }
export function getUsername()     { return localStorage.getItem(KEY_USERNAME)      || null; }
export function getVendorId() {
  const v = localStorage.getItem(KEY_VENDOR_ID);
  return v ? Number(v) : null;
}
export function getResidentId() {
  const v = localStorage.getItem(KEY_RESIDENT_ID);
  return v ? Number(v) : null;
}
export function getUnitId() {
  const v = localStorage.getItem(KEY_UNIT_ID);
  return v ? Number(v) : null;
}
export function getUnitNumber()   { return localStorage.getItem(KEY_UNIT_NUMBER)   || null; }
export function getResidentName() { return localStorage.getItem(KEY_RESIDENT_NAME) || null; }

export function isLoggedIn()      { return Boolean(getToken()); }
