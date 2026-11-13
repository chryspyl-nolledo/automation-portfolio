import json, os, re, math, base64, urllib.request, urllib.error, boto3

SECRET_ID = os.environ.get("SECRET_ID", "gemini-api-key")
EMBED_MODEL = os.environ.get("EMBED_MODEL", "gemini-embedding-001")
GEN_MODEL = os.environ.get("GEN_MODEL", "gemini-3.5-flash-lite")
DIM = 768
TOP_K = 3
MAX_Q = 300
MAX_SPEAK = 900
BASE = "https://generativelanguage.googleapis.com/v1beta/models/"

_key = None
_index = {}  # mode -> list of (page dict, vector)

def get_key():
    global _key
    if _key is None:
        s = boto3.client("secretsmanager").get_secret_value(SecretId=SECRET_ID)["SecretString"]
        try:
            _key = json.loads(s)["GEMINI_API_KEY"]
        except Exception:
            _key = s.strip()
    return _key

def call(path, payload):
    req = urllib.request.Request(BASE + path, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": get_key()})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError("Gemini %s: %s" % (e.code, e.read().decode()[:300]))

def norm(v):
    n = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / n for x in v]

def embed(texts, task):
    reqs = [{"model": "models/" + EMBED_MODEL, "content": {"parts": [{"text": t}]},
             "taskType": task, "outputDimensionality": DIM} for t in texts]
    out = call(EMBED_MODEL + ":batchEmbedContents", {"requests": reqs})
    return [norm(e["values"]) for e in out["embeddings"]]

FILES = {"manual": "manual.json", "about": "about.json"}

def doc_text(p):
    return "%s (Page %d)\n%s" % (p["section"], p["page"], p["text"])

def load_index(mode):
    if mode not in _index:
        with open(os.path.join(os.path.dirname(__file__), FILES[mode])) as f:
            pages = json.load(f)["pages"]
        if all("vec" in p for p in pages):          # pre-built by build_vectors.py (fast cold start)
            vecs = [p.pop("vec") for p in pages]
        else:
            texts = [doc_text(p) for p in pages]
            vecs = embed(texts, "RETRIEVAL_DOCUMENT")
        _index[mode] = list(zip(pages, vecs))
    return _index[mode]

TL_WORDS = {"ano","paano","bakit","sino","saan","kailan","ilan","ang","ng","mga","sa","ba","po","ko","mo","natin","ito","iyan","yung","kung","may","wala","dapat","gagawin","bawal","pag","kapag","naman","lang","din","rin","ako","ikaw","siya"}

def is_tagalog(q):
    words = [w.strip("?.!,").lower() for w in q.split()]
    return sum(w in TL_WORDS for w in words) >= 1

GLOSSARY = {"ssp": "Ship Security Plan", "sso": "Ship Security Officer", "sms": "Safety Management System",
            "lsa": "Life-Saving Appliances", "ffe": "Fire-Fighting Equipment", "epirb": "Emergency Position-Indicating Radio Beacon",
            "sart": "Search and Rescue Transponder", "isps": "International Ship and Port Facility Security Code",
            "ppe": "Personal Protective Equipment", "mob": "Man Overboard", "ptw": "Permit to Work"}
POLLY_VOICE = os.environ.get("POLLY_VOICE", "Salli")
POLLY_REGION = os.environ.get("POLLY_REGION", "ap-southeast-1")

def expand(q):
    extra = [GLOSSARY[w] for w in re.findall(r"[a-z]+", q.lower()) if w in GLOSSARY]
    return q + (" (" + "; ".join(extra) + ")" if extra else "")

def speak(text):
    try:
        clean = re.sub(r"\[Pages? ([^\]]+)\]", r"(page \1)", text)[:1500]
        polly = boto3.client("polly", region_name=POLLY_REGION)
        r = polly.synthesize_speech(Text=clean, OutputFormat="mp3", VoiceId=POLLY_VOICE, Engine=os.environ.get("POLLY_ENGINE", "neural"))
        return base64.b64encode(r["AudioStream"].read()).decode()
    except Exception as e:
        print("POLLY", e)
        return None

LANG = ("Reply in the same language as the question: English question gets an English answer; Tagalog or Taglish question gets a Taglish answer. "
        "Plain text only, no markdown, and do not mention the words excerpts or notes. ")

