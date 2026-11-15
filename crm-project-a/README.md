# Project A, Phase 1 — SunGuard Odoo CRM (Lead → AI score → Odoo CRM → Telegram → ClickUp)

> **Demo only.** SunGuard Solar & CCTV is a fictional shop and every lead is dummy data. The AI never sends anything to a customer; it only scores and summarises for the sales team.

```
Google Sheet CRM_Leads (Status = Waiting)
  → A1 (every 5 min): Gemini qualifier → spam? → Odoo crm.lead (company SunGuard)
        same email = note on the existing lead · new = lead in stage New with tags + stars
  → sheet row Processed / Error  → Telegram alert for Hot and Warm
Odoo lead moved to Qualified
  → A2 (every 15 min): ClickUp task "Site survey – name – city" (due in 3 days), task ID saved on the lead
  → ClickUp task Complete → lead moves to Proposition + note "Site survey done <date>"
A0 (every 5 min): writes the time to tab Heartbeat (website online/offline later)
```

## Files

| File | What it is |
|---|---|
| `odoo_setup_crm.py` | Step 0: Odoo CRM setup over JSON-RPC. Dry run by default, `--apply` to change. Safe to re-run. |
| `data/crm_leads_seed.csv` | 15 dummy leads (Filipino names, PH cities, English/Taglish; hot, warm, cold, 1 duplicate email, 1 spam) |
| `data/heartbeat_seed.csv` | The `Heartbeat` tab (`Key`, `Last_Run`) |
| `A0_Heartbeat.json` | n8n: heartbeat every 5 min |
| `A1_Lead_Intake_AI_Qualifier.json` | n8n: sheet → Gemini → Odoo → sheet → Telegram |
| `A2_Qualified_to_ClickUp_Site_Survey.json` | n8n: Qualified → ClickUp task; task Complete → Proposition |

Credentials in the exports are placeholders (`YOUR_...`). No API key or password is inside any file.

## Setup

**1. Odoo (once)** — run on the laptop where Odoo runs:
```bash
export ODOO_URL=http://localhost:8069 ODOO_DB=logistics_demo ODOO_USER=admin
export ODOO_API_KEY=...        # Odoo › Preferences › Account Security › New API Key
python3 odoo_setup_crm.py          # dry run: shows what it will change
python3 odoo_setup_crm.py --apply  # makes the changes
```
It installs CRM, creates sales team *SunGuard Sales*, reuses or creates stages New › Qualified › Proposition › Won, lost reasons, tags, UTM source/medium *Website*, the lead fields `x_lead_ref` and `x_clickup_task_id`, sets **1000W Solar Inverter = 2** and **Solar Battery = 1** (low stock for Phase 2), and saves all IDs in the system parameter `sunguard_crm.ids`. It prints `ODOO_UID` at the end.

**2. n8n can reach Odoo without storing the key in a workflow.** In the n8n `docker-compose.yml`, under `environment:` add:
```yaml
      - ODOO_URL=http://host.docker.internal:8069
      - ODOO_DB=logistics_demo
      - ODOO_UID=2                    # from step 1
      - ODOO_API_KEY=${ODOO_API_KEY}  # value lives in the .env file next to docker-compose.yml, never in git
      - N8N_BLOCK_ENV_ACCESS_IN_NODE=false
```
Then `docker compose up -d`. (Any workflow in this n8n can read these variables; fine for a one-person local demo.)

**3. Google Sheet** — in the SunGuard sheet add tab **CRM_Leads** (File › Import › `crm_leads_seed.csv` › *Replace current sheet*) and tab **Heartbeat** (`heartbeat_seed.csv`). The old inquiry tab is not touched.

**4. n8n** — import the three JSON files, then:
- Google Sheets nodes (A0: 1, A1: 2): replace `YOUR_SUNGUARD_SHEET_ID` or pick the sheet from the list.
- A1 *Telegram alert*: your Telegram credential and chat ID.
- A2 ClickUp nodes: create the list **SunGuard Site Surveys** once in ClickUp, then pick team, space and list.
- Each workflow: Settings › Error Workflow › **00 Error alert**.

## How A1 decides

| Case | Result |
|---|---|
| Gemini says `spam: true` | No Odoo lead; row `Status = Error`, `Error = spam` |
| Consent is not `Yes` | No AI call, no lead; `Error = no consent` |
| Same email already in Odoo (SunGuard) | No second lead; a **note** is added to the existing lead |
| Same email twice in one run | Second row waits for the next run, then becomes a note |
| New email | Lead in stage **New**: name `<product> <size> – <city>`, tags (score + products), stars Hot 3 / Warm 2 / Cold 1, source/medium Website, `x_lead_ref = L-000X` |
| Gemini busy (503/429) | 3 retries; if still failing the row stays **Waiting** for the next run |
| AI answer not valid JSON | `Status = Error` (not retried, so not paid twice) |

Max 10 leads per run, 4 s apart (Gemini free-tier friendly). Products and numbers the AI was not sure about are dropped, never guessed.

## Test plan
1. Run **A1** twice (Manual test; 10 leads per run). Expected: 14 rows Processed (13 new Odoo leads + L-0012 merged as a note into L-0003's lead) and L-0014 `Error = spam`; Telegram for Hot/Warm.
2. In Odoo, move 2 SunGuard leads to **Qualified** → run **A2** → 2 ClickUp tasks.
3. Mark 1 task **Complete** → run **A2** → that lead is in **Proposition** with the note "Site survey done …".

## Phase 2 — AI reply, follow-up and Sales Order (human-approved)

| Workflow | Trigger | What it does |
|---|---|---|
| **A3a AI Reply Drafter** | every 5 min | Hot/Warm leads → Odoo stock of the products asked (≤2 = LOW) → Gemini draft (no prices, no dates, no product codes) → sheet `Awaiting approval` → approval bot with ✅ Send / ✏️ Edit |
| **A3b Telegram Approvals** | every 1 min | Single `getUpdates` poller (works on localhost) for replies (`send:`/`edit:`) and follow-ups (`fsend:`/`fedit:`). Send → Gmail demo inbox + Odoo note + sheet `Sent`. Edit → asks for new text → new preview. Never emails twice. |
| **A4 3-Day Follow-up** | every 60 min | Replies sent > 3 days ago (`TEST_DAYS`), no follow-up yet, lead still New/Qualified → Gemini follow-up → approval bot |
| **A5 Won → Sales Order** | every 15 min | Won lead → find/create the customer (fixes the Contact field) → **draft** sale order `CRM-<lead id>` (never duplicated, never auto-confirmed) → Odoo note + 🏆 Telegram alert |

Extra sheet columns: `Reply_Status | Reply_Subject | Reply_Draft | Reply_Sent_At | Followup_Status | Followup_Draft | Followup_Sent_At`. New env var: `TG_APPROVAL_TOKEN` (separate approval bot).

Tested: AI wrongly said "limited stock" for a product with 7 units; the draft was fixed with ✏️ Edit before sending — the reason every customer email needs approval.

## Later phases (not built)
Phase 2: stock check, AI reply drafter with Telegram Send/Edit buttons, 3-day follow-up, Won → Sales Order.
Phase 3: Meralco bill reader (Textract), review sentiment "At risk", Looker Studio dashboard, Maris daily report.
