import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Stack, Text, PrimaryButton, DefaultButton, IconButton, Dropdown,
  DetailsList, DetailsListLayoutMode, ConstrainMode, CheckboxVisibility,
  MessageBar, MessageBarType, Modal, TextField, Checkbox, TooltipHost,
} from "@fluentui/react";
import VendorDetail from "../components/VendorDetail.jsx";
import { T } from "../styles/typography.js";
import { listStyles } from "../theme.js";
import { StatusBadge } from "../utils/helperFunctions.tsx";
import { VENDOR_CATEGORY_OPTIONS, VENDOR_STATUS_FILTER_OPTIONS } from "../constants.js";
import { api } from "../services/api.js";
import { validatePhone, validateEmail, validateWhatsApp } from "../utils/validation.js";
import "../styles/Vendor.css";

// ─── CredentialsBanner ────────────────────────────────────────────────────────
// Shown inside the modal after a vendor is created with a login account.

function CredentialsBanner({ username, onClose }) {
  const [copied, setCopied] = React.useState("");

  function copy(text, key) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  }

  return (
    <div style={{
      background: "#f0fdf4", border: "1px solid #bbf7d0",
      borderRadius: 8, padding: "16px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Text styles={{ root: { fontSize: 14, fontWeight: 700, color: "#15803d" } }}>
          ✓ Vendor created with portal login
        </Text>
        <IconButton
          iconProps={{ iconName: "Cancel" }}
          onClick={onClose}
          styles={{ root: { width: 24, height: 24 }, icon: { fontSize: 12 } }}
        />
      </div>
      <Text styles={{ root: { fontSize: 13, color: "#166534", marginBottom: 12, display: "block" } }}>
        Share these credentials with the vendor. They will be asked to change their password on first login.
      </Text>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { label: "Username", value: username, key: "user" },
        ].map(({ label, value, key }) => (
          <div key={key} style={{ background: "#fff", borderRadius: 6, padding: "10px 12px", border: "1px solid #d1fae5" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>{label}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <code style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", letterSpacing: "0.3px" }}>{value}</code>
              <button
                onClick={() => copy(value, key)}
                style={{
                  fontSize: 11, color: copied === key ? "#16a34a" : "#6b7280",
                  background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600,
                }}
              >
                {copied === key ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        ))}
      </div>
      <Text styles={{ root: { fontSize: 12, color: "#6b7280", marginTop: 10, display: "block" } }}>
        The vendor logs in at the same portal URL with the password you set.
      </Text>
    </div>
  );
}

// ─── AddVendorModal ───────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: "", business_name: "", owner_name: "", phone: "",
  email: "", gst: "", whatsapp_number: "", categories: [],
  team_size: "", emergency_availability: false, active: true,
  // portal login (optional)
  createLogin: false, username: "", password: "",
};

function AddVendorModal({ isOpen, onDismiss, onSaved }) {
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState("");
  const [credentials, setCredentials] = useState(null); // set after creation

  const resetForm = () => { setForm(EMPTY_FORM); setSaveError(""); setCredentials(null); };

  const handleDismiss = () => { resetForm(); onDismiss(); };

  const setField = (key) => (_, v) => setForm((s) => ({ ...s, [key]: v ?? "" }));

  const handleCategoryChange = (_, option) => {
    if (!option) return;
    setForm((s) => {
      const existing = Array.isArray(s.categories) ? s.categories : [];
      if (option.selected) return { ...s, categories: [...new Set([...existing, option.key])] };
      return { ...s, categories: existing.filter((cat) => cat !== option.key) };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setSaveError("Vendor name is required."); return; }

    // Format validation (fields are optional but must be valid if filled)
    const phoneErr    = validatePhone(form.phone);
    const emailErr    = validateEmail(form.email);
    const waErr       = validateWhatsApp(form.whatsapp_number);
    if (phoneErr) { setSaveError(phoneErr); return; }
    if (emailErr) { setSaveError(emailErr); return; }
    if (waErr)    { setSaveError(waErr);    return; }

    if (form.createLogin) {
      if (!form.username.trim()) { setSaveError("Username is required when creating a portal login."); return; }
      if (!form.password)        { setSaveError("Password is required when creating a portal login."); return; }
      if (form.password.length < 6) { setSaveError("Password must be at least 6 characters."); return; }
    }
    setSaving(true); setSaveError("");
    try {
      const payload = {
        name:                   form.name,
        business_name:          form.business_name          || null,
        owner_name:             form.owner_name             || null,
        phone:                  form.phone                  || null,
        email:                  form.email                  || null,
        gst:                    form.gst                    || null,
        whatsapp_number:        form.whatsapp_number        || null,
        categories:             Array.isArray(form.categories) ? form.categories : [],
        team_size:              form.team_size ? Number(form.team_size) : null,
        emergency_availability: !!form.emergency_availability,
        active:                 !!form.active,
        ...(form.createLogin ? { username: form.username.trim(), password: form.password } : {}),
      };
      const data = await api.vendors.create(payload);

      // If portal login was created, show credentials banner before closing
      if (data.vendorCredentials) {
        setCredentials(data.vendorCredentials);
        // still notify parent so the list updates immediately
        onSaved?.(data.vendor);
        // reset vendor form fields but keep modal open to show credentials
        setForm((s) => ({ ...EMPTY_FORM, createLogin: false }));
      } else {
        onSaved?.(data.vendor);
        resetForm();
      }
    } catch (err) {
      const errMap = {
        username_taken:                "That username is already taken — choose another.",
        username_required_with_password: "Please enter a username.",
        password_required_with_username: "Please enter a password.",
        password_too_short:            "Password must be at least 6 characters.",
      };
      setSaveError(errMap[err.code] || err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onDismiss={handleDismiss} isBlocking={false}>
      <form onSubmit={handleSubmit}>
        <Stack tokens={{ childrenGap: 16 }} className="avm-body">
          {/* Header */}
          <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
            <Text styles={T.modalHeader}>Add Vendor</Text>
            <IconButton iconProps={{ iconName: "Cancel" }} onClick={handleDismiss} />
          </Stack>

          {/* Credentials banner (shown after creation) */}
          {credentials && (
            <CredentialsBanner
              username={credentials.username}
              onClose={() => { setCredentials(null); onDismiss(); }}
            />
          )}

          {!credentials && (
            <>
              <Stack horizontal tokens={{ childrenGap: 16 }}>
                <Stack.Item grow={1}>
                  <TextField label="Name *"        value={form.name}          onChange={setField("name")}          />
                </Stack.Item>
                <Stack.Item grow={1}>
                  <TextField label="Business Name" value={form.business_name} onChange={setField("business_name")} />
                </Stack.Item>
              </Stack>

              <Stack horizontal tokens={{ childrenGap: 16 }}>
                <Stack.Item grow={1}>
                  <TextField label="Owner Name" value={form.owner_name} onChange={setField("owner_name")} />
                </Stack.Item>
                <Stack.Item grow={1}>
                  <TextField
                    label="Phone"
                    value={form.phone}
                    onChange={setField("phone")}
                    onGetErrorMessage={(v) => validatePhone(v) || ""}
                    validateOnFocusOut
                    validateOnLoad={false}
                  />
                </Stack.Item>
              </Stack>

              <Stack horizontal tokens={{ childrenGap: 16 }}>
                <Stack.Item grow={1}>
                  <TextField
                    label="Email"
                    value={form.email}
                    onChange={setField("email")}
                    placeholder="vendor@example.com"
                    onGetErrorMessage={(v) => validateEmail(v) || ""}
                    validateOnFocusOut
                    validateOnLoad={false}
                  />
                </Stack.Item>
                <Stack.Item grow={1}>
                  <TextField label="GST" value={form.gst} onChange={setField("gst")} placeholder="22AAAAA0000A1Z5" />
                </Stack.Item>
              </Stack>

              <Stack horizontal tokens={{ childrenGap: 16 }}>
                <Stack.Item grow={1}>
                  <TextField
                    label="WhatsApp Number"
                    value={form.whatsapp_number}
                    onChange={setField("whatsapp_number")}
                    onGetErrorMessage={(v) => validateWhatsApp(v) || ""}
                    validateOnFocusOut
                    validateOnLoad={false}
                    description="Used to send ticket notifications to the vendor"
                  />
                </Stack.Item>
                <Stack.Item grow={1}>
                  <TextField label="Team Size" type="number" min="1" value={form.team_size} onChange={setField("team_size")} />
                </Stack.Item>
              </Stack>

              <Dropdown
                multiSelect
                label="Categories"
                selectedKeys={form.categories}
                placeholder="Select one or more categories"
                options={VENDOR_CATEGORY_OPTIONS}
                onChange={handleCategoryChange}
              />

              <Stack horizontal tokens={{ childrenGap: 24 }}>
                <Checkbox
                  label="Emergency availability"
                  checked={!!form.emergency_availability}
                  onChange={(_, checked) => setForm((s) => ({ ...s, emergency_availability: !!checked }))}
                />
                <Checkbox
                  label="Active"
                  checked={!!form.active}
                  onChange={(_, checked) => setForm((s) => ({ ...s, active: !!checked }))}
                />
              </Stack>

              {/* ── Portal login section ─────────────────────────────────── */}
              <Stack tokens={{ childrenGap: 10 }} styles={{ root: { borderTop: "2px solid #e2e8f0", paddingTop: 14 } }}>
                <Text styles={{ root: { fontWeight: 600, fontSize: 13, color: "#374151" } }}>Portal Access</Text>
                <Checkbox
                  label="Create login credentials for this vendor"
                  checked={!!form.createLogin}
                  onChange={(_, checked) => setForm((s) => ({ ...s, createLogin: !!checked, username: "", password: "" }))}
                />
                {form.createLogin && (
                  <Stack tokens={{ childrenGap: 12 }} styles={{ root: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "14px 16px" } }}>
                    <Text styles={{ root: { fontSize: 12, color: "#64748b" } }}>
                      Vendor logs in at the same portal URL. They will be prompted to change their password on first login.
                    </Text>
                    <Stack horizontal tokens={{ childrenGap: 16 }}>
                      <Stack.Item grow={1}>
                        <TextField label="Username" placeholder="e.g. plumber1" value={form.username} onChange={setField("username")} autoComplete="off" />
                      </Stack.Item>
                      <Stack.Item grow={1}>
                        <TextField label="Temporary Password" type="password" placeholder="Min. 6 characters" value={form.password} onChange={setField("password")} autoComplete="new-password" canRevealPassword revealPasswordAriaLabel="Show password" />
                      </Stack.Item>
                    </Stack>
                  </Stack>
                )}
              </Stack>

              {saveError && <MessageBar messageBarType={MessageBarType.error}>{saveError}</MessageBar>}

              <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 8 }} styles={{ root: { paddingTop: 4 } }}>
                <DefaultButton onClick={handleDismiss}>Cancel</DefaultButton>
                <PrimaryButton
                  type="submit"
                  disabled={saving}
                  styles={{ root: { borderRadius: 6 }, label: { fontWeight: 600 } }}
                >
                  {saving ? "Creating…" : "Create Vendor"}
                </PrimaryButton>
              </Stack>
            </>
          )}

          {/* When credentials are shown, just a Done button */}
          {credentials && (
            <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 8 }}>
              <PrimaryButton
                onClick={() => { setCredentials(null); onDismiss(); }}
                styles={{ root: { borderRadius: 6 }, label: { fontWeight: 600 } }}
              >
                Done
              </PrimaryButton>
            </Stack>
          )}
        </Stack>
      </form>
    </Modal>
  );
}

