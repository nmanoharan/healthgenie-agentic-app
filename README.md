# HealthGenie AI - Multi-Agent Diet, Exercise, and Preventive Wellness Coach

HealthGenie AI is a prototype for a preventive wellness coach that combines multi-agent orchestration, personalized planning, daily feedback loops, and safety guardrails.

## Problem Statement
Most wellness apps provide static and generic plans. Users need adaptive guidance that reflects their body profile, preferences, lifestyle patterns, and risk context.

## Solution Overview
This project implements an **agentic workflow system** powered by n8n and LLM-backed agents that:
- Collect and validate user wellness profiles through a chat interface
- Generate personalized diet and exercise plans
- Track daily adherence and wellness feedback
- Adapt future plans based on real-time user responses
- Detect red flags and escalate with safe guidance

## Safety Disclaimer
This system is for **preventive wellness guidance only**. It does not diagnose, treat, or prescribe. Users must seek licensed medical care for clinical concerns or emergencies.

## Business Use Case
Target users are adults who want personalized wellness guidance for diet, activity, and long-term prevention. The app supports personalization based on age, height, weight, BMI, activity level, food preferences, cultural context, and optional family-history risk.

## Technical Stack
- **Chat UI:** Vite + React web app in `frontend/web/`; Expo (iOS/Android) app in `frontend/mobile/`; product spec in `frontend/mobile_chat_ui.md`
- **Orchestrator:** n8n
- **LLM Backend:** OpenAI / Claude
- **Profile Store:** PostgreSQL / Supabase / Firebase
- **Memory:** n8n memory or vector store
- **Rules Engine:** JavaScript/Python function nodes
- **Food Data:** USDA FoodData Central + curated CSV
- **Exercise KB:** JSON activity rules
- **Notifications:** Firebase, Twilio, or Email
- **Dashboard:** Streamlit / Gradio / web dashboard

## Agent Architecture
1. Profile Collection Agent
2. Data Validation Agent
3. Wellness Risk Agent
4. Ethnicity/Family Context Agent
5. Diet Planning Agent
6. Exercise Planning Agent
7. Daily Checkpoint Agent
8. Adaptive Plan Agent
9. Safety and Escalation Agent

## Workflow Map
### Workflow 1 - User Onboarding
Chat UI -> Webhook -> Profile Collection -> Data Validation -> Profile Store -> Wellness Risk -> Summary

### Workflow 2 - Daily Plan Generation
Schedule Trigger -> Fetch Profile -> Fetch Prior Checkpoints -> Diet Planning -> Exercise Planning -> Safety Guardrail -> Save Plan -> Notify User

### Workflow 3 - Daily Checkpoint Loop
User Message -> Webhook -> Checkpoint Agent -> Progress Analyzer -> Adaptive Plan -> Safety Agent -> Update Memory -> Chat Response

## Repository Structure
See folders for:
- n8n agent flow JSON templates
- prompt templates per agent
- mock sample inputs
- test scenario checklist
- lightweight mobile UI specification, web UI (`frontend/web/`), and Expo mobile app (`frontend/mobile/`)

## Quick Start
1. Import the **consolidated** workflows from `n8n_flows/export/` (see `n8n_flows/export/IMPORT_INSTRUCTIONS.md`). Use `01_…`, `02_…`, and `03_…` for a one-import-per-workflow setup, or regenerate everything with `python3 scripts/build_n8n_workflows.py`.
2. Optional: import modular agent snippets from `n8n_flows/onboarding/`, `planning/`, and `daily_loop/` if you prefer to compose graphs yourself.
3. Configure webhook URLs and secrets in `config.yaml`.
4. Populate test profiles from `sample_inputs/sample_user_profiles.csv`.
5. Connect your LLM provider API key and storage backend when you add LLM nodes (sticky notes in the full exports describe placement).
6. Run onboarding and daily-loop test scenarios from `tests/test_health_plan_flow.md`.

### Run web UI (Vite + React)
1. Activate onboarding and checkpoint workflows in n8n and copy your instance base URL (e.g. `https://yourname.app.n8n.cloud`).
2. `cd frontend/web && cp .env.example .env.local`
3. Set `VITE_N8N_BASE_URL` in `.env.local` to that origin (no trailing slash). Paths default to `/webhook/healthgenie/onboarding` and `/webhook/healthgenie/checkpoint` (see `config.yaml`).
4. If the browser blocks requests with CORS, set `VITE_USE_PROXY=true` and `VITE_N8N_PROXY_TARGET` to the same n8n origin, then restart `npm run dev` so Vite proxies `/webhook/*` to n8n.
5. `npm install && npm run dev` and open the printed local URL.

