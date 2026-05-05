# nmanoharan.github.io (GitHub User Pages)

These files are meant to live in a **separate** GitHub repository named exactly:

**`nmanoharan/nmanoharan.github.io`**

They publish to:

- **Site:** `https://nmanoharan.github.io/`
- **Privacy policy (App Store):** `https://nmanoharan.github.io/privacy-policy.html`

## One-time setup

1. On GitHub, create a **new public** repository named **`nmanoharan.github.io`** (must match your username).
2. Do **not** add a README or license on GitHub if you will push this folder as the first commit (or pull then merge).
3. On your machine, either:
   - **Copy** the contents of this folder into a fresh clone of `nmanoharan.github.io`, or  
   - **Push this folder as the repo root** (see commands below).

## Push from a new clone

```bash
git clone https://github.com/nmanoharan/nmanoharan.github.io.git
cd nmanoharan.github.io
# copy index.html, privacy-policy.html, .nojekyll from this folder into the repo root
git add index.html privacy-policy.html .nojekyll README.md
git commit -m "Add HealthGenie static pages"
git push origin main
```

## Enable GitHub Pages

Repository **Settings** → **Pages** → **Build and deployment** → Source: **Deploy from a branch** → Branch **`main`**, folder **`/` (root)** → Save.

After the workflow runs, open `https://nmanoharan.github.io/privacy-policy.html` and confirm it loads.

## Syncing with the main app repo

The canonical policy template also lives in **healthgenie-agentic-app** under `docs/privacy-policy.html`. When you change the policy, update **both** copies (or copy-paste) so this user site stays in sync.