// ─── VendorsPage ──────────────────────────────────────────────────────────────

export function VendorsPage() {
  const [vendors,        setVendors]        = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState("");
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [refreshKey,     setRefreshKey]     = useState(0);
  const [modalOpen,      setModalOpen]      = useState(false);

  // Filter state
  const [filterOpen,      setFilterOpen]      = useState(false);
  const [statusFilter,    setStatusFilter]    = useState("ALL");
  const [emergencyFilter, setEmergencyFilter] = useState(false);
  const [activeFilter,    setActiveFilter]    = useState("ALL"); // "ALL" | "YES" | "NO"
  const [categoryFilter,  setCategoryFilter]  = useState([]);

  const hasActiveFilters = statusFilter !== "ALL" || emergencyFilter || activeFilter !== "ALL" || categoryFilter.length > 0;

  const clearFilters = () => {
    setStatusFilter("ALL");
    setEmergencyFilter(false);
    setActiveFilter("ALL");
    setCategoryFilter([]);
  };

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Fetch all vendors (no server-side filter — we filter client-side)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError("");
      try {
        const data = await api.vendors.list({ limit: 200 });
        if (!cancelled) setVendors(data.vendors || []);
      } catch (e) {
        if (!cancelled) setError(e.message || "Error loading vendors");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  // Client-side filtering
  const filteredVendors = useMemo(() => {
    let list = vendors;

    if (statusFilter !== "ALL") {
      list = list.filter((v) => {
        const s = v.verification_status || (v.active ? "APPROVED" : "INACTIVE");
        return s === statusFilter;
      });
    }

    if (emergencyFilter) {
      list = list.filter((v) => !!v.emergency_availability);
    }

    if (activeFilter === "YES") {
      list = list.filter((v) => v.active !== false);
    } else if (activeFilter === "NO") {
      list = list.filter((v) => v.active === false);
    }

    if (categoryFilter.length > 0) {
      list = list.filter((v) =>
        (v.categories || []).some((c) => categoryFilter.includes(c))
      );
    }

    return list;
  }, [vendors, statusFilter, emergencyFilter, activeFilter, categoryFilter]);

  const columns = useMemo(() => [
    {
      key:       "name",
      name:      "Name",
      fieldName: "name",
      minWidth:  140,
      maxWidth:  160,
      onRender:  (v) => <Text styles={T.tablePrimary}>{v.name}</Text>,
    },
    {
      key:      "business",
      name:     "Business",
      minWidth: 130,
      maxWidth: 160,
      onRender: (v) => <Text styles={T.tableSecondary}>{v.business_name || "—"}</Text>,
    },
    {
      key:      "phone",
      name:     "Phone",
      minWidth: 110,
      maxWidth: 130,
      onRender: (v) => <Text styles={T.tableSecondary}>{v.phone || "—"}</Text>,
    },
    {
      key:      "email",
      name:     "Email",
      minWidth: 160,
      maxWidth: 200,
      onRender: (v) => <Text styles={T.tableSecondary}>{v.email || "—"}</Text>,
    },
    {
      key:      "category",
      name:     "Categories",
      minWidth: 150,
      maxWidth: 200,
      onRender: (v) => {
        const cats = v.categories || [];
        if (cats.length === 0) return <Text styles={T.tableSecondary}>—</Text>;
        const label = cats.join(", ");
        return (
          <TooltipHost
            content={cats.map((c) => `• ${c}`).join("\n")}
            styles={{ root: { overflow: "hidden", width: "100%" } }}
          >
            <Text styles={T.tableSecondary} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
              {label}
            </Text>
          </TooltipHost>
        );
      },
    },
    {
      key:      "emergency",
      name:     "Emergency",
      minWidth: 80,
      maxWidth: 90,
      onRender: (v) => v.emergency_availability
        ? <span className="vendors-emergency-badge">✓ Yes</span>
        : <Text styles={T.tableSecondary}>—</Text>,
    },
    {
      key:      "active",
      name:     "Active",
      minWidth: 60,
      maxWidth: 70,
      onRender: (v) => v.active !== false
        ? <span className="vendors-emergency-badge" style={{ background: "#d1fae5", color: "#065f46" }}>✓ Yes</span>
        : <Text styles={T.tableSecondary}>No</Text>,
    },
    {
      key:      "status",
      name:     "Status",
      minWidth: 120,
      maxWidth: 140,
      onRender: (v) => (
        <StatusBadge status={v.verification_status || (v.active ? "APPROVED" : "INACTIVE")} />
      ),
    },
    {
      key:      "actions",
      name:     "",
      minWidth: 70,
      maxWidth: 80,
      onRender: (v) => (
        <DefaultButton
          text="View"
          className="vendors-view-btn"
          onClick={() => setSelectedVendor(v)}
        />
      ),
    },
  ], []);

  return (
    <Stack tokens={{ childrenGap: 20 }}>

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <Stack
        horizontal
        horizontalAlign="space-between"
        verticalAlign="center"
        styles={{ root: { marginBottom: 4 } }}
      >
        <Stack tokens={{ childrenGap: 3 }}>
          <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 6 }}>
            <Text styles={T.pageHeader}>Vendors</Text>
            <div style={{ position: "relative" }}>
              <IconButton
                iconProps={{ iconName: "Filter" }}
                title={filterOpen ? "Hide filters" : "Show filters"}
                onClick={() => setFilterOpen((o) => !o)}
                styles={{
                  root: {
                    color:        filterOpen ? "#0078d4" : "#555",
                    background:   filterOpen ? "#e8f3ff" : "transparent",
                    borderRadius: 6,
                    width:        30,
                    height:       30,
                  },
                  rootHovered: { background: "#e8f3ff", color: "#0078d4" },
                }}
              />
              {hasActiveFilters && <span className="vendors-filter-dot" />}
            </div>
            {loading && <Text styles={T.caption}>Loading…</Text>}
          </Stack>
          <Text styles={T.pageSubtitle}>Manage and verify your service vendors</Text>
        </Stack>

        <PrimaryButton
          text="Add Vendor"
          iconProps={{ iconName: "Add" }}
          styles={{ root: { borderRadius: 8, height: 38 }, label: { fontWeight: 600 } }}
          onClick={() => setModalOpen(true)}
        />
      </Stack>

      {/* ── Filter panel ────────────────────────────────────────────────────── */}
      {filterOpen && (
        <Stack className="vendors-filter-panel" tokens={{ childrenGap: 14 }}>
          <Stack horizontal verticalAlign="end" tokens={{ childrenGap: 16 }} wrap>
            <Dropdown
              label="Status"
              selectedKey={statusFilter}
              onChange={(_, o) => setStatusFilter(o?.key || "ALL")}
              options={VENDOR_STATUS_FILTER_OPTIONS}
              styles={{ root: { minWidth: 180 } }}
            />
            <Dropdown
              multiSelect
              label="Categories"
              selectedKeys={categoryFilter}
              placeholder="All categories"
              options={VENDOR_CATEGORY_OPTIONS}
              onChange={(_, option) => {
                if (!option) return;
                setCategoryFilter((prev) =>
                  option.selected
                    ? [...new Set([...prev, option.key])]
                    : prev.filter((k) => k !== option.key)
                );
              }}
              styles={{ root: { minWidth: 220 } }}
            />
            <Dropdown
              label="Active"
              selectedKey={activeFilter}
              onChange={(_, o) => setActiveFilter(o?.key || "ALL")}
              options={[
                { key: "ALL", text: "All" },
                { key: "YES", text: "Active only" },
                { key: "NO",  text: "Inactive only" },
              ]}
              styles={{ root: { minWidth: 150 } }}
            />
            <Stack
              verticalAlign="end"
              styles={{ root: { paddingBottom: 6 } }}
              tokens={{ childrenGap: 0 }}
            >
              <Checkbox
                label="Emergency availability only"
                checked={emergencyFilter}
                onChange={(_, checked) => setEmergencyFilter(!!checked)}
              />
            </Stack>
            <Stack verticalAlign="end" styles={{ root: { paddingBottom: 2 } }}>
              <DefaultButton
                text="Clear filters"
                iconProps={{ iconName: "ClearFilter" }}
                disabled={!hasActiveFilters}
                onClick={clearFilters}
                styles={{ root: { borderRadius: 6, height: 32 } }}
              />
            </Stack>
          </Stack>

          {hasActiveFilters && (
            <Text styles={T.caption}>
              Showing {filteredVendors.length} of {vendors.length} vendor{vendors.length !== 1 ? "s" : ""}
            </Text>
          )}
        </Stack>
      )}

      {error && (
        <MessageBar messageBarType={MessageBarType.error} onDismiss={() => setError("")}>
          {error}
        </MessageBar>
      )}

      {!loading && filteredVendors.length === 0 ? (
        <Stack horizontalAlign="center" className="vendors-empty" tokens={{ childrenGap: 12 }}>
          <Text styles={T.pageSubtitle}>
            {hasActiveFilters ? "No vendors match your filters" : "No vendors found"}
          </Text>
          {!hasActiveFilters && (
            <PrimaryButton
              text="Add your first vendor"
              styles={{ root: { borderRadius: 8 } }}
              onClick={() => setModalOpen(true)}
            />
          )}
          {hasActiveFilters && (
            <DefaultButton text="Clear filters" onClick={clearFilters} />
          )}
        </Stack>
      ) : (
        <div className="vendors-table-wrap">
          <DetailsList
            items={filteredVendors}
            columns={columns}
            setKey="vendorList"
            layoutMode={DetailsListLayoutMode.fixedColumns}
            constrainMode={ConstrainMode.unconstrained}
            checkboxVisibility={CheckboxVisibility.hidden}
            styles={listStyles}
          />
        </div>
      )}

      <VendorDetail
        vendor={selectedVendor}
        isOpen={!!selectedVendor}
        onClose={() => setSelectedVendor(null)}
        onChanged={() => { refresh(); setSelectedVendor(null); }}
      />

      <AddVendorModal
        isOpen={modalOpen}
        onDismiss={() => setModalOpen(false)}
        onSaved={(newVendor) => {
          setVendors((prev) => [newVendor, ...prev]);
          setModalOpen(false);
        }}
      />
    </Stack>
  );
}
