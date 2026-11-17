# AutoD AI authentication setup

AutoD AI password verification now runs in the serverless API route at `/api/autod-auth`. The browser bundle no longer contains the password.

Before enabling AutoD AI in a deployment:

1. Open the Vercel project for this repository.
2. Open **Settings → Environment Variables**.
3. Add `AUTOD_AI_PASSWORD` with a new, unique password.
4. Enable it for the environments you intend to use (Preview and/or Production).
5. Redeploy the relevant environment after the variable is saved.

Do not prefix this variable with `VITE_`; that would expose it to browser code. Rotate the previously embedded password because it was present in client-side source.
