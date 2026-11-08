# n8n Automation Portfolio

Workflow automations built with **n8n** by Chryspyl Nolledo — a Master Mariner moving into remote, written-communication work (operations, documentation, automation).

> **All data is dummy/demo data.** Company, vessel, customer and product names are fictional. Credentials, chat IDs, Sheet IDs and e-mail addresses have been removed — import a workflow, connect your own credentials, and replace the `YOUR_...` placeholders.

## Projects

| Folder | What it does | Stack |
|---|---|---|
| [`fleet-ops/`](fleet-ops) | Maritime fleet operations: PMS due/overdue e-mail reminders, daily fleet alerts, error alerts, customer inquiry form, change-request e-mail → AWS | n8n, Google Sheets, Gmail, Telegram |
| [`sunguard/`](sunguard) | **SunGuard Solar & CCTV (demo)** e-commerce chain: order form → Sheet → AI sales agent → Shopify → Sheet → **Odoo** | n8n, Google Sheets, Apps Script, Shopify, Gemini, Odoo, Telegram |
| [`sealink/`](sealink) | **SeaLink Ship Spares (demo)**: Odoo inventory → daily logistics brief on Telegram | n8n, Odoo 18, Telegram |

## Highlights

- **Shopify → n8n → Odoo (11C):** a Shopify order becomes a confirmed Odoo sales order in the SunGuard company, stock reserved/deducted in Odoo. Duplicate-safe (`SHOPIFY-<order no>` reference).
- **Odoo → n8n → Telegram (12):** every morning, a brief of delivery shortages, upcoming deliveries/receipts and low-stock spare parts.
- **AI sales agent (10C):** Gemini-powered chat agent that answers from live inventory.
- **Safe-by-default:** workflows are exported inactive, with placeholder credentials; the Odoo workflows use a Config node for URL/DB/API key.

## How to import a workflow

1. n8n → **Workflows → Import from file** → choose a `.json`.
2. Open each node that shows a credential warning and select your own credential.
3. Replace placeholders: `YOUR_GOOGLE_SHEET_ID`, `YOUR_TELEGRAM_CHAT_ID`, `YOUR-STORE.myshopify.com`, `PASTE_YOUR_ODOO_API_KEY_HERE`.
4. Run **Manual test** first, then activate.

## Odoo demo setup (for `sunguard/11c` and `sealink/12`)

Odoo 18 Community + PostgreSQL 16 in Docker (`docker compose up -d`, port 8069), apps: Inventory, Sales, Contacts. Two companies (SeaLink Ship Spares, SunGuard Solar & CCTV). Sample CSVs for products, opening stock and contacts are in each `data/` folder. n8n reaches Odoo at `http://host.docker.internal:8069` using an Odoo API key.
