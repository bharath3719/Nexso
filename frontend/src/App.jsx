import React, { useEffect, useState, useCallback } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  initializeIcons, ThemeProvider, Stack, Text,
  MessageBar, MessageBarType, TextField, PrimaryButton, DefaultButton, Spinner,
} from "@fluentui/react";

import { navLinks }           from "./constants.js";
import { shellTheme, loginScreenStyles } from "./theme.js";
import { Layout }             from "./components/layout/Layout.jsx";
import { Dashboard }          from "./pages/admin/Dashboard.jsx";
import { UsersPage }          from "./pages/admin/Users.jsx";
import { ComplaintsPage }     from "./pages/admin/Complaints.jsx";
import { VendorsPage }        from "./pages/admin/Vendors.jsx";
import { PaymentsPage }       from "./pages/admin/Payments.jsx";
import { MaintenancePage }    from "./pages/admin/Maintenance.jsx";
import { OnboardingPage }     from "./pages/admin/Onboarding.jsx";
import { OnboardingNewPage }  from "./pages/admin/OnboardingNew.jsx";
import { SocietyDetailPage }  from "./pages/admin/SocietyDetail.jsx";

import { SecretaryLayout }         from "./components/layout/SecretaryLayout.jsx";
import { SecretaryDashboard }      from "./pages/secretary/SecretaryDashboard.jsx";
import { SecretaryResidents }      from "./pages/secretary/SecretaryResidents.jsx";
import { SecretaryTickets }        from "./pages/secretary/SecretaryTickets.jsx";
import { SecretaryProfile }        from "./pages/secretary/SecretaryProfile.jsx";
import { SecretaryMaintenance }    from "./pages/secretary/SecretaryMaintenance.jsx";
import { SecretaryAnnouncements }  from "./pages/secretary/SecretaryAnnouncements.jsx";

import { ResidentLayout }          from "./components/layout/ResidentLayout.jsx";
import { ResidentDashboard }       from "./pages/resident/ResidentDashboard.jsx";
import { ResidentAnnouncements }   from "./pages/resident/ResidentAnnouncements.jsx";
import { ResidentVisitorPasses }   from "./pages/resident/ResidentVisitorPasses.jsx";
import { ResidentBilling }         from "./pages/resident/ResidentBilling.jsx";
import { ResidentProfile }         from "./pages/resident/ResidentProfile.jsx";

import { PublicPassPage }  from "./pages/public/PublicPassPage.jsx";
import { GuardLogin }      from "./pages/guard/GuardLogin.jsx";
import { GuardDashboard }  from "./pages/guard/GuardDashboard.jsx";

import { VendorLayout }    from "./components/layout/VendorLayout.jsx";
import { VendorDashboard } from "./pages/vendor/VendorDashboard.jsx";
import { VendorTickets }   from "./pages/vendor/VendorTickets.jsx";
import { VendorProfile }   from "./pages/vendor/VendorProfile.jsx";

import { PasswordChangeFields } from "./components/shared/PasswordChangeFields.jsx";

import {
  saveSession, clearSession,
  getRole, getSocietyId, getSocietyName, getUsername, getVendorId,
  getResidentId, getUnitId, getUnitNumber, getResidentName,
  isLoggedIn,
} from "./utils/authSession.js";
import { api } from "./services/api.js";

// ─── Guard session helpers ────────────────────────────────────────────────────

const GUARD_KEY = "nexso_guard_session";

function getGuardSession() {
  try { return JSON.parse(localStorage.getItem(GUARD_KEY) || "null"); } catch { return null; }
}
function saveGuardSession(data) {
  localStorage.setItem(GUARD_KEY, JSON.stringify(data));
}
function clearGuardSession() {
  localStorage.removeItem(GUARD_KEY);
}

// ─── Guard portal (self-contained, no shared auth state) ─────────────────────

