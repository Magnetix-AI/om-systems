# Architecture

- Use the shared Shadcn Calendar for the admin date navigator and keep its selection synchronized with the main calendar and day details; this preserves one date context across views.
- Package Windows as a sandboxed Electron client of the published HTTPS app, not a static Vite export; TanStack server features stay hosted and the website build remains unchanged.
- Save optional desktop credentials only through an isolated preload and main-process encrypted OS storage, scoped to the trusted top-level login page and committed after successful navigation; this preserves session expiry and avoids plaintext password storage.