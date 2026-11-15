# Handover: Project C — Ship Spares Requisition, Vessel Inspection, Parts Content (built by an AI agent)

Run the agent inside the `automation-portfolio` folder (clone from GitHub first). Read this file before anything else.

## Who I am and how to work with me
I am Chryspyl Nolledo, former Chief Officer (13 years), building an automation portfolio. I have a speech difficulty and work in writing.
- Reply in simple Taglish, short. Show me a plan first and wait for my OK.
- You can create files, run commands and call local APIs yourself. That is the point of this project: "built with an AI agent".
- **Ask me before**: anything that costs money, deploying or deleting AWS resources, changing an existing n8n workflow or Odoo company, `git push`, or anything you cannot undo.
- **Never** print, log, commit or paste API keys, tokens or passwords. Keep them in environment variables or n8n credentials. Before every commit, scan the diff for keys, emails, sheet IDs and chat IDs.
- `git commit` before each big change so I can roll back. Work on a branch `project-c`, never on `main`.
- Do not touch existing workflows (00–13C, A0–A5, SL*) or the SunGuard company. New n8n workflows are named **C1-…, C2-…, C3-…**
- Dummy data only (fictional vessels, suppliers, parts). Nothing is sent to real people; emails go to my demo inbox.
- At the end of each part show me the result (what was built, what was tested, screenshots), not every step.

## My setup (Windows PC)
- **n8n** in Docker (`localhost:5678`), container `n8n`, data volume `n8n_data`. Env vars already set: `ODOO_URL`, `ODOO_DB=logistics_demo`, `ODOO_UID=2`, `ODOO_API_KEY`, `TG_APPROVAL_TOKEN`, `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`. If you need the n8n REST API, ask me to create an n8n API key.
- **Odoo 18 Community** in Docker (`localhost:8069`, containers `odoo-demo-odoo-1`, `odoo-demo-db-1`), login `admin`. Companies: **SeaLink Ship Spares** (use this one; warehouse MNL, products `SP-…`, 4 vessels + 2 suppliers as contacts) and SunGuard (do not touch). Installed apps: Sales, Inventory, Invoicing, CRM. **Purchase** and **Maintenance** are not installed yet — ask me before installing.
- Odoo JSON-RPC pattern and lessons: see `crm-project-a/README.md` and `crm-project-a/HANDOVER.md` (always pass `allowed_company_ids`; `res.result` may be undefined for void methods).
- **Telegram**: alerts bot (n8n credential "Telegram account"); approval bot buttons are handled only by workflow **A3b** (getUpdates polling). Do not add a second poller; add new callback prefixes to A3b (e.g. `rqok:` / `rqno:`) if you need buttons.
- **AWS** (region `ap-southeast-1`, $5 budget alarm, account concurrency limit 10). Website on S3 bucket `chryspylwebsiteporrfoliodemo` behind CloudFront. Pattern to copy: `maritime-incident/13c-aws-intake/` (Lambda Function URL + CORS + `ENABLE_PUBLIC_API` switch + private S3). Check that AWS CLI is configured; never create EC2, RDS, NAT Gateway or load balancers.
- **Gemini**: n8n credential "Google Gemini(PaLM) Api account", model `gemini-3.5-flash-lite`, retry 3× / 5 s, 1 call per 4 s.

## What to build (in this order)

### C1 — Ship Spare Parts Requisition → Odoo Purchase (main project, serverless)
Replaces planned "AWS #10 EC2 web server" with a serverless design.
1. **Requisition form** (static page on the portfolio CloudFront, like `13c-demo.html`): vessel, department (deck/engine), PMS job or reason, parts (part no., description, qty, urgency), required port/date. Only preset demo vessels and `SP-` parts.
2. **Lambda Function URL** → validates → **DynamoDB** table `ship-requisitions` (status `Submitted`). Kill switch `ENABLE_PUBLIC_API`, CORS limited to the site, max 20 requisitions per day.
3. **n8n C1** polls new requisitions → Telegram approval (Superintendent): ✅ Approve / ❌ Reject (through A3b).
4. Approved → **Odoo Purchase** (install after my OK): RFQs to 2–3 demo suppliers in SeaLink (one is SeaLink's own stock check first: if in stock, reserve instead of buying).
5. Demo supplier quotes (fixed sample prices / lead times) → **AI quote comparison** (price, lead time, OEM vs generic, meets required date) → recommendation + Telegram approval → confirm the chosen **Purchase Order**, cancel the others.
6. Status back to DynamoDB; the form page can show requisition status by ID.

### C2 — Digital Vessel Inspection (iAuditor-style)
Pre-arrival / pre-loading checklist page (lifesaving, firefighting, mooring, cargo hold items; pass/fail/NA + optional photo to private S3) → Lambda → n8n → failed items become **Odoo Maintenance** work orders (install after my OK) → AI writes a short summary for the Master → Telegram. A failed item that needs spares creates a **C1 requisition** automatically.

### C3 — Machinery Parts Content Generator
Spec sheet (CSV of SeaLink `SP-` parts: name, maker, part no., specs) → Gemini writes an SEO product description + 3 Q&A per part → Google Sheet for **human review** (Approved column) → approved rows update the Odoo product description. Never invent specifications; flag missing data.

## Deliverables for each part
- Working demo, tested end to end, with 4–6 cropped screenshots (no URL bars, emails or IDs).
- Sanitized exports in `project-c/` (n8n JSON with `YOUR_...` placeholders, Lambda code, page HTML) + README (flow, safety and cost controls, setup).
- A short "How an AI agent built this" note: what I asked, what the agent did, what I checked.
- Cost: tell me the expected monthly cost; keep it near $0 (free tiers).