function GuardPortalApp() {
  const [session, setSession] = useState(() => getGuardSession());
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearGuardSession();
      setSession(null);
      setError("Session expired. Please sign in again.");
    };
    // Guard portal re-uses the same event but only cares when we're on /guard
    window.addEventListener("nexso:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("nexso:unauthorized", handleUnauthorized);
  }, []);

  const handleLogin = useCallback(async ({ username, password }) => {
    setError(""); setLoading(true);
    try {
      const data = await api.guard.login(username, password);
      const sess = { token: data.token, societyId: data.societyId, societyName: data.societyName, username: data.username };
      saveGuardSession(sess);
      // Store token so api.js can attach it for guard calls
      localStorage.setItem("nexso_guard_token", data.token);
      setSession(sess);
    } catch (err) {
      setError(
        err.code === "invalid_credentials" ? "Incorrect username or password." :
        err.code === "account_inactive"    ? "This account is inactive." :
        "Login failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogout = useCallback(() => {
    clearGuardSession();
    localStorage.removeItem("nexso_guard_token");
    setSession(null);
    setError("");
  }, []);

  if (!session) {
    return <GuardLogin onLogin={handleLogin} error={error} loading={loading} />;
  }

  return (
    <GuardDashboard
      societyName={session.societyName}
      onLogout={handleLogout}
    />
  );
}

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

// ─── LoginScreen (username + password) ───────────────────────────────────────

function LoginScreen({ onLogin, error, loading, title = "Nexso", subtitle = "Sign in to continue.", footer }) {
  const [form, setForm] = useState({ username: "", password: "" });

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(form);
  };

  return (
    <AuthCard title={title} subtitle={subtitle} error={error}>
      <form onSubmit={handleSubmit}>
        <Stack tokens={{ childrenGap: 12 }}>
          <TextField
            label="Username"
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
      {footer}
    </AuthCard>
  );
}

// ─── AdminLoginScreen ─────────────────────────────────────────────────────────

function AdminLoginScreen({ onLogin, error, loading }) {
  const navigate = useNavigate();
  return (
    <LoginScreen
      onLogin={onLogin}
      error={error}
      loading={loading}
      title="Nexso Admin"
      subtitle="Admin portal — authorised staff only."
      footer={
        <div className="login-portal-links">
          <button className="login-portal-link" type="button" onClick={() => navigate("/")}>
            ← Resident / Secretary Login
          </button>
        </div>
      }
    />
  );
}

// ─── VendorLoginScreen ────────────────────────────────────────────────────────

function VendorLoginScreen({ onLogin, error, loading }) {
  const navigate = useNavigate();
  return (
    <LoginScreen
      onLogin={onLogin}
      error={error}
      loading={loading}
      title="Vendor Portal"
      subtitle="Sign in to manage your service tickets."
      footer={
        <div className="login-portal-links">
          <button className="login-portal-link" type="button" onClick={() => navigate("/")}>
            ← Resident / Secretary Login
          </button>
        </div>
      }
    />
  );
}

// ─── ResidentSecretaryLogin ───────────────────────────────────────────────────

