# SunGuard Solar & CCTV — e-commerce automation (demo)

A fictional solar/CCTV shop used to show an order-to-stock chain, step by step.

| Step | Folder | What it shows |
|---|---|---|
| 10 | `10-ecommerce-automation` | Order form → Google Apps Script → Orders sheet → n8n confirmation/inventory logic |
| 10B | `10b-auto-orders` | Automatic order intake and inventory/order confirmation (safe import / dry-run versions) |
| 10C | `10c-ai-sales-agent` | AI chat agent (Gemini + memory) that answers from the live product/inventory sheet |
| 11B | `11b-shopify-to-sheet` | New Shopify order → Orders sheet row → Telegram alert (duplicate-safe) |
| 11C | `11c-shopify-to-odoo` | New Shopify order → confirmed Odoo sales order → stock updated in Odoo → Telegram alert |

`data/` holds the product and opening-stock CSVs. Replace all `YOUR_...` placeholders before running.
