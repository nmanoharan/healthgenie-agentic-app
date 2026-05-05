# HealthGenie n8n — consolidated imports

## What is in this folder

| File | Purpose |
|------|---------|
| `01_healthgenie_onboarding.full.json` | **Onboarding:** webhook → normalize → validate → IF → risk → ethnicity context → diet → exercise → safety → IF → single JSON response |
| `02_healthgenie_daily_plan_generation.full.json` | **Daily plan:** manual trigger + **7:00 cron** → mock user profile → risk → diet → exercise → safety → plan JSON |
| `03_healthgenie_daily_checkpoint.full.json` | **Checkpoint:** webhook → parse → IF complete → adaptive → progress → safety → response |
| `healthgenie_all_workflows.bundle.json` | Same three workflows in one JSON **array** (see below) |

## How to import in n8n

1. Open n8n → **Workflows** → menu **⋯** or **Import from File**.
2. Import **each** of `01_…`, `02_…`, and `03_…` separately (recommended).
3. **Activate** each workflow after wiring credentials (webhooks need activation to register URLs).
4. Open **Webhook** nodes and copy the **Test** or **Production** URL for your chat UI or API client.

### Bundle file (`healthgenie_all_workflows.bundle.json`)

Many n8n versions import **one workflow object per file**. If your build does not accept a top-level JSON array, import the three `01` / `02` / `03` files instead of the bundle.

## Credentials (placeholders)

These exports use **Code** nodes and **no stored credentials**. Optional next steps:

- **LLM:** Add OpenAI / Anthropic nodes after **Ethnicity Family Context** (onboarding) or replace meal text with HTTP Request + **Header Auth** (`Authorization: Bearer …`). See sticky notes on the canvas.
- **Database:** Replace **Set Mock Active User** in daily plan workflow with **Postgres** / **Supabase**.
- **Push:** After **Build Daily Plan Output**, add **FCM** / **Twilio** / **Send Email**.

Details: `credentials_placeholder.md`.

## Test payloads

**POST** onboarding webhook path: `healthgenie/onboarding` (full URL from n8n after activate).

```json
{
  "age": 45,
  "height_cm": 173,
  "weight_kg": 86,
  "activity_level": "low",
  "goal": "weight_loss",
  "diet_pref": "vegetarian",
  "ethnicity": "south_asian",
  "family_history": "diabetes",
  "medical_constraints": "none"
}
```

**POST** checkpoint path: `healthgenie/checkpoint`

```json
{
  "activity_done": true,
  "steps": 6200,
  "energy": 4,
  "sleep_quality": 3,
  "pain_reported": "none",
  "meal_adherence": "high"
}
```

Validation failures and safety red flags return JSON with `ok: false` and `http_status` / `stage` in the body (HTTP status from the webhook response is **200** for compatibility; use `http_status` in the payload for 422 semantics if needed).

## Regenerating exports

To regenerate JSON from the embedded generator, run:

```bash
python3 scripts/build_n8n_workflows.py
```
