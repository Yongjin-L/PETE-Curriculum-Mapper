# AI features: one-time setup

The site has two AI features:
- **Upload plan of study:** reads a PDF, Word file, image or CSV and lists the courses for the user to review and confirm.
- **Analyze my map:** writes a short review of standards coverage, I→R→M progression, course balance and gaps.

Both features need **Google sign-in to be set up first** (see [GOOGLE_SETUP.md](GOOGLE_SETUP.md)), because each person's daily limit is tied to their Google account. Until the steps below are done, the site shows "AI features are not set up yet" and everything else works normally.

You need two things: an **Anthropic API key**, which pays for the AI, and an **Upstash Redis** database, which counts each person's daily uses (free tier).

---

## 1. Anthropic API key (with a spending cap)
1. Go to **console.anthropic.com** and sign in or create an account. Add a payment method under **Billing**.
2. **Set a monthly spend limit first:** **Settings → Limits** (or **Billing → Spend limits**) → set a monthly limit, for example **$20**. When it's reached, AI calls simply stop until the next month; nothing else on the site breaks.
3. **Settings → API keys → Create key**. Name it `PETE Curriculum Mapper`, then copy the key (starts with `sk-ant-`). The console shows it only once.

## 2. Upstash Redis (daily limits)
1. In **Vercel** → your project → **Storage** → **Create Database** (or **Marketplace**) → **Upstash** → **Upstash for Redis** → choose the **Free** plan and a region near you (e.g. US East) → **Create**.
2. Connect it to the **PETE Curriculum Mapper** project for **Production** and **Preview**.
   Vercel adds the connection variables automatically (`KV_REST_API_URL` / `KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`; either pair works).

## 3. Add the API key to Vercel
Vercel → project → **Settings → Environment Variables** → add:

| Name | Value | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | your `sk-ant-…` key | Tick **Sensitive**. Production + Preview. **Never** put it in the code or in a `NEXT_PUBLIC_` variable. |

Optional settings (defaults shown):

| Name | Default | Meaning |
|---|---|---|
| `AI_DAILY_UPLOADS` | `5` | Plan-of-study uploads per person per day |
| `AI_DAILY_ANALYSES` | `10` | Map analyses per person per day |
| `AI_GLOBAL_DAILY_LIMIT` | `100` | All AI uses on the whole site per day (cost safety net) |
| `AI_DISABLED` | *(unset)* | Set to `true` to switch AI off instantly without removing the key |
| `AI_MODEL` | `claude-opus-5-5` | The Claude model. `claude-sonnet-5-5` costs about half as much |

Limits reset at midnight UTC. Then **redeploy**: Deployments → ⋯ → **Redeploy**.

## 4. Try it
1. Sign in on the site → **Add courses** → **Upload plan of study (AI)** → choose a PDF of a plan of study.
2. Review the list, fix anything, and click **Confirm**.
3. Map a few topics → **Coverage** tab → **Analyze my map**.
4. **Export → Full** includes the analysis.

## What it costs (estimates)
The default model is Claude Opus 5.5 ($4 per million input tokens, $20 per million output tokens).

| Action | Typical cost |
|---|---|
| Reading a 2–6 page plan of study | about $0.03–$0.10 |
| One map analysis | about $0.04–$0.10 |

With the default site-wide cap of 100 uses a day, the worst case is roughly $10 a day. Your Anthropic monthly spend limit is the hard ceiling. Check real usage at console.anthropic.com → **Usage**.

## Privacy notes
- Uploaded files are sent to Anthropic to be read and are not stored by the site. Under Anthropic's commercial API terms, API inputs are not used to train models by default.
- Daily counters store only a one-way hash of the person's Google account ID, never the email address.
