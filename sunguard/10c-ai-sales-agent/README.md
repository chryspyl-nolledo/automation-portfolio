# 10C — SunGuard AI sales agent

**Flow:** When chat message received → **SunGuard AI Agent** (Google Gemini chat model + Simple Memory) with an `inventory` tool that reads the product/inventory Google Sheet.

The agent answers product and stock questions from live sheet data instead of guessing. Connect a Google Gemini (PaLM) API credential and your own sheet (`YOUR_GOOGLE_SHEET_ID`).