function ResidentSecretaryLogin({ onLogin, onOtpLogin, onClearError, error, loading }) {
  const [tab,     setTab]     = useState("resident"); // "resident" | "secretary"
  const [otpStep, setOtpStep] = useState("phone");    // "phone" | "otp"
  const [phone,   setPhone]   = useState("");
  const [otp,     setOtp]     = useState("");
  const [devOtp,  setDevOtp]  = useState("");
  const [secForm, setSecForm] = useState({ username: "", password: "" });
  const navigate              = useNavigate();

  const switchTab = (t) => {
    setTab(t);
    if (onClearError) onClearError();
    setOtpStep("phone");
    setOtp("");
    setDevOtp("");
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    const result = await onOtpLogin({ step: "request", phone });
    if (result?.otp) setDevOtp(result.otp);
    if (result) setOtpStep("otp");
  };

  const handleOtpSubmit = (e) => {
    e.preventDefault();
    onOtpLogin({ step: "verify", phone, otp });
  };

  const handleSecSubmit = (e) => {
    e.preventDefault();
    onLogin(secForm);
  };

  const subtitle = tab === "resident"
    ? (otpStep === "phone" ? "Enter your registered WhatsApp number." : `OTP sent to ${phone}. Enter it below.`)
    : "Sign in with your secretary credentials.";

  return (
    <AuthCard title="Nexso" subtitle={subtitle} error={error}>
      <div className="login-tabs">
        <button
          type="button"
          className={`login-tab${tab === "resident" ? " login-tab--active" : ""}`}
          onClick={() => switchTab("resident")}
        >
          Resident
        </button>
        <button
          type="button"
          className={`login-tab${tab === "secretary" ? " login-tab--active" : ""}`}
          onClick={() => switchTab("secretary")}
        >
          Secretary
        </button>
      </div>

      {tab === "resident" ? (
        otpStep === "phone" ? (
          <form onSubmit={handlePhoneSubmit}>
            <Stack tokens={{ childrenGap: 12 }}>
              <TextField
                label="WhatsApp Number"
                placeholder="91XXXXXXXXXX"
                value={phone}
                onChange={(_, v) => setPhone(v || "")}
                autoComplete="tel"
                required
                disabled={loading}
              />
              {loading
                ? <Spinner label="Sending OTP…" />
                : <PrimaryButton type="submit" text="Send OTP" />
              }
            </Stack>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit}>
            <Stack tokens={{ childrenGap: 12 }}>
              <TextField
                label="One-Time Password"
                placeholder="6-digit OTP"
                value={otp}
                onChange={(_, v) => setOtp(v || "")}
                autoComplete="one-time-code"
                required
                disabled={loading}
                maxLength={6}
              />
              {devOtp && (
                <div style={{ background: "#fef9c3", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#92400e" }}>
                  Dev mode — OTP: <strong>{devOtp}</strong>
                </div>
              )}
              {loading ? (
                <Spinner label="Verifying…" />
              ) : (
                <Stack tokens={{ childrenGap: 8 }}>
                  <PrimaryButton type="submit" text="Verify OTP" />
                  <DefaultButton
                    text="Change number"
                    onClick={() => { setOtpStep("phone"); setOtp(""); setDevOtp(""); }}
                  />
                </Stack>
              )}
            </Stack>
          </form>
        )
      ) : (
        <form onSubmit={handleSecSubmit}>
          <Stack tokens={{ childrenGap: 12 }}>
            <TextField
              label="Username"
              placeholder="e.g. BLD-ABC123"
              value={secForm.username}
              onChange={(_, v) => setSecForm((s) => ({ ...s, username: v || "" }))}
              autoComplete="username"
              required
              disabled={loading}
            />
            <TextField
              label="Password"
              type="password"
              value={secForm.password}
              onChange={(_, v) => setSecForm((s) => ({ ...s, password: v || "" }))}
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
      )}

      <div className="login-portal-links">
        <button className="login-portal-link" type="button" onClick={() => navigate("/admin")}>Admin Portal</button>
        {" · "}
        <button className="login-portal-link" type="button" onClick={() => navigate("/vendors")}>Vendor Portal</button>
        {" · "}
        <button className="login-portal-link" type="button" onClick={() => navigate("/guard")}>Guard Portal</button>
      </div>
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
  const location = useLocation();
  const [session, setSession] = useState(() => ({
    authed:             isLoggedIn(),
    role:               getRole(),
    societyId:          getSocietyId(),
    societyName:        getSocietyName(),
    username:           getUsername(),
    vendorId:           getVendorId(),
    residentId:         getResidentId(),
    unitId:             getUnitId(),
    unitNumber:         getUnitNumber(),
    residentName:       getResidentName(),
    forcePasswordReset: false,
    forceProfileSetup:  false,
  }));
  const [loginError,  setLoginError]  = useState("");
  const [resetError,  setResetError]  = useState("");
  const [loading,     setLoading]     = useState(false);

  // ── Session-expiry handler (fired by api.js on 401) ───────────────────────

  useEffect(() => {
    const handleUnauthorized = () => {
      setSession({ authed: false, role: null, societyId: null, societyName: null, username: null, vendorId: null, residentId: null, unitId: null, unitNumber: null, residentName: null, forcePasswordReset: false, forceProfileSetup: false });
      setLoginError("Your session has expired. Please sign in again.");
    };
    window.addEventListener("nexso:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("nexso:unauthorized", handleUnauthorized);
  }, []);

  // Clear any stale login error when the user navigates between login pages.
  useEffect(() => {
    setLoginError("");
  }, [location.pathname]);

  // ── Admin login ───────────────────────────────────────────────────────────

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
        residentId:         null,
        unitId:             null,
        unitNumber:         null,
        residentName:       null,
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

  // ── Resident OTP login ────────────────────────────────────────────────────

  const handleOtpLogin = useCallback(async ({ step, phone, otp }) => {
    setLoginError("");
    setLoading(true);
    try {
      if (step === "request") {
        const result = await api.auth.otpRequest(phone);
        setLoading(false);
        return result;          // returns { otp } in dev mode for display
      }
      // step === "verify"
      const data = await api.auth.otpVerify(phone, otp);
      saveSession(data);
      setSession({
        authed:            true,
        role:              "RESIDENT",
        societyId:         data.societyId,
        societyName:       data.societyName,
        username:          phone,
        vendorId:          null,
        residentId:        data.residentId,
        unitId:            data.unitId,
        unitNumber:        data.unitNumber,
        residentName:      data.name,
        forcePasswordReset: false,
        forceProfileSetup:  data.forceProfileSetup ?? false,
      });
    } catch (err) {
      setLoginError(
        err.code === "phone_not_registered"
          ? "This number is not registered in any society."
          : err.code === "invalid_or_expired_otp"
            ? "Incorrect or expired OTP. Please try again."
            : err.status === 0
              ? "Could not reach the server."
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

  // ── Profile setup complete (first login) ─────────────────────────────────

  const handleProfileComplete = useCallback(() => {
    setSession((s) => ({ ...s, forceProfileSetup: false }));
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────

  const handleLogout = useCallback(() => {
    clearSession();
    setSession({ authed: false, role: null, societyId: null, societyName: null, username: null, vendorId: null, residentId: null, unitId: null, unitNumber: null, residentName: null, forcePasswordReset: false, forceProfileSetup: false });
    setLoginError("");
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  if (location.pathname.startsWith("/pass/")) {
    return (
      <Routes>
        <Route path="/pass/:passCode" element={<PublicPassPage />} />
      </Routes>
    );
  }

  if (location.pathname.startsWith("/guard")) {
    return <GuardPortalApp />;
  }

  if (!session.authed) {
    if (location.pathname.startsWith("/admin")) {
      return <AdminLoginScreen onLogin={handleLogin} error={loginError} loading={loading} />;
    }
    if (location.pathname.startsWith("/vendor")) {
      return <VendorLoginScreen onLogin={handleLogin} error={loginError} loading={loading} />;
    }
    return (
      <ResidentSecretaryLogin
        onLogin={handleLogin}
        onOtpLogin={handleOtpLogin}
        onClearError={() => setLoginError("")}
        error={loginError}
        loading={loading}
      />
    );
  }

  if (session.forcePasswordReset) {
    return <ForceResetScreen onReset={handlePasswordReset} error={resetError} loading={loading} />;
  }

  // ── Resident portal ───────────────────────────────────────────────────────

  if (session.role === "RESIDENT") {
    // First-login gate: show only the profile setup form until complete.
    if (session.forceProfileSetup) {
      return (
        <ThemeProvider theme={shellTheme}>
          <ResidentLayout
            unitNumber={session.unitNumber}
            societyName={session.societyName}
            onLogout={handleLogout}
          >
            <ResidentProfile isFirstSetup onComplete={handleProfileComplete} />
          </ResidentLayout>
        </ThemeProvider>
      );
    }

    return (
      <ThemeProvider theme={shellTheme}>
        <ResidentLayout
          unitNumber={session.unitNumber}
          societyName={session.societyName}
          onLogout={handleLogout}
        >
          <Routes>
            <Route path="/"                          element={<Navigate to="/resident" replace />} />
            <Route path="/resident"                  element={<ResidentDashboard unitNumber={session.unitNumber} societyName={session.societyName} residentName={session.residentName} />} />
            <Route path="/resident/billing"          element={<ResidentBilling />} />
            <Route path="/resident/announcements"    element={<ResidentAnnouncements />} />
            <Route path="/resident/visitor-passes"   element={<ResidentVisitorPasses />} />
            <Route path="/resident/profile"          element={<ResidentProfile onComplete={handleProfileComplete} />} />
            <Route path="*"                          element={<Navigate to="/resident" replace />} />
          </Routes>
        </ResidentLayout>
      </ThemeProvider>
    );
  }

  // ── Secretary portal ──────────────────────────────────────────────────────

  if (session.role === "SOCIETY_ADMIN") {
    return (
      <ThemeProvider theme={shellTheme}>
        <SecretaryLayout
          societyName={session.societyName}
          onLogout={handleLogout}
        >
          <Routes>
            <Route path="/"                           element={<Navigate to="/secretary" replace />} />
            <Route path="/secretary"                  element={<SecretaryDashboard societyId={session.societyId} societyName={session.societyName} />} />
            <Route path="/secretary/residents"        element={<SecretaryResidents societyId={session.societyId} />} />
            <Route path="/secretary/tickets"          element={<SecretaryTickets />} />
            <Route path="/secretary/announcements"    element={<SecretaryAnnouncements />} />
            <Route path="/secretary/maintenance"      element={<SecretaryMaintenance />} />
            <Route path="/secretary/profile"          element={<SecretaryProfile onLogout={handleLogout} />} />
            <Route path="*"                           element={<Navigate to="/secretary" replace />} />
          </Routes>
        </SecretaryLayout>
      </ThemeProvider>
    );
  }

  // ── Vendor portal ─────────────────────────────────────────────────────────

  if (session.role === "VENDOR") {
    const vendorDisplayName = session.username;
    return (
      <ThemeProvider theme={shellTheme}>
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
      </ThemeProvider>
    );
  }

  // ── Nexso Admin portal (existing UI) ─────────────────────────────────────

  return (
    <ThemeProvider theme={shellTheme}>
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
    </ThemeProvider>
  );
}