PAGE_NAMES = {"ai": "AI Projects", "automation": "Workflow Automation", "business": "Business Apps", "aws": "AWS Projects", "data": "Data & Dashboards"}

def answer(question, mode="manual", page="", voice=True):
    index = load_index(mode)
    q2 = expand(question)
    if mode == "about" and page in PAGE_NAMES:
        q2 += " (visitor is on the %s page)" % PAGE_NAMES[page]
    qv = embed([q2], "RETRIEVAL_QUERY")[0]
    k = 5 if mode == "about" else TOP_K
    def score(p, v):
        s = sum(a * b for a, b in zip(qv, v))
        return s + (0.03 if mode == "about" and p.get("tab") == page else 0)
    scored = sorted(((score(p, v), p) for p, v in index), key=lambda x: -x[0])[:k]
    ctx = "\n\n".join("[Page %d - %s]\n%s" % (p["page"], p["section"], p["text"]) for _, p in scored)
    if mode == "about":
        prompt = ("You are Maris, the friendly AI assistant on Chryspyl Nolledo's portfolio website. Talk about him in the third person. "
                  "Answer ONLY from the notes below, in 1 to 4 short sentences. Never give a phone number or email. " + LANG +
                  "Greetings like hi or hello: greet back and offer to tell about his experience, skills or projects. "
                  "If the answer is not in the notes, reply exactly: NOT_IN_MANUAL\n\n"
                  "NOTES:\n" + ctx + "\n\nQUESTION: " + q2)
    else:
        prompt = ("You are the safety assistant for MV Horizon Star (a fictional DEMO geared bulk carrier). Answer ONLY from the manual excerpts below. "
                  "Be concise and cite pages like [Page 5]. " + LANG +
                  "If the answer is not in the excerpts, reply exactly: NOT_IN_MANUAL\n\n"
                  "EXCERPTS:\n" + ctx + "\n\nQUESTION: " + q2)
    out = call(GEN_MODEL + ":generateContent", {"contents": [{"parts": [{"text": prompt}]}],
                                                "generationConfig": {"temperature": 0.1, "maxOutputTokens": 600}})
    text = out["candidates"][0]["content"]["parts"][0]["text"].strip()
    if "NOT_IN_MANUAL" in text:
        tl = is_tagalog(question)
        if mode == "about":
            msg = ("Pasensya na, wala akong impormasyon tungkol diyan. Puwede mo akong tanungin tungkol sa karanasan, skills o projects ni Chryspyl." if tl
                   else "Sorry, I don't have that information. You can ask me about Chryspyl's experience, skills or projects.")
        elif tl:
            msg = "Hindi ko makita ang sagot na iyan sa manual ng MV Horizon Star (demo). Subukan mong itanong sa Chief Officer o sa Master."
        else:
            msg = "I could not find that in the MV Horizon Star safety manual (demo). Please ask the Chief Officer or the Master."
        return {"answer": msg, "sources": [], "found": False, "audio": speak(msg) if voice else None}
    return {"answer": text, "found": True, "audio": speak(text) if voice else None,
            "sources": [{"page": p["page"], "section": p["section"], "score": round(s, 3)} for s, p in scored]}

def handler(event, context):
    try:
        body = json.loads(event.get("body") or "{}")
        if body.get("speak"):                       # second call: voice for an answer already shown
            t = str(body["speak"])[:MAX_SPEAK]
            return resp(200, {"audio": speak(t)})
        q = str(body.get("question", "")).strip()
        if not q:
            return resp(400, {"error": "Walang tanong."})
        if len(q) > MAX_Q:
            return resp(400, {"error": "Masyadong mahaba ang tanong (max %d characters)." % MAX_Q})
        mode = "about" if body.get("mode") == "about" else "manual"
        page = str(body.get("page", ""))[:20]
        return resp(200, answer(q, mode, page, body.get("voice", True) is not False))
    except Exception as e:
        print("ERROR", e)
        return resp(500, {"error": "May error sa server. Subukan ulit mamaya."})

def resp(code, obj):
    return {"statusCode": code, "headers": {"Content-Type": "application/json"}, "body": json.dumps(obj)}
