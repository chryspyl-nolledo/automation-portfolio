#!/usr/bin/env python3
"""Project A, Step 0: Odoo CRM setup for the SunGuard demo company (JSON-RPC).

Run on the laptop where Odoo runs. Default is a DRY RUN: it only reads and prints
what it would change. Add --apply to make the changes.

    export ODOO_URL=http://localhost:8069
    export ODOO_DB=logistics_demo
    export ODOO_USER=admin            # your Odoo login
    export ODOO_API_KEY=...           # Odoo: Preferences > Account Security > New API Key
    python3 odoo_setup_crm.py          # dry run
    python3 odoo_setup_crm.py --apply  # make the changes

What it does (only creates what is missing; never deletes):
  1. Installs the CRM app (module crm).
  2. Sales team "SunGuard Sales" in company SunGuard.
  3. Pipeline stages New > Qualified > Proposition > Won (reuses existing ones with these names).
  4. Lost reasons: Too expensive, Not ready yet, Bought elsewhere, No response.
  5. Tags: Hot, Warm, Cold, Solar Panel, Inverter, Battery, Hybrid System, CCTV.
  6. UTM source and medium "Website".
  7. Custom lead fields x_lead_ref (sheet Lead_ID) and x_clickup_task_id.
  8. Shows SunGuard stock and sets 2 products LOW (inverter = 2, battery = 1).
  9. Saves all IDs in system parameter "sunguard_crm.ids" for the n8n workflows.
No secrets are stored anywhere; the API key is only read from the environment or prompted.
"""
import getpass
import json
import os
import sys
import urllib.request

APPLY = "--apply" in sys.argv
URL = os.environ.get("ODOO_URL", "http://localhost:8069").rstrip("/") + "/jsonrpc"
DB = os.environ.get("ODOO_DB") or input("Odoo database name: ").strip()
USER = os.environ.get("ODOO_USER") or input("Odoo login (e.g. admin): ").strip()
KEY = os.environ.get("ODOO_API_KEY") or getpass.getpass("Odoo API key (hidden): ")

STAGES = [("New", 1, False), ("Qualified", 2, False), ("Proposition", 3, False), ("Won", 70, True)]
LOST_REASONS = ["Too expensive", "Not ready yet", "Bought elsewhere", "No response"]
TAGS = {"Hot": 1, "Warm": 2, "Cold": 4, "Solar Panel": 3, "Inverter": 5, "Battery": 6, "Hybrid System": 7, "CCTV": 8}
LOW_STOCK = [("Inverter", 2), ("Battery", 1)]   # (name contains, new on-hand qty)
changes = []


