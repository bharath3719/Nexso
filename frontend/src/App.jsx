import React, { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { initializeIcons, ThemeProvider, Stack, Text, MessageBar, MessageBarType, TextField, PrimaryButton } from "@fluentui/react";
import { navLinks } from "./constants.js";
import { shellTheme } from "./theme.js";
import { Layout } from "./components/Layout.jsx";
import { Dashboard } from "./pages/Dashboard.jsx";
import { UsersPage } from "./pages/Users.jsx";
import { ComplaintsPage } from "./pages/Complaints.jsx";
import { VendorsPage } from "./pages/Vendors.jsx";
import { PaymentsPage } from "./pages/Payments.jsx";

initializeIcons();

const DEFAULT_CREDENTIALS = { username: "admin", password: "admin123" };
const AUTH_KEY = "nexso_authed";

function LoginScreen({ onLogin, error }) {
  const [form, setForm] = useState({ username: "", password: "" });

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(form);
  };

  return (
    <ThemeProvider theme={shellTheme}>
      <Stack verticalFill verticalAlign="center" horizontalAlign="center" styles={{ root: { background: "#f5f7fa", padding: 16 } }}>
        <Stack styles={{ root: { width: 380, maxWidth: "90vw", background: "#fff", padding: 24, borderRadius: 12, boxShadow: "0 12px 28px rgba(0,0,0,0.12)" } }} tokens={{ childrenGap: 16 }}>
          <Text variant="xLarge" styles={{ root: { fontWeight: 700, textAlign: "center" } }}>
            Nexso Login
          </Text>
          <Text variant="small" styles={{ root: { color: "#5f6a7a", textAlign: "center" } }}>
            Enter the default credentials to continue.
          </Text>
          {error ? <MessageBar messageBarType={MessageBarType.error}>{error}</MessageBar> : null}
          <form onSubmit={handleSubmit}>
            <Stack tokens={{ childrenGap: 12 }}>
              <TextField label="Username" value={form.username} onChange={(_, v) => setForm((s) => ({ ...s, username: v || "" }))} autoComplete="username" required />
              <TextField label="Password" type="password" value={form.password} onChange={(_, v) => setForm((s) => ({ ...s, password: v || "" }))} autoComplete="current-password" required />
              <PrimaryButton type="submit" text="Sign in" />
              <Text variant="xSmall" styles={{ root: { color: "#7a8698", textAlign: "center" } }}>
                Default: {DEFAULT_CREDENTIALS.username} / {DEFAULT_CREDENTIALS.password}
              </Text>
            </Stack>
          </form>
        </Stack>
      </Stack>
    </ThemeProvider>
  );
}

export default function App() {
  const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:3000";
  const [authed, setAuthed] = useState(false);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(AUTH_KEY);
    if (saved === "true") setAuthed(true);
  }, []);

  const handleLogin = (form) => {
    if (form.username === DEFAULT_CREDENTIALS.username && form.password === DEFAULT_CREDENTIALS.password) {
      setAuthed(true);
      localStorage.setItem(AUTH_KEY, "true");
      setLoginError("");
    } else {
      setLoginError("Invalid credentials. Use the defaults shown below.");
    }
  };

  if (!authed) {
    return <LoginScreen onLogin={handleLogin} error={loginError} />;
  }

  return (
    <ThemeProvider theme={shellTheme}>
      <BrowserRouter>
        <Layout navLinks={navLinks}>
          <Routes>
            <Route path="/" element={<Dashboard apiBase={apiBase} />} />
            <Route path="/users" element={<UsersPage apiBase={apiBase} />} />
            <Route path="/complaints" element={<ComplaintsPage apiBase={apiBase} />} />
            <Route path="/vendors" element={<VendorsPage apiBase={apiBase} />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ThemeProvider>
  );
}
