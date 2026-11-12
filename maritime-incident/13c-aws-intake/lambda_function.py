import base64
import json
import re
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

BUCKET = "YOUR_S3_BUCKET"
PREFIX = "maritime-incident-demo"
ALLOWED_ORIGIN = "https://YOUR_CLOUDFRONT_DOMAIN"

# SAFETY SWITCH: keep False until YOU decide to open the website API.
# While False, only private console tests work; HTTP calls get 403.
ENABLE_PUBLIC_API = False

s3 = boto3.client("s3")

VALID_PHOTOS = {f"PHOTO_{number:02d}" for number in range(1, 9)}
REQUEST_ID_RX = re.compile(r"^(\d{4}-\d{2}-\d{2})-(PHOTO_0[1-8])$")
MAX_BODY_BYTES = 512
MAX_RESULT_BYTES = 20000

# Only these result fields are returned to the website.
RESULT_FIELDS = (
    "request_id", "photo_id", "status", "case_title", "location",
    "report_type", "crew_description", "photo_url", "produced_at",
    "produced_by", "officer_approved", "demo_notice", "draft",
)


def response(status_code, data):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json", "Cache-Control": "no-store"},
        "body": json.dumps(data),
    }


def create_request(photo_id, source):
    if not isinstance(photo_id, str) or photo_id not in VALID_PHOTOS:
        return response(400, {"error": "Select PHOTO_01 through PHOTO_08"})

    now = datetime.now(timezone.utc)
    day = now.strftime("%Y-%m-%d")
    request_id = f"{day}-{photo_id}"
    key = f"{PREFIX}/requests/{day}/{photo_id}.json"

    request_data = {
        "request_id": request_id,
        "photo_id": photo_id,
        "status": "pending",
        "source": source,
        "sample_data": True,
        "created_at": now.isoformat(),
    }

    try:
        s3.put_object(
            Bucket=BUCKET,
            Key=key,
            Body=json.dumps(request_data).encode("utf-8"),
            ContentType="application/json",
            IfNoneMatch="*",  # one request per photo per UTC day
        )
    except ClientError as error:
        code = error.response.get("Error", {}).get("Code", "")
        if code in ("PreconditionFailed", "412"):
            return response(409, {
                "message": "This photo is already queued today",
                "request_id": request_id,
            })
        print("S3 request write failed:", code)
        return response(500, {"error": "Unable to save request"})

    return response(202, {
        "message": "Demo request accepted",
        "request_id": request_id,
        "photo_id": photo_id,
        "status": "pending",
    })


def read_json(key):
    """Return parsed JSON, or None if the object does not exist."""
    try:
        obj = s3.get_object(Bucket=BUCKET, Key=key)
    except ClientError as error:
        code = error.response.get("Error", {}).get("Code", "")
        if code in ("NoSuchKey", "404"):
            return None
        if code in ("AccessDenied", "403"):
            # Without s3:ListBucket, S3 answers 403 for a missing key.
            print("S3 read denied or missing:", key)
            return None
        raise
    if obj.get("ContentLength", 0) > MAX_RESULT_BYTES:
        print("S3 object too large:", key)
        return None
    return json.loads(obj["Body"].read().decode("utf-8"))


def get_status(request_id):
    match = REQUEST_ID_RX.match(request_id) if isinstance(request_id, str) else None
    if not match:
        return response(400, {"error": "Invalid request_id"})
    day, photo_id = match.groups()

    result = read_json(f"{PREFIX}/results/{day}/{photo_id}.json")
    if result is not None:
        return response(200, {
            "status": "ready",
            "request_id": request_id,
            "result": {k: result.get(k) for k in RESULT_FIELDS},
        })

    if read_json(f"{PREFIX}/requests/{day}/{photo_id}.json") is not None:
        return response(200, {
            "status": "pending",
            "request_id": request_id,
            "message": "Queued. The AI draft is created when the demo n8n service is online.",
        })

    return response(404, {"status": "not_found", "request_id": request_id})


def lambda_handler(event, context):
    if not isinstance(event, dict):
        return response(400, {"error": "Invalid request"})

    is_http = any(field in event for field in ("requestContext", "headers", "body"))

    # Private console tests: {"photo_id": "PHOTO_03"} or {"request_id": "2026-11-12-PHOTO_02"}
    if not is_http:
        if "request_id" in event:
            return get_status(event.get("request_id"))
        return create_request(event.get("photo_id"), "private_test")

    if not ENABLE_PUBLIC_API:
        return response(403, {"error": "Public API is not enabled yet"})

    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    origin = headers.get("origin")
    if origin and origin != ALLOWED_ORIGIN:
        return response(403, {"error": "Origin not allowed"})

    method = ((event.get("requestContext") or {}).get("http") or {}).get("method", "")

    if method == "POST":
        body = event.get("body") or ""
        try:
            if event.get("isBase64Encoded"):
                body = base64.b64decode(body).decode("utf-8")
            if len(body.encode("utf-8")) > MAX_BODY_BYTES:
                return response(400, {"error": "Request too large"})
            data = json.loads(body)
        except (ValueError, UnicodeDecodeError):
            return response(400, {"error": "Invalid JSON"})
        if not isinstance(data, dict):
            return response(400, {"error": "Invalid JSON"})
        return create_request(data.get("photo_id"), "website")

    if method == "GET":
        params = event.get("queryStringParameters") or {}
        return get_status(params.get("request_id"))

    return response(405, {"error": "Method not allowed"})
