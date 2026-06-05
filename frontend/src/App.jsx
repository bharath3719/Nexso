import React, { useEffect, useState, useCallback } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import {
  initializeIcons, ThemeProvider, Stack, Text,
  MessageBar, MessageBarType, TextField, PrimaryButton, Spinner,
} from "@fluentui/react";

import { navLinks }           from "./constants.js";
import { shellTheme, loginScreenStyles } from "./theme.js";
import { Layout }             from "./components/Layout.jsx";
import { Dashboard }          from "./pages/Dashboard.jsx";
import { UsersPage }          from "./pages/Users.jsx";
import { ComplaintsPage }     from "./pages/Complaints.jsx";
import { VendorsPage }        from "./pages/Vendors.jsx";
import { PaymentsPage }       from "./pages/Payments.jsx";
import { MaintenancePage }    from "./pages/Maintenance.jsx";
import { OnboardingPage }     from "./pages/Onboarding.jsx";
import { OnboardingNewPage }  from "./pages/OnboardingNew.jsx";
import { SocietyDetailPage }  from "./pages/SocietyDetail.jsx";

import { SecretaryLayout }       from "./components/SecretaryLayout.jsx";
import { SecretaryDashboard }    from "./pages/secretary/SecretaryDashboard.jsx";
import { SecretaryResidents }    from "./pages/secretary/SecretaryResidents.jsx";
import { SecretaryTickets }      from "./pages/secretary/SecretaryTickets.jsx";
import { SecretaryProfile }      from "./pages/secretary/SecretaryProfile.jsx";
import { SecretaryMaintenance }  from "./pages/secretary/SecretaryMaintenance.jsx";

import { VendorLayout }    from "./components/VendorLayout.jsx";
import { VendorDashboard } from "./pages/vendor/VendorDashboard.jsx";
import { VendorTickets }   from "./pages/vendor/VendorTickets.jsx";
import { VendorProfile }   from "./pages/vendor/VendorProfile.jsx";

import { PasswordChangeFields } from "./components/PasswordChangeFields.jsx";

import {
  saveSession, clearSession,
  getRole, getSocietyId, getSocietyName, getUsername, getVendorId,
  isLoggedIn,
} from "./utils/authSession.js";
import { api } from "./services/api.js";

initializeIcons();

// ─── Shared auth card wrapper ──────────────────────────────────────────────────

function AuthCard({ title, subtitle, error, children }) {
  return (
    <ThemeProvider theme={shellTheme}>
      <Stack verticalFill verticalAlign="center" horizontalAlign="center" styles={loginScreenStyles.outer}>
        <Stack styles={loginScreenStyles.card} tokens={{ childrenGap: 16 }}>
          <Text variant="xLarge" styles={loginScreenStyles.title}>{title}</Text>
          <Text variant="small" styles={loginScreenStyles.subtitle}>{subtitle}</Text>
          {error && <MessageBar messageBarType={MessageBarType.error}>{error}</MessageBar>}
          {children}
        </Stack>
      </Stack>
    </ThemeProvider>
  );
}

// ─── LoginScreen ──────────────────────────────────────────────────────────────

function LoginScreen({ onLogin, error, loading }) {
  const [form, setForm] = useState({ username: "", password: "" });

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(form);
  };

  return (
    <AuthCard title="Nexso" subtitle="Sign in to continue." error={error}>
      <form onSubmit={handleSubmit}>
        <Stack tokens={{ childrenGap: 12 }}>
          <TextField
            label="Username"
            placeholder="admin  or  BLD-XXXXXX"
            value={form.username}
            onChange={(_, v) => setForm((s) => ({ ...s, username: v || "" }))}
            autoComplete="username"
            required
            disabled={loading}
          />
          <TextField
            label="Password"
            type="password"
            value={form.password}
            onChange={(_, v) => setForm((s) => ({ ...s, password: v || "" }))}
            autoComplete="current-password"
            required
            disabled={loading}
          />
          {loading
            ? <Spinner label="Signing in…" />
            : <PrimaryButton type="submit" text="Sign in" />
          }
        </Stack>
      </form>
    </AuthCard>
  );
}

// ─── ForcePasswordReset screen ────────────────────────────────────────────────

