# Credential placeholders for n8n

Use n8n **Credentials** UI to create these when you add nodes that need them.

| Credential | Used for | Notes |
|------------|-----------|--------|
| **OpenAI API** | Chat / completions for diet copy, summaries | Prefer env-based secrets in production |
| **Anthropic API** | Claude alternative | Same placement as OpenAI in the graph |
| **Postgres** or **Supabase** | User profiles, checkpoints, daily plans | Replace **Set Mock Active User** |
| **Header Auth** | Generic REST (OpenAI HTTP, custom backend) | Name: `Authorization`, value: `Bearer <token>` |
| **Firebase Cloud Messaging** | Push for daily plan / checkpoint | After plan is built |
| **Twilio** | SMS check-ins | Optional |

The consolidated workflow JSON files ship **without** credential IDs so imports do not fail on missing secrets.
