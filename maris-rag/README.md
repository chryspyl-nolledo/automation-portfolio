# Project 14 · Vessel Safety Manual Assistant with Maris (RAG demo)

Ask a question about a ship's safety manual in **English or Taglish** and get a short answer that cites the manual page, spoken by **Maris**, an AI assistant avatar. The same Maris also answers visitors' questions about the portfolio site.

> **Demo only.** MV Horizon Star is a fictional bulk carrier and the manual is a 10-page dummy. Not for real operations; follow the official procedure and the Master's instructions. AI answers can be wrong.

**Live demo:** https://d123alnn5vo5uv.cloudfront.net/demo-14.html

## How it works

```
Question (EN / Taglish)
   → Lambda Function URL (CORS: portfolio site only, max 300 characters)
   → expand short forms (SSP, LSA, EPIRB, PTW ...)
   → Gemini embeddings → find the closest manual pages
   → Gemini Flash-Lite answers ONLY from those pages, with the page number
   → Amazon Polly (Neural, Salli) reads the answer
   → page plays Maris's clip for the mood + the voice
```

- **Grounded:** the prompt allows answers only from the retrieved pages. If the answer is not there, Maris says "not in the manual" instead of guessing (try "How do I cook adobo?").
- **Language:** English question → English answer; Tagalog or Taglish question → Taglish answer.
- **Two modes, one Lambda:** `mode: "manual"` uses `manual.json`; `mode: "about"` uses `about.json` (portfolio notes, one entry per project card) and gives a small boost to the page the visitor is on.

## How Maris was made

**MARIS** = Maintenance, Automation, Reporting, Intelligence & Safety.

- Her look was created with **Gemini AI**; her short video clips were made in **Google Flow**.
- Six expressions were chosen: neutral, thinking, smile, confident, serious, apologetic.
- The clips were trimmed and compressed into small silent loops (about 1 MB in total, 640 px) so pages load fast. The voice comes separately from **Amazon Polly**.
- The page picks her expression automatically: *thinking* while searching, *serious* for safety topics (fire, enclosed space, abandon ship ...), *smile/confident* for a found answer, *apologetic* when the answer is not in the manual.
- Not yet: lip-sync (mouth matching the words) is planned for a later version.

## Folder

| Path | What it is |
|---|---|
| `lambda/lambda_function.py` | Python 3.12 Lambda: retrieval, Gemini answer, Polly voice |
| `lambda/manual.json` | The dummy 10-page safety manual, one entry per page |
| `lambda/about.json` | Portfolio notes for the site-wide Maris chat |
| `web/demo-14.html` | Manual assistant page with Maris video and sound on/off |
| `web/chatbot.js` | Site chat widget: Maris tab, greeting pop-up, page-aware questions |
| `web/maris/` | Maris expression clips and poster image |
| `setup.sh` | One-time setup in AWS CloudShell |

## Safety and cost guards

- Gemini API key stored in **AWS Secrets Manager** only; never in the website or this repo.
- IAM role allows only reading that one secret, Polly `SynthesizeSpeech` and basic logs.
- CORS limited to the portfolio domain; questions capped at 300 characters.
- **$5/month budget alarm**.
- Known limit: no daily question cap yet (reserved concurrency was not available on a new account).

## Setup (AWS CloudShell, ap-southeast-1)

1. Get a Gemini API key from Google AI Studio.
2. Upload this folder and run `bash setup.sh`. It asks for a budget-alert email, the key (hidden while typing) and your website origin, then prints the Function URL.
3. Put the Function URL in `web/demo-14.html` and `web/chatbot.js` in place of `YOUR_FUNCTION_URL`, then upload `web/` to your S3 site and invalidate CloudFront.

Built by Chryspyl Nolledo, Master Mariner, with AI assistance (Claude), checked and tested by hand.
