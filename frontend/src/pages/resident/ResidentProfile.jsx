import React, { useCallback, useEffect, useState } from "react";
import { DefaultButton, PrimaryButton, Spinner } from "@fluentui/react";
import { PageHeader } from "../../components/shared/PageHeader.jsx";
import { ErrorBanner, getErrMsg } from "../../components/shared/ErrorBanner.jsx";
import { api } from "../../services/api.js";
import { BHK_OPTIONS, CONTACT_PREFERENCE_OPTIONS } from "../../constants.js";
import "../../styles/ResidentLayout.css";

const VEHICLE_TYPES = ["Car", "Motorcycle", "Scooter", "Auto", "Other"];

function emptyVehicle() {
  return { type: "Car", number: "" };
}

function emptyEmergency() {
  return { name: "", phone: "", relation: "" };
}

function Field({ label, children }) {
  return (
    <div>
      <div className="res-field-label">{label}</div>
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return <div className="res-section-label">{children}</div>;
}

export function ResidentProfile({ isFirstSetup, onComplete }) {
  const [form,    setForm]    = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);
  const [profile, setProfile] = useState(null);

  const load = useCallback(() => {
    setError("");
    api.resident.profile()
      .then(({ profile: p }) => {
        setProfile(p);
        setForm({
          email:             p.email             || "",
          preferred_contact: p.preferred_contact || "WHATSAPP",
          bhk:               p.bhk               || "",
          family_members:    p.family_members     ?? 0,
          vehicles:          (p.vehicles && p.vehicles.length > 0) ? p.vehicles : [],
          emergency_contact: p.emergency_contact  || emptyEmergency(),
        });
      })
      .catch((e) => setError(getErrMsg(e, "Failed to load profile.")));
  }, []);

  useEffect(() => { load(); }, [load]);

  const setField = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  // Vehicle list helpers
  const setVehicle    = (idx, key, val) =>
    setField("vehicles", form.vehicles.map((v, i) => i === idx ? { ...v, [key]: val } : v));
  const addVehicle    = () => setField("vehicles", [...form.vehicles, emptyVehicle()]);
  const removeVehicle = (idx) => setField("vehicles", form.vehicles.filter((_, i) => i !== idx));

  const setEmergency = (key, val) =>
    setField("emergency_contact", { ...form.emergency_contact, [key]: val });

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const ec = form.emergency_contact;
      await api.resident.updateProfile({
        email:             form.email             || null,
        preferred_contact: form.preferred_contact || null,
        bhk:               form.bhk               || null,
        family_members:    Number(form.family_members) || 0,
        vehicles:          form.vehicles.filter((v) => v.number.trim()),
        emergency_contact: (ec.name || ec.phone) ? ec : null,
      });
      setSuccess(true);
      if (onComplete) onComplete();
    } catch (e) {
      setError(getErrMsg(e, "Failed to save profile."));
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return (
      <div className="res-page">
        {error
          ? <ErrorBanner message={error} onRetry={load} />
          : <Spinner label="Loading profile…" />
        }
      </div>
    );
  }

  const ec = form.emergency_contact;

  return (
    <div className="res-page">
      <PageHeader
        title={isFirstSetup ? "Complete Your Profile" : "My Profile"}
        subtitle={profile?.name || undefined}
      />

      {isFirstSetup && (
        <div className="res-first-setup-banner">
          Welcome! Before you continue, please fill in your household details. You can update these any time from the Profile section.
        </div>
      )}

      {success && !isFirstSetup && (
        <div className="res-success-banner">Profile saved successfully.</div>
      )}

      <ErrorBanner message={error} />

      <form onSubmit={handleSave} className="res-form-stack">
        <div className="res-card">
          <div className="res-card-header">
            <SectionLabel>Contact Details</SectionLabel>
          </div>
          <div className="res-card-body--padded">
            <div className="res-form-col">
              <div className="res-form-grid-2">
                <Field label="Email">
                  <input
                    type="email"
                    className="res-input"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                  />
                </Field>
                <Field label="Preferred Contact">
                  <select
                    className="res-select"
                    value={form.preferred_contact}
                    onChange={(e) => setField("preferred_contact", e.target.value)}
                  >
                    {CONTACT_PREFERENCE_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>{o.text}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          </div>
        </div>

        <div className="res-card">
          <div className="res-card-header">
            <SectionLabel>Household Details</SectionLabel>
          </div>
          <div className="res-card-body--padded">
            <div className="res-form-col">
              <div className="res-form-grid-2">
                <Field label="Flat Type">
                  <select
                    className="res-select"
                    value={form.bhk}
                    onChange={(e) => setField("bhk", e.target.value)}
                  >
                    <option value="">-- Select --</option>
                    {BHK_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Family Members">
                  <input
                    type="number"
                    className="res-input"
                    min={0}
                    max={20}
                    value={form.family_members}
                    onChange={(e) => setField("family_members", e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </div>
        </div>

        <div className="res-card">
          <div className="res-card-header">
            <SectionLabel>Vehicles</SectionLabel>
            <button type="button" className="res-btn-icon" onClick={addVehicle}>+ Add Vehicle</button>
          </div>
          <div className="res-card-body--padded">
            {form.vehicles.length === 0 ? (
              <div className="res-empty res-empty--sm">No vehicles added.</div>
            ) : (
              <table className="res-vehicle-table">
                <thead>
                  <tr>
                    <th style={{ width: "35%" }}>Type</th>
                    <th>Number Plate</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {form.vehicles.map((v, i) => (
                    <tr key={i}>
                      <td>
                        <select value={v.type} onChange={(e) => setVehicle(i, "type", e.target.value)}>
                          {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </td>
                      <td>
                        <input
                          placeholder="MH12AB1234"
                          value={v.number}
                          onChange={(e) => setVehicle(i, "number", e.target.value.toUpperCase())}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="res-btn-icon res-btn-icon--danger"
                          onClick={() => removeVehicle(i)}
                          title="Remove"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="res-card">
          <div className="res-card-header">
            <SectionLabel>Emergency Contact</SectionLabel>
          </div>
          <div className="res-card-body--padded">
            <div className="res-form-col">
              <div className="res-form-grid-2">
                <Field label="Name">
                  <input
                    className="res-input"
                    placeholder="Full name"
                    value={ec.name}
                    onChange={(e) => setEmergency("name", e.target.value)}
                  />
                </Field>
                <Field label="Relation">
                  <input
                    className="res-input"
                    placeholder="e.g. Spouse, Parent"
                    value={ec.relation}
                    onChange={(e) => setEmergency("relation", e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Phone">
                <input
                  className="res-input res-input--sm"
                  placeholder="10-digit mobile number"
                  value={ec.phone}
                  onChange={(e) => setEmergency("phone", e.target.value)}
                />
              </Field>
            </div>
          </div>
        </div>

        <div className="res-form-actions">
          {saving
            ? <Spinner label="Saving…" />
            : <PrimaryButton type="submit" text={isFirstSetup ? "Save & Continue" : "Save Changes"} />
          }
          {!isFirstSetup && (
            <DefaultButton type="button" text="Cancel" onClick={load} disabled={saving} />
          )}
        </div>
      </form>
    </div>
  );
}
