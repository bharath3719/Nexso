import React, { useEffect, useState, useCallback } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import {
  initializeIcons, ThemeProvider, Stack, Text,
  MessageBar, MessageBarType, TextField, PrimaryButton, DefaultButton, Spinner,
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

import { SecretaryLayout }         from "./components/SecretaryLayout.jsx";
import { SecretaryDashboard }      from "./pages/secretary/SecretaryDashboard.jsx";
import { SecretaryResidents }      from "./pages/secretary/SecretaryResidents.jsx";
import { SecretaryTickets }        from "./pages/secretary/SecretaryTickets.jsx";
import { SecretaryProfile }        from "./pages/secretary/SecretaryProfile.jsx";
import { SecretaryMaintenance }    from "./pages/secretary/SecretaryMaintenance.jsx";
import { SecretaryAnnouncements }  from "./pages/secretary/SecretaryAnnouncements.jsx";

import { ResidentLayout }          from "./components/ResidentLayout.jsx";
import { ResidentDashboard }       from "./pages/resident/ResidentDashboard.jsx";
import { ResidentAnnouncements }   from "./pages/resident/ResidentAnnouncements.jsx";
import { ResidentVisitorPasses }   from "./pages/resident/ResidentVisitorPasses.jsx";

import { VendorLayout }    from "./components/VendorLayout.jsx";
import { VendorDashboard } from "./pages/vendor/VendorDashboard.jsx";
import { VendorTickets }   from "./pages/vendor/VendorTickets.jsx";
import { VendorProfile }   from "./pages/vendor/VendorProfile.jsx";

import { PasswordChangeFields } from "./components/PasswordChangeFields.jsx";

import {
  saveSession, clearSession,
  getRole, getSocietyId, getSocietyName, getUsername, getVendorId,
  getResidentId, getUnitId, getUnitNumber, getResidentName,
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

// ─── OTP Login Screen ─────────────────────────────────────────────────────────

function OtpLoginScreen({ onLogin, error, loading }) {
  const [step,  setStep]  = useState("phone");   // "phone" | "otp"
  const [phone, setPhone] = useState("");
  const [otp,   setOtp]   = useState("");
  const [devOtp, setDevOtp] = useState("");       // returned in dev mode

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    const result = await onLogin({ step: "request", phone });
    if (result?.otp) setDevOtp(result.otp);       // dev-only
    setStep("otp");
  };

  const handleOtpSubmit = (e) => {
    e.preventDefault();
    onLogin({ step: "verify", phone, otp });
  };

  return (
    <AuthCard
      title="Nexso Resident"
      subtitle={step === "phone" ? "Enter your registered WhatsApp number." : `OTP sent to ${phone}. Enter it below.`}
      error={error}
    >
      {step === "phone" ? (
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
            {loading
              ? <Spinner label="Verifying…" />
              : (
                <Stack tokens={{ childrenGap: 8 }}>
                  <PrimaryButton type="submit" text="Verify OTP" />
                  <DefaultButton
                    text="Change number"
                    onClick={() => { setStep("phone"); setOtp(""); setDevOtp(""); }}
                  />
                </Stack>
              )
            }
          </Stack>
        </form>
      )}
    </AuthCard>
  );
}

// ─── Login portal selector ────────────────────────────────────────────────────

function PortalSelector({ onSelectAdmin, onSelectResident }) {
  return (
    <ThemeProvider theme={shellTheme}>
      <Stack verticalFill verticalAlign="center" horizontalAlign="center" styles={loginScreenStyles.outer}>
        <Stack styles={loginScreenStyles.card} tokens={{ childrenGap: 20 }}>
          <Text variant="xLarge" styles={loginScreenStyles.title}>Nexso</Text>
          <Text variant="small" styles={loginScreenStyles.subtitle}>Choose your portal.</Text>
          <Stack tokens={{ childrenGap: 10 }}>
            <PrimaryButton text="Admin / Secretary / Vendor" onClick={onSelectAdmin} />
            <DefaultButton text="Resident Login (WhatsApp OTP)" onClick={onSelectResident} />
          </Stack>
        </Stack>
      </Stack>
    </ThemeProvider>
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
    residentId:         getResidentId(),
    unitId:             getUnitId(),
    unitNumber:         getUnitNumber(),
    residentName:       getResidentName(),
    forcePasswordReset: false,
  }));
  const [portalMode, setPortalMode] = useState("selector"); // "selector" | "admin" | "resident"
  const [loginError,  setLoginError]  = useState("");
  const [resetError,  setResetError]  = useState("");
  const [loading,     setLoading]     = useState(false);

  // ── Session-expiry handler (fired by api.js on 401) ───────────────────────

  useEffect(() => {
    const handleUnauthorized = () => {
      setSession({ authed: false, role: null, societyId: null, societyName: null, username: null, vendorId: null, residentId: null, unitId: null, unitNumber: null, residentName: null, forcePasswordReset: false });
      setLoginError("Your session has expired. Please sign in again.");
      setPortalMode("selector");
    };
    window.addEventListener("nexso:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("nexso:unauthorized", handleUnauthorized);
  }, []);

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
        authed:       true,
        role:         "RESIDENT",
        societyId:    data.societyId,
        societyName:  data.societyName,
        username:     phone,
        vendorId:     null,
        residentId:   data.residentId,
        unitId:       data.unitId,
        unitNumber:   data.unitNumber,
        residentName: data.name,
        forcePasswordReset: false,
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

  // ── Logout ────────────────────────────────────────────────────────────────

  const handleLogout = useCallback(() => {
    clearSession();
    setSession({ authed: false, role: null, societyId: null, societyName: null, username: null, vendorId: null, residentId: null, unitId: null, unitNumber: null, residentName: null, forcePasswordReset: false });
    setLoginError("");
    setPortalMode("selector");
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!session.authed) {
    if (portalMode === "selector") {
      return (
        <PortalSelector
          onSelectAdmin={() => setPortalMode("admin")}
          onSelectResident={() => setPortalMode("resident")}
        />
      );
    }
    if (portalMode === "resident") {
      return (
        <OtpLoginScreen
          onLogin={handleOtpLogin}
          error={loginError}
          loading={loading}
        />
      );
    }
    return <LoginScreen onLogin={handleLogin} error={loginError} loading={loading} />;
  }

  if (session.forcePasswordReset) {
    return <ForceResetScreen onReset={handlePasswordReset} error={resetError} loading={loading} />;
  }

  // ── Resident portal ───────────────────────────────────────────────────────

  if (session.role === "RESIDENT") {
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
            <Route path="/resident/announcements"    element={<ResidentAnnouncements />} />
            <Route path="/resident/visitor-passes"   element={<ResidentVisitorPasses />} />
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