function ForceResetScreen({ onReset, error, loading }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) return;
    onReset(form);
  };

  const mismatch = form.confirm && form.newPassword !== form.confirm;

  return (
    <AuthCard
      title="Set Your Password"
      subtitle="You must change your password before continuing."
      error={error}
    >
      <form onSubmit={handleSubmit}>
        <Stack tokens={{ childrenGap: 12 }}>
          <PasswordChangeFields
            form={form}
            onFieldChange={(field, v) => setForm((s) => ({ ...s, [field]: v }))}
            mismatch={mismatch}
            loading={loading}
            currentLabel="Current (temporary) password"
          />
          {loading
            ? <Spinner label="Saving…" />
            : <PrimaryButton type="submit" text="Set Password" disabled={Boolean(mismatch)} />
          }
        </Stack>
      </form>
    </AuthCard>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [session, setSession] = useState(() => ({
    authed:             isLoggedIn(),
    role:               getRole(),
    societyId:          getSocietyId(),
    societyName:        getSocietyName(),
    username:           getUsername(),
    vendorId:           getVendorId(),
    forcePasswordReset: false,
  }));
  const [loginError,  setLoginError]  = useState("");
  const [resetError,  setResetError]  = useState("");
  const [loading,     setLoading]     = useState(false);

  // ── Session-expiry handler (fired by api.js on 401) ───────────────────────

  useEffect(() => {
    const handleUnauthorized = () => {
      setSession({ authed: false, role: null, societyId: null, societyName: null, username: null, vendorId: null, forcePasswordReset: false });
      setLoginError("Your session has expired. Please sign in again.");
    };
    window.addEventListener("nexso:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("nexso:unauthorized", handleUnauthorized);
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────

  const handleLogin = useCallback(async ({ username, password }) => {
    setLoginError("");
    setLoading(true);
    try {
      const data = await api.auth.login(username, password);
      saveSession(data);
      setSession({
        authed:             true,
        role:               data.portalRole,
        societyId:          data.societyId,
        societyName:        data.societyName,
        username:           data.username,
        vendorId:           data.vendorId || null,
        forcePasswordReset: data.forcePasswordReset,
      });
    } catch (err) {
      setLoginError(
        err.code === "invalid_credentials"
          ? "Incorrect username or password."
          : err.status === 0
            ? "Could not reach the server. Is the backend running?"
            : "Login failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Force password reset ──────────────────────────────────────────────────

  const handlePasswordReset = useCallback(async ({ currentPassword, newPassword }) => {
    setResetError("");
    setLoading(true);
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      setSession((s) => ({ ...s, forcePasswordReset: false }));
    } catch (err) {
      setResetError(
        err.code === "current_password_wrong"
          ? "Current password is incorrect."
          : err.code === "password_too_short"
            ? "Password must be at least 8 characters."
            : err.status === 0
              ? "Could not reach the server."
              : "Failed to change password.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────

  const handleLogout = useCallback(() => {
    clearSession();
    setSession({ authed: false, role: null, societyId: null, societyName: null, username: null, vendorId: null, forcePasswordReset: false });
    setLoginError("");
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!session.authed) {
    return <LoginScreen onLogin={handleLogin} error={loginError} loading={loading} />;
  }

  if (session.forcePasswordReset) {
    return <ForceResetScreen onReset={handlePasswordReset} error={resetError} loading={loading} />;
  }

  // ── Secretary portal ──────────────────────────────────────────────────────

  if (session.role === "SOCIETY_ADMIN") {
    return (
      <ThemeProvider theme={shellTheme}>
        <BrowserRouter>
          <SecretaryLayout
            societyName={session.societyName}
            onLogout={handleLogout}
          >
            <Routes>
              <Route path="/"                    element={<Navigate to="/secretary" replace />} />
              <Route path="/secretary"              element={<SecretaryDashboard societyId={session.societyId} societyName={session.societyName} />} />
              <Route path="/secretary/residents"    element={<SecretaryResidents societyId={session.societyId} />} />
              <Route path="/secretary/tickets"      element={<SecretaryTickets />} />
              <Route path="/secretary/maintenance"  element={<SecretaryMaintenance />} />
              <Route path="/secretary/profile"      element={<SecretaryProfile onLogout={handleLogout} />} />
              <Route path="*"                    element={<Navigate to="/secretary" replace />} />
            </Routes>
          </SecretaryLayout>
        </BrowserRouter>
      </ThemeProvider>
    );
  }

  // ── Vendor portal ─────────────────────────────────────────────────────────

  if (session.role === "VENDOR") {
    const vendorDisplayName = session.username;
    return (
      <ThemeProvider theme={shellTheme}>
        <BrowserRouter>
          <VendorLayout
            vendorName={vendorDisplayName}
            onLogout={handleLogout}
          >
            <Routes>
              <Route path="/"               element={<Navigate to="/vendor" replace />} />
              <Route path="/vendor"         element={<VendorDashboard vendorName={vendorDisplayName} />} />
              <Route path="/vendor/tickets" element={<VendorTickets />} />
              <Route path="/vendor/profile" element={<VendorProfile onLogout={handleLogout} />} />
              <Route path="*"               element={<Navigate to="/vendor" replace />} />
            </Routes>
          </VendorLayout>
        </BrowserRouter>
      </ThemeProvider>
    );
  }

  // ── Nexso Admin portal (existing UI) ─────────────────────────────────────

  return (
    <ThemeProvider theme={shellTheme}>
      <BrowserRouter>
        <Layout navLinks={navLinks} onLogout={handleLogout}>
          <Routes>
            <Route path="/"               element={<Dashboard />} />
            <Route path="/onboarding"     element={<OnboardingPage />} />
            <Route path="/onboarding/new" element={<OnboardingNewPage />} />
            <Route path="/onboarding/:id" element={<SocietyDetailPage />} />
            <Route path="/users"          element={<UsersPage />} />
            <Route path="/complaints"     element={<ComplaintsPage />} />
            <Route path="/vendors"        element={<VendorsPage />} />
            <Route path="/payments"       element={<PaymentsPage />} />
            <Route path="/maintenance"    element={<MaintenancePage />} />
            <Route path="*"               element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ThemeProvider>
  );
}
