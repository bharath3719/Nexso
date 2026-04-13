# Nexso Frontend

React + Vite admin dashboard for tickets, users, vendors, and complaint operations.

## Configure

Copy [frontend/.env.example](frontend/.env.example) to `.env` or `.env.local`.

- `VITE_API_BASE`: public base URL of the backend API.
- `VITE_ENABLE_DEMO_LOGIN`: optional frontend-only demo gate. Keep this `false` for normal deployments unless you explicitly want a lightweight demo login.
- `VITE_DEMO_USERNAME` and `VITE_DEMO_PASSWORD`: only used when demo login is enabled.

## Run Locally

```bash
npm install
npm run dev
```

## Build For Deployment

```bash
npm install
npm run build
```

The production build is emitted to `dist/` and can be deployed to static hosting such as Vercel, Netlify, S3 + CloudFront, or Nginx.

## Deployment Notes

1. Deploy the backend first and copy its public origin into `VITE_API_BASE`.
2. If you deploy the frontend under a subpath instead of a domain root, add a router basename before deployment.
3. The built-in login is demo-only because it runs fully in the browser. For real access control, use provider auth, reverse-proxy auth, or implement backend authentication.