### Run iOS app (Expo)
1. Install [Xcode](https://developer.apple.com/xcode/) from the Mac App Store (iOS Simulator).
2. `cd frontend/mobile && cp .env.example .env` and set **`EXPO_PUBLIC_N8N_BASE_URL`** to your n8n origin (HTTPS, no trailing slash; same value idea as `VITE_N8N_BASE_URL` for web). Native apps are not limited by browser CORS.
3. Restart the bundler so env is picked up: `npx expo start -c` (or stop Metro and start again). Empty or missing `.env` means webhook calls will fail until this is set.
4. `npm install` then `npx expo start` and press `i` for iOS Simulator, or `npx expo run:ios` for a local development build.
5. On a physical iPhone, use Expo Go and scan the QR code from the dev server (same Wi‑Fi as your Mac).
6. **EAS / TestFlight:** `EXPO_PUBLIC_*` variables must exist at **build** time. Set `EXPO_PUBLIC_N8N_BASE_URL` in the `production` profile `env` block in `frontend/mobile/eas.json`, or in [Expo dashboard environment variables](https://expo.dev), then run `eas build` again.

### Privacy policy URL (App Store Connect)
Apple asks for a **public HTTPS URL** to your privacy policy. This repo includes:

- [`docs/privacy-policy.html`](docs/privacy-policy.html) — the policy page  
- [`docs/index.html`](docs/index.html) — redirects to the policy (handy if Pages serves `/docs` as the site root)

Replace the placeholder contact email in `privacy-policy.html` and align the text with your deployment before you submit to Apple.

**GitHub Pages — which URL to use**

GitHub → your repo → **Settings** → **Pages** → **Build and deployment**:

| Source folder | Policy URL (project site) |
|---------------|---------------------------|
| **Branch `main`**, folder **`/docs`** | `https://<user>.github.io/<repo>/privacy-policy.html` or `https://<user>.github.io/<repo>/` (redirects via `index.html`) |
| **Branch `main`**, folder **`/` (root)** | `https://<user>.github.io/<repo>/docs/privacy-policy.html` |

If you pick **`/docs`**, do **not** put `/docs/` again in the path after the repo name.

**If the page still does not open**

1. Wait a few minutes after enabling Pages; refresh **Settings → Pages** for the green “Your site is live at …” line.  
2. Repo must allow Pages builds (public repo is simplest on free accounts).  
3. Confirm the branch name is **`main`** (or change Pages to match your default branch).  
4. Open the file on GitHub to verify it exists: `https://github.com/<user>/<repo>/blob/main/docs/privacy-policy.html` — that proves the file is in git; the Pages URL is separate.  
5. Try an incognito window or another network (DNS/cache).

**Other hosts**

- **Netlify Drop / Cloudflare Pages / Vercel:** deploy the `docs` folder (or upload `privacy-policy.html`) and use the HTTPS URL they give you.

## Cursor workspace
Open `HealthGenie.code-workspace` in Cursor for a dedicated window rooted in this repo (File → Open Workspace from File…).

## Deliverables Coverage
This scaffold includes:
- Multi-agent workflow templates
- Onboarding and daily checkpoint path
- BMI/risk logic placeholders
- Diet/exercise/safety prompt templates
- Sample profile and knowledge data
- End-to-end test scenarios
- Documentation and setup config

## Evaluation Mapping
- Multi-agent architecture: represented in modular n8n flow files
- n8n implementation: importable workflow skeletons
- Personalization: prompts + rules + user profile schema
- Safety: dedicated escalation flow + prompt policy
- UX: mobile chat specification
- Daily loop: checkpoint and adaptive plan templates
- Documentation: README + tests + config

## Future Enhancements
- Wearables integrations (Apple Health, Fitbit, Garmin)
- Continuous glucose monitor adaptation
- Smart grocery generation
- Meal photo nutrient estimates
- Provider-ready wellness summary export
- Family-shared dashboard
- Multi-language coaching
- Trend dashboards for long-term prevention
