# Fleet Ops automations (maritime, dummy data)

Small n8n workflows based on real shipboard/office routines — PMS, vessel status and customer requests. All data is fictional.

| Workflow | Trigger | What it does |
|---|---|---|
| `00-error-alert` | Error Trigger | Sends an alert when any other workflow fails |
| `02-pms-reminder` | Daily 7 AM | Reads a fleet PMS sheet, computes days left, e-mails the Superintendent for **overdue** jobs and the Chief Officer for **due soon** |
| `03-customer-inquiry-form` | n8n Form | Saves the inquiry to a Google Sheet and sends a Telegram message |
| `04-sample-alert-signup` | Every 15 min | Reads pending sample-alert sign-ups, sends a sample alert, marks it sent |
| `05-daily-fleet-alert` | Daily | Checks RightShip, hull and off-hire sheets against rules and e-mails a Fleet Ops summary only when there are alerts |
| `06-change-request-to-aws` | Gmail Trigger | Stores an e-mailed change request in AWS and replies to the sender |

Setup: connect Google Sheets / Gmail / Telegram credentials, then point the sheet nodes to your own copy of the data.