def rpc(service, method, *args):
    body = json.dumps({"jsonrpc": "2.0", "method": "call",
                       "params": {"service": service, "method": method, "args": list(args)}}).encode()
    req = urllib.request.Request(URL, body, {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        res = json.load(r)
    if res.get("error"):
        err = res["error"].get("data", {}).get("message") or res["error"].get("message")
        raise SystemExit(f"Odoo error: {err}")
    return res["result"]


uid = rpc("common", "login", DB, USER, KEY)
if not uid:
    raise SystemExit("Login failed: check ODOO_DB, ODOO_USER and ODOO_API_KEY.")
CTX = {}


def x(model, method, args, **kw):
    if CTX:
        kw.setdefault("context", CTX)
    return rpc("object", "execute_kw", DB, uid, KEY, model, method, args, kw)


def ensure(model, domain, vals, label):
    """Return id of an existing record, or create it (only with --apply)."""
    found = x(model, "search", [domain], limit=1)
    if found:
        print(f"  = {label}: already exists (#{found[0]})")
        return found[0]
    changes.append(f"create {label}")
    if not APPLY:
        print(f"  + {label}: WILL CREATE")
        return None
    new_id = x(model, "create", [vals])
    print(f"  + {label}: created (#{new_id})")
    return new_id


print(f"Odoo {URL}  db={DB}  uid={uid}  mode={'APPLY' if APPLY else 'DRY RUN'}\n")

# 1. CRM app
print("1. CRM app")
mod = x("ir.module.module", "search_read", [[["name", "=", "crm"]]], fields=["state"])
if mod and mod[0]["state"] == "installed":
    print("  = crm: installed")
else:
    changes.append("install crm")
    if APPLY:
        x("ir.module.module", "button_immediate_install", [[mod[0]["id"]]])
        print("  + crm: installed now")
    else:
        print("  + crm: WILL INSTALL (run again with --apply; the rest needs CRM installed)")
        print("\nDry run stopped here because CRM is not installed yet.")
        sys.exit(0)

# 2. Company + sales team
print("2. Company and sales team")
comp = x("res.company", "search_read", [[["name", "ilike", "SunGuard"]]], fields=["name"], limit=1)
if not comp:
    raise SystemExit("Company 'SunGuard' not found. Check the company name in Odoo.")
company_id = comp[0]["id"]
print(f"  = company: {comp[0]['name']} (#{company_id})")
CTX = {"allowed_company_ids": [company_id]}
team_id = ensure("crm.team", [["name", "=", "SunGuard Sales"], ["company_id", "=", company_id]],
                 {"name": "SunGuard Sales", "company_id": company_id, "use_opportunities": True},
                 "sales team 'SunGuard Sales'")

# 3. Stages (reuse shared stages with the same name so the pipeline has no duplicates)
print("3. Pipeline stages")
stage_ids = {}
for name, seq, is_won in STAGES:
    dom = [["name", "=", name], "|", ["team_id", "=", False], ["team_id", "=", team_id or 0]]
    stage_ids[name] = ensure("crm.stage", dom, {"name": name, "sequence": seq, "is_won": is_won,
                                                 "team_id": team_id}, f"stage '{name}'")

# 4. Lost reasons
print("4. Lost reasons")
for name in LOST_REASONS:
    ensure("crm.lost.reason", [["name", "=", name]], {"name": name}, f"lost reason '{name}'")

# 5. Tags
print("5. Tags")
tag_ids = {name: ensure("crm.tag", [["name", "=", name]], {"name": name, "color": color}, f"tag '{name}'")
           for name, color in TAGS.items()}

# 6. UTM source / medium
print("6. Source and medium")
source_id = ensure("utm.source", [["name", "=", "Website"]], {"name": "Website"}, "source 'Website'")
medium_id = ensure("utm.medium", [["name", "=", "Website"]], {"name": "Website"}, "medium 'Website'")

# 7. Custom fields on crm.lead
print("7. Custom lead fields")
model_id = x("ir.model", "search", [[["model", "=", "crm.lead"]]])[0]
for fname, label in [("x_lead_ref", "Sheet Lead ID"), ("x_clickup_task_id", "ClickUp Task ID")]:
    ensure("ir.model.fields", [["model_id", "=", model_id], ["name", "=", fname]],
           {"model_id": model_id, "name": fname, "field_description": label, "ttype": "char", "state": "manual"},
           f"field {fname}")

# 8. Stock
print("8. SunGuard stock")
wh = x("stock.warehouse", "search_read", [[["company_id", "=", company_id]]], fields=["name", "lot_stock_id"], limit=1)
if not wh:
    print("  ! no warehouse found for SunGuard; skipped")
else:
    loc_id = wh[0]["lot_stock_id"][0]
    prods = x("product.product", "search_read", [[["company_id", "=", company_id]]],
              fields=["name", "default_code"], order="default_code")
    quants = x("stock.quant", "search_read", [[["location_id", "child_of", loc_id],
                                               ["product_id", "in", [p["id"] for p in prods]]]],
               fields=["product_id", "quantity", "location_id"])
    qty = {}
    for q in quants:
        qty[q["product_id"][0]] = qty.get(q["product_id"][0], 0) + q["quantity"]
    print(f"  warehouse {wh[0]['name']}:")
    for p in prods:
        print(f"    {p.get('default_code') or '':8} {p['name']:28} {qty.get(p['id'], 0):g}")
    for needle, target in LOW_STOCK:
        p = next((p for p in prods if needle.lower() in p["name"].lower()), None)
        if not p:
            print(f"  ! no product with '{needle}' in the name; skipped")
            continue
        now = qty.get(p["id"], 0)
        if now == target:
            print(f"  = {p['name']}: already {target}")
            continue
        changes.append(f"stock {p['name']}: {now:g} -> {target}")
        if not APPLY:
            print(f"  ~ {p['name']}: WILL SET {now:g} -> {target}")
            continue
        ictx = dict(CTX, inventory_mode=True)
        q = x("stock.quant", "search", [[["product_id", "=", p["id"]], ["location_id", "=", loc_id]]], limit=1)
        if q:
            x("stock.quant", "write", [q, {"inventory_quantity": target}], context=ictx)
        else:
            q = [x("stock.quant", "create", [{"product_id": p["id"], "location_id": loc_id,
                                              "inventory_quantity": target}], context=ictx)]
        x("stock.quant", "action_apply_inventory", [q], context=ictx)
        print(f"  ~ {p['name']}: set {now:g} -> {target}")

# 9. Save IDs for n8n
print("9. IDs for n8n")
ids = {"company_id": company_id, "team_id": team_id, "stage_ids": stage_ids, "tag_ids": tag_ids,
       "source_id": source_id, "medium_id": medium_id}
if APPLY:
    x("ir.config_parameter", "set_param", ["sunguard_crm.ids", json.dumps(ids)])
    print("  saved system parameter 'sunguard_crm.ids':")
print("  " + json.dumps(ids))

print(f"\nODOO_UID for n8n = {uid}")
if APPLY:
    print("Done. All changes applied.")
else:
    print(f"Dry run: {len(changes)} change(s) planned. Run again with --apply to make them.")
