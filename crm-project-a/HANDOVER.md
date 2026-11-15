# Handover: Project A, Phase 2 (A4 + A5) — SunGuard Odoo CRM

Paste this whole file into a new AI chat, then attach the JSON files named below (from this folder on GitHub).

## Who I am and how to work with me
I am Chryspyl Nolledo, a former Chief Officer building an automation portfolio. I have a speech difficulty and work in writing.
- Reply in simple Taglish, short, one step at a time. Wait for my screenshot or "done" before the next step.
- Give me complete, import-ready n8n workflow JSON. I import it, connect credentials, test, and send screenshots.
- Never put API keys, tokens or passwords inside workflow JSON. Use the n8n environment variables below.
- Do not change my existing workflows (00–13C, A0–A3b). New workflows start with "A".
- Dummy data only (SunGuard Solar & CCTV is fictional). The AI never sends anything to a customer without my approval in Telegram.
- Warn me before anything that costs money.

## My setup (already working)
- **n8n** self-hosted in Docker on Windows (`localhost:5678`). Container started with env vars:
  `ODOO_URL=http://host.docker.internal:8069`, `ODOO_DB=logistics_demo`, `ODOO_UID=2`, `ODOO_API_KEY`, `TG_APPROVAL_TOKEN`, `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`. Use them as `$env.ODOO_URL` etc.
- **Odoo 18 Community** in Docker (`localhost:8069`), multi-company. Company "SunGuard Solar & CCTV (Demo)". CRM installed.
  All IDs (company, team, stages New/Qualified/Proposition/Won, tags Hot/Warm/Cold/Solar Panel/Inverter/Battery/Hybrid System/CCTV, UTM source/medium) are stored in Odoo system parameter **`sunguard_crm.ids`** (JSON). Custom lead fields: `x_lead_ref` (sheet Lead_ID), `x_clickup_task_id`.
  Products (company SunGuard): SG-001 100W panel, SG-002 200W panel, SG-003 battery (stock 1, LOW), SG-004 1000W inverter (stock 2, LOW), SG-005 flood light, SG-006 CCTV camera, SG-007 4-ch DVR, SG-008 CCTV power supply.
- **Odoo call pattern** (HTTP Request node, POST `{{ $env.ODOO_URL }}/jsonrpc`, onError = continue). A Code node before it builds `$json.rpc = { model, method, args, kwargs }`; body:
  `{ jsonrpc:'2.0', method:'call', params:{ service:'object', method:'execute_kw', args:[ $env.ODOO_DB, Number($env.ODOO_UID), $env.ODOO_API_KEY, $json.rpc.model, $json.rpc.method, $json.rpc.args, $json.rpc.kwargs || {} ] } }`
  Always pass `context: { allowed_company_ids: [cfg.company_id] }` (default company is SeaLink). First node of each workflow reads the config: `ir.config_parameter.get_param('sunguard_crm.ids')`.
  Odoo omits `result` when a method returns nothing — read it with `res.result` and allow `undefined`.
- **Google Sheet** "SunGuard_Products", tab **CRM_Leads**, columns:
  `Lead_ID | Timestamp | Name | Email | Phone | City | Message | Consent | Status | Score | Odoo_Lead_ID | Processed_At | Error | Reply_Status | Reply_Subject | Reply_Draft | Reply_Sent_At`
  (Reply_Status values: Awaiting approval / Sent / Error). Tab **Heartbeat** (A0).
- **Telegram**: alerts bot (SunGuardShopOrdersBot, n8n credential "Telegram account") and a separate **approval bot** (token in `$env.TG_APPROVAL_TOKEN`) used with inline buttons. Buttons work on localhost by **polling `getUpdates` every minute** (workflow A3b). My chat ID is in the A3b JSON.
- **Gmail** credential "Gmail account". Demo mode: every "customer" email goes to my own demo inbox, subject `[DEMO → customer@example.com] …`.
- **Gemini**: HTTP Request to `…/models/gemini-3.5-flash-lite:generateContent`, credential "Google Gemini(PaLM) Api account", retry 3× / 5 s, batching 1 per 4 s, onError continue.

## Already built and tested (attach these JSON files)
| Workflow | Does |
|---|---|
| A0 Heartbeat | time → Heartbeat tab every 5 min |
| A1 Lead Intake + AI Qualifier | CRM_Leads Waiting → Gemini score → Odoo lead (or note if same email) → Telegram for Hot/Warm |
| A2 Qualified → ClickUp site survey | Qualified lead → ClickUp task, task done → Proposition |
| A3a AI Reply Drafter | Hot/Warm Processed leads without Reply_Status → Odoo stock → Gemini draft → sheet "Awaiting approval" → approval bot with ✅ Send / ✏️ Edit |
| A3b Telegram Approvals | polls button taps → Send: Gmail demo inbox + Odoo note + sheet "Sent"; Edit: asks for new text, shows new preview |

## Lessons learned (avoid these)
1. Google Sheets "Update row" node: after changing Document/Sheet, press ⟳ on "Values to Update", **delete extra columns**, keep only the columns you update, and refill the `{{ $json.x }}` values — otherwise values are empty or other columns get blanked.
2. Sheet header names may contain stray spaces: normalise keys with `String(k).trim()` in Code nodes.
3. A Telegram bot can only message me after I press **Start** in that bot.
4. The approval bot must not also have a Telegram Trigger/webhook (409 conflict with getUpdates). Only A3b polls it — A4 must reuse A3b's button handling, not poll separately.
5. n8n S3/HTTP nodes read options from item 0 only — build one request per item in a Code node.
6. Gemini can be wrong (it called 7 units "limited stock") — that is why every customer email needs my approval.

## What to build now
### A4 — 3-day follow-up (with approval)
- Every 60 min: rows with `Reply_Status = Sent`, `Reply_Sent_At` older than 3 days, no follow-up yet, and the Odoo lead still in New/Qualified (not Proposition/Won/lost).
- Gemini writes a short, polite follow-up (same rules: no prices, no dates, no product codes, Taglish if the customer wrote Taglish).
- Add sheet columns `Followup_Status | Followup_Draft | Followup_Sent_At`.
- Send the draft to the approval bot with buttons using callback data **`fsend:L-0001` / `fedit:L-0001`**, and **extend A3b** to handle them (one poller only). On send: Gmail demo inbox + Odoo note + sheet `Followup_Status = Sent`.
- Max 3 per run. Give me a way to test without waiting 3 days (e.g. a `TEST_DAYS` constant at the top of the Code node).

### A5 — Won → Sales Order (+ Contact fix)
- Every 15 min: SunGuard leads in stage **Won** with no sales order yet.
- Find or create the customer `res.partner` by email (company SunGuard), link it on the lead (`partner_id`) — this also fixes the empty "Contact" field.
- Create a **draft** `sale.order` in company SunGuard (`client_order_ref = 'CRM-<lead id>'` so it is never duplicated) with one line per product tag (map tags to SG codes like A3a's `PRODUCTS_FOR_TAG`, quantity 1, Odoo list price). Do not confirm it — a person confirms.
- Note on the lead + Telegram alert (alerts bot): `🏆 WON L-0010 — Draft SO S000xx created for Rico Navarro`.

## How to deliver
1. Short plan for A4 and A5 (one table) → wait for my OK.
2. A4 JSON + the updated A3b JSON → test steps.
3. A5 JSON → test steps (I will drag one lead to Won in Odoo).
4. A short README section for GitHub.
