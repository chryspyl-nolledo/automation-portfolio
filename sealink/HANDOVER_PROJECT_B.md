# Handover: Project B — SeaLink Ship Spares: Zoho CRM ↔ Odoo + Logistics

Paste this whole file into a new AI chat. Attach `crm-project-a/A3b_Telegram_Approvals.json` and `crm-project-a/A5_Won_to_Sales_Order.json` from GitHub as pattern examples.

## Who I am and how to work with me
I am Chryspyl Nolledo, a former Chief Officer (13 years) building an automation portfolio. I have a speech difficulty and work in writing.
- Reply in simple Taglish, short, one step at a time. Wait for my screenshot or "done" before the next step.
- Give complete, import-ready n8n workflow JSON. I import, connect credentials, test and send screenshots.
- Never put API keys, tokens or passwords inside workflow JSON. Use n8n credentials or the env vars below.
- Do not change existing workflows (00–13C, A0–A5, 12 SeaLink brief). New workflows are named **SL1, SL2 …**
- Dummy data only (SeaLink Ship Spares is fictional; vessels and ports are sample names). No message goes to a real customer.
- Warn me before anything that costs money. Prefer free plans.

## My setup (already working)
- **n8n** self-hosted in Docker on Windows (`localhost:5678`). Env vars: `ODOO_URL`, `ODOO_DB=logistics_demo`, `ODOO_UID=2`, `ODOO_API_KEY`, `TG_APPROVAL_TOKEN`, `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`.
- **Odoo 18** in Docker (`localhost:8069`), two companies: **SeaLink Ship Spares** (default company, warehouse MNL, products `SP-…` ship spares, contacts = 4 vessels + 2 suppliers) and SunGuard (Project A — do not touch).
- **Odoo call pattern**: HTTP Request POST `{{ $env.ODOO_URL }}/jsonrpc`, onError = continue; a Code node first builds `$json.rpc = { model, method, args, kwargs }`, body
  `{ jsonrpc:'2.0', method:'call', params:{ service:'object', method:'execute_kw', args:[ $env.ODOO_DB, Number($env.ODOO_UID), $env.ODOO_API_KEY, $json.rpc.model, $json.rpc.method, $json.rpc.args, $json.rpc.kwargs || {} ] } }`.
  Always pass `context: { allowed_company_ids: [SEALINK_COMPANY_ID] }`. Read results with `res.result` (may be undefined for void methods).
- Existing credentials: Gmail ("Gmail account"), Google Sheets, Telegram alerts bot ("Telegram account"), ClickUp, Gemini (HTTP to `gemini-3.5-flash-lite`, retry 3× / 5 s, 1 call per 4 s).
- Telegram approval bot: buttons are handled ONLY by workflow **A3b** (polling getUpdates). Do not add a second poller or a Telegram Trigger to that bot (409 conflict). If Project B needs buttons, add new callback prefixes to A3b (e.g. `qsend:` / `qedit:`), like A4 did with `fsend:` / `fedit:`.

## Lessons learned in Project A (avoid these)
1. Google Sheets Update node: after choosing Document/Sheet press ⟳ on "Values to Update", delete extra columns, keep only updated columns, refill `{{ $json.x }}`.
2. Normalise sheet headers in Code nodes: `String(k).trim()`.
3. n8n nodes read some options from item 0 only — build one request per item in a Code node.
4. Always protect against duplicates with a stable reference (here: Zoho Deal ID ↔ Odoo `client_order_ref = 'ZOHO-<deal id>'`).
5. AI can be wrong — anything a customer sees needs my approval.

## What to build
**Step 0 — Zoho CRM free account (guide me step by step).** Pipeline stages for Deals: RFQ Received → Quoted → Won → Delivered on Board (+ Lost). Custom deal fields: Vessel, Port, ETA, ETD, Part Numbers, Odoo_SO. Tell me which Zoho data centre my account uses (.com/.eu/.in/.com.au) because the n8n Zoho OAuth credential depends on it.

**Step 1 — Dummy RFQ emails.** Write 6 realistic RFQ emails from ship superintendents/masters (English, some short and messy like real ones): vessel name, port, ETA/ETD, part numbers matching SeaLink `SP-` items, quantities; include 1 duplicate RFQ and 1 with an unknown part number. I send them to my demo inbox with Gmail label **RFQ**.

**SL1 — RFQ reader → Zoho deal** (Gmail label RFQ, every 5 min)
- Gemini RFQ reader returns JSON: vessel, imo (if any), port, eta, etd, contact name/email, lines [{part_no, description, qty}], urgency, summary. Never invent part numbers; null if missing.
- Duplicate check by email Message-ID / same vessel + same parts within 7 days → add a note instead of a new deal.
- Create Zoho Deal (stage RFQ Received) with the fields above. Telegram alert: `⚓ RFQ — MV <vessel>, <port>, ETD <date>: 3 lines. Zoho deal <id>`.

**SL2 — Stock check in Odoo** (right after SL1, or every 15 min for deals in RFQ Received)
- For each line: Odoo SeaLink stock (`qty_available`). Mark OK / SHORT. Write a stock summary into the Zoho deal; Telegram alert if any SHORT and ETD < 7 days: `⚠️ Short before ETD`.

**SL3 — Won → Odoo Sales Order + Delivery** (every 15 min)
- Zoho deals in stage Won with empty Odoo_SO → find/create the vessel as Odoo partner (SeaLink) → create and **confirm** sale.order with `client_order_ref = 'ZOHO-<deal id>'` (confirm creates the delivery order) → write SO number back to Zoho → Telegram `🚢 Won …`.

**SL4 — Logistics 7 AM check** (daily 07:00 Asia/Manila)
- Open deliveries vs ETD: late-risk if not done and ETD within 2 days → Telegram alert + ClickUp task in list "SeaLink Port Deliveries" (task name `Deliver to MV <vessel> – <port> – ETD <date>`, no duplicates).
- When the Odoo delivery is validated (done) → Zoho stage **Delivered on Board** + note.

**Optional later:** packing list PDF, Looker Studio on-time delivery %.

## How to deliver
1. One plan table (workflows, triggers, what each does, any cost) → wait for my OK.
2. Step 0 Zoho guide → Step 1 RFQ emails → then SL1 … SL4, one at a time, each with test steps.
3. Short README section for GitHub.
