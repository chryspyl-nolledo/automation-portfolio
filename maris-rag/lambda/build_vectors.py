# Run once in CloudShell (same folder as lambda_function.py) before zipping.
# Adds pre-computed Gemini embeddings to manual.json and about.json so the Lambda
# does not embed every page on each cold start. Key is read from Secrets Manager.
import json
import lambda_function as L
for f in ["manual.json", "about.json"]:
    d = json.load(open(f, encoding="utf-8"))
    pages = [{k: v for k, v in p.items() if k != "vec"} for p in d["pages"]]
    vecs = []
    for i in range(0, len(pages), 90):
        vecs += L.embed([L.doc_text(p) for p in pages[i:i + 90]], "RETRIEVAL_DOCUMENT")
    for p, v in zip(pages, vecs):
        p["vec"] = [round(x, 5) for x in v]
    d["pages"] = pages
    json.dump(d, open(f, "w", encoding="utf-8"), ensure_ascii=False)
    print(f, len(pages), "pages ok")
