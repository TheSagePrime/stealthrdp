#!/usr/bin/env python3
"""Deterministic publish-package validator (SEO workflow v2).

The remote headless publisher MUST run this before any publish and publish
NOTHING when it exits 1. The publisher owns deterministic checks only;
editorial/AI judgment stays outside this gate.

Usage:
    python3 validate_publish_package.py --package <path.json> [--publish-root DIR]

Exit 0 = publishable, exit 1 = not publishable (clear reason printed).

Hardening (post-adversarial-audit, PUB-1..13):
  * body_words is never trusted: the visible word count is MEASURED from
    body_html/body_text (tags stripped, whitespace normalised) and the caller's
    number is only a cross-check (tolerance = max(2 words, 2% of measured)).
  * published_path must be a safe relative slug path and must resolve inside
    --publish-root (default /srv/publish) after symlink resolution.
  * cta_paths must match ^/(?!/) with no backslash; every inspected value is
    percent-decoded and control-stripped BEFORE substring checks.
  * IP scan covers IPv6 and hex/octal/short forms (ipaddress-validated).
  * Script/event-handler/dangerous-tag detection survives control-char splits.
  * Explicit length caps for every string field (see MAX_LENGTHS).
  * NUL / C0 / bidi / zero-width characters are rejected (except \t \n \r,
    which are normalised away before scanning).
  * Duplicate JSON keys are rejected at load time; JSON-LD @graph is limited
    to one typed node per block; canonical_url must not embed credentials.

Length caps chosen: title 160, meta_description 320, slug 80,
published_path 256, cta_paths 256 per entry, canonical_url 2048,
content_hash 256, author/human_signoff fields 512 per field,
schema_jsonld strings 4096, body_text/body_html 200000, any other
string 2048.

Stdlib only, Python 3.13.
"""

from __future__ import annotations

import argparse
import html
import ipaddress
import json
import re
import sys
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

MIN_BODY_WORDS = 320
DEFAULT_PUBLISH_ROOT = "/srv/publish"

# PUB-1 cross-check tolerance: measured vs caller-asserted body_words.
BODY_WORDS_TOLERANCE_MIN = 2          # words
BODY_WORDS_TOLERANCE_PCT = 0.02       # 2% of the measured count

# PUB-8 length caps (characters).
MAX_LENGTHS = {
    "slug": 80,
    "title": 160,
    "meta_description": 320,
    "canonical_url": 2048,
    "published_path": 256,
    "content_hash": 256,
    "cta_paths": 256,
    "body_text": 200_000,
    "body_html": 200_000,
    "author": 512,
    "human_signoff": 512,
    "schema_jsonld": 4096,
}
MAX_GENERIC_STRING = 2048

# PUB-9: C0 controls except \t \n \r, plus DEL. \t \n \r are normalised away.
CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
ANY_CONTROL_RE = re.compile(r"[\x00-\x1f\x7f]")
INVISIBLE_RE = re.compile(r"[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]")
NBSP_RE = re.compile(r"[\u00a0\u2007\u202f]")

# PUB-5: dotted-quad, short/odd forms, hex/octal obfuscation.
IPV4_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
SHORT_IP_RE = re.compile(r"\b\d{1,3}(?:\.\d{1,3}){1,2}\b")
HEXOCT_IP_RE = re.compile(
    r"\b(?:0[xX][0-9a-fA-F]+|0[0-7]{1,3}|\d{1,3})"
    r"(?:\.(?:0[xX][0-9a-fA-F]+|0[0-7]{1,3}|\d{1,3})){1,3}\b"
)
HEXOCT_PART_RE = re.compile(r"0[xX]|0[0-7]")
IPV6_CAND_RE = re.compile(r"[0-9a-fA-F:]+")

# PUB-7: host tokens, case-insensitive.
HOST_TOKEN_RE = re.compile(r"__[A-Z][A-Z0-9_]*__", re.IGNORECASE)

# PUB-6: dangerous tags + event-handler attributes.
DANGEROUS_TAG_RE = re.compile(
    r"<\s*/?\s*(?:script|iframe|object|embed|math)\b", re.IGNORECASE
)
EVENT_HANDLER_RE = re.compile(r"\bon[a-z]+\s*=", re.IGNORECASE)
SVG_TAG_RE = re.compile(r"<\s*/?\s*svg\b", re.IGNORECASE)

# PUB-10: placeholder lexicon (extended).
PLACEHOLDER_RES = (
    re.compile(r"lorem\s+ipsum", re.IGNORECASE),
    re.compile(r"\bTODO\b"),
    re.compile(r"\bTBD\b"),
    re.compile(r"\b(?:tbc|fixme|tktk|xx+)\b", re.IGNORECASE),
    re.compile(r"\bcoming\s+soon\b", re.IGNORECASE),
    re.compile(r"[\[\(]\s*(?:add|insert|update|write)\b", re.IGNORECASE),
    re.compile(r"\binsert\s+(?:here|keyword|hero|text|copy)\b", re.IGNORECASE),
    re.compile(r"\[\s*insert", re.IGNORECASE),
    re.compile(r"x{5,}", re.IGNORECASE),
)

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
PUBLISHED_SEGMENT_RE = re.compile(r"^[A-Za-z0-9._-]+$")
INTERNAL_HOST_MARKERS = (
    "localhost",
    ".local",
    ".internal",
    ".lan",
    ".home.arpa",
    ".localdomain",
)
CTA_FORBIDDEN = ("http://", "https://", "javascript:", "data:", "vbscript:", "..")
CTA_SCHEME_RE = re.compile(r"[a-zA-Z][a-zA-Z0-9+.\-]*:")
CTA_ROOT_RE = re.compile(r"^/(?!/)")

REQUIRED_FIELDS = (
    "slug",
    "title",
    "meta_description",
    "canonical_url",
    "author",
    "content_hash",
    "cta_paths",
    "published_path",
    "body_words",
)
AUTHOR_FIELDS = ("name", "url", "person_id")
SIGNOFF_FIELDS = ("name", "datetime", "scope")


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def _iter_strings(node, path="$"):
    """Yield (path, string) for every string in a JSON structure."""
    if isinstance(node, str):
        yield path, node
    elif isinstance(node, dict):
        for key, value in node.items():
            yield from _iter_strings(value, f"{path}.{key}")
    elif isinstance(node, list):
        for index, value in enumerate(node):
            yield from _iter_strings(value, f"{path}[{index}]")


def _non_empty_string(value) -> bool:
    return isinstance(value, str) and value.strip() != ""


def _percent_decode(text: str) -> str:
    """PUB-4: decode percent-encoding (repeat until stable, bounded)."""
    current = text
    for _ in range(3):
        decoded = urllib.parse.unquote(current)
        if decoded == current:
            break
        current = decoded
    return current


def _normalise_for_scan(text: str) -> str:
    """PUB-4/9: percent-decode, NBSP-normalise, strip all control characters.

    Every substring/regex check below runs on this normalised form so that
    percent-encoding and \t\r\n\x00 splitting cannot smuggle anything past.
    """
    decoded = _percent_decode(text)
    decoded = NBSP_RE.sub(" ", decoded)
    return ANY_CONTROL_RE.sub("", decoded)


def _reject_duplicate_keys(pairs):
    """PUB-12: json object_pairs_hook that refuses duplicate keys."""
    seen = set()
    for key, _ in pairs:
        if key in seen:
            raise ValueError(f"duplicate JSON key: {key!r}")
        seen.add(key)
    return dict(pairs)


def _find_ip(text):
    """PUB-5: return (kind, token) for IPv4/IPv6/hex-octal/short-form IPs."""
    for match in IPV4_RE.finditer(text):
        token = match.group(0)
        try:
            if ipaddress.ip_address(token).version == 4:
                return "raw IPv4", token
        except ValueError:
            pass  # not a real dotted quad; short/hex patterns below may still hit
    for match in HEXOCT_IP_RE.finditer(text):
        token = match.group(0)
        if HEXOCT_PART_RE.search(token):
            return "hex/octal-obfuscated IP", token
    for match in SHORT_IP_RE.finditer(text):
        token = match.group(0)
        # 2- or 3-part dotted decimal ("127.1", "127.0.1"): IP shorthand.
        # Fail-safe: version-number lookalikes are rejected too.
        return "short-form IP", token
    for match in IPV6_CAND_RE.finditer(text):
        token = match.group(0)
        if ":" not in token or not re.search(r"[0-9a-fA-F]", token):
            continue
        try:
            if ipaddress.ip_address(token).version == 6:
                return "IPv6", token
        except ValueError:
            continue
    return None


def _measure_visible_words(data):
    """PUB-1: measure the visible body word count. Never trust body_words."""
    body_html = data.get("body_html")
    body_text = data.get("body_text")
    if isinstance(body_html, str) and body_html.strip():
        text = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", body_html)
        text = re.sub(r"(?s)<[^>]+>", " ", text)
        text = html.unescape(text)
    elif isinstance(body_text, str) and body_text.strip():
        text = re.sub(r"(?s)<[^>]+>", " ", body_text)
        text = html.unescape(text)
    else:
        return None
    text = NBSP_RE.sub(" ", text)
    text = ANY_CONTROL_RE.sub(" ", text)
    return len(text.split())


# --------------------------------------------------------------------------
# checks
# --------------------------------------------------------------------------

def _check_human_signoff(data):
    """P0 gate: human_signoff {name, datetime, scope}, all non-empty strings."""
    signoff = data.get("human_signoff")
    if signoff is None:
        return False, "human_signoff missing (P0 gate: publisher refuses the package)"
    if not isinstance(signoff, dict):
        return False, "human_signoff must be an object with {name, datetime, scope}"
    bad = [f for f in SIGNOFF_FIELDS if not _non_empty_string(signoff.get(f))]
    if bad:
        return False, f"human_signoff has empty or missing field(s): {', '.join(bad)}"
    return True, "human_signoff {name, datetime, scope} present and non-empty"


def _check_signoff_datetime(data):
    signoff = data.get("human_signoff")
    if not isinstance(signoff, dict):
        return False, "human_signoff.datetime uncheckable (human_signoff missing)"
    raw = signoff.get("datetime")
    if not _non_empty_string(raw):
        return False, "human_signoff.datetime must be a non-empty ISO-8601 string"
    raw = str(raw).strip()
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return False, f"human_signoff.datetime is not valid ISO-8601: {raw!r}"
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    if parsed > now:
        return False, f"human_signoff.datetime is in the future: {raw!r}"
    return True, f"human_signoff.datetime parses as ISO-8601 and is not in the future: {raw!r}"


def _check_required_fields(data):
    missing = [f for f in REQUIRED_FIELDS if f not in data or data.get(f) in (None, "")]
    if missing:
        return False, f"missing required field(s): {', '.join(missing)}"
    for field in ("title", "meta_description", "content_hash", "published_path"):
        if not _non_empty_string(data.get(field)):
            return False, f"{field} must be a non-empty string"
    # PUB-1: the body itself is required — body_words is only a cross-check.
    body_html = data.get("body_html")
    body_text = data.get("body_text")
    if not (_non_empty_string(body_html) or _non_empty_string(body_text)):
        return False, "body (body_text or body_html) is required — body_words is never trusted"
    return True, "required fields present: " + ", ".join(REQUIRED_FIELDS)


def _check_length_caps(data):
    """PUB-8: explicit maximums for every string field (see MAX_LENGTHS)."""
    for path, text in _iter_strings(data):
        match = re.match(r"\$\.([A-Za-z_][A-Za-z0-9_]*)", path)
        top = match.group(1) if match else ""
        cap = MAX_LENGTHS.get(top, MAX_GENERIC_STRING)
        if len(text) > cap:
            return False, f"{path} exceeds maximum length {cap} (got {len(text)} characters)"
    return True, "all string fields within length caps"


def _check_text_hygiene(data):
    """PUB-9: reject NUL/C0 controls and invisible bidi/zero-width characters."""
    for path, text in _iter_strings(data):
        for candidate, label in ((text, "raw"), (_percent_decode(text), "decoded")):
            if CONTROL_RE.search(candidate):
                return False, f"control or NUL character in {label} text at {path}"
            if INVISIBLE_RE.search(candidate):
                return False, f"zero-width or bidi control character at {path}"
    return True, "no NUL/control or zero-width/bidi characters"


def _check_slug(data):
    slug = data.get("slug")
    if not _non_empty_string(slug):
        return False, "slug must be a non-empty string"
    if "/" in slug or "\\" in slug or ".." in slug:
        return False, f"slug contains path traversal or separators: {slug!r}"
    if not SLUG_RE.fullmatch(slug):
        return False, f"slug must be lowercase, hyphenated, unique-safe: {slug!r}"
    return True, f"slug is lowercase, hyphenated, traversal-safe: {slug!r}"


def _check_published_path(data, publish_root=DEFAULT_PUBLISH_ROOT):
    """PUB-2: safe relative slug path that resolves inside the publish root."""
    raw = data.get("published_path")
    if not _non_empty_string(raw):
        return False, "published_path must be a non-empty string"
    if not isinstance(raw, str):
        return False, "published_path must be a non-empty string"
    if ANY_CONTROL_RE.search(raw):
        return False, f"published_path contains a control character or NUL: {raw!r}"
    if "\\" in raw:
        return False, f"published_path contains a backslash: {raw!r}"
    decoded = _percent_decode(raw)
    if decoded != raw or "%" in raw:
        return False, f"published_path must not be percent-encoded: {raw!r}"
    if CONTROL_RE.search(decoded) or INVISIBLE_RE.search(decoded):
        return False, f"published_path contains an invisible or control character: {raw!r}"
    norm = NBSP_RE.sub(" ", decoded)
    if norm.startswith("/") or re.match(r"^[A-Za-z]:", norm):
        return False, f"published_path must be a relative path (no absolute paths): {raw!r}"
    segments = norm.split("/")
    if any(seg in ("", ".", "..") for seg in segments):
        return False, f"published_path contains traversal or empty segments: {raw!r}"
    if not all(PUBLISHED_SEGMENT_RE.fullmatch(seg) for seg in segments):
        return False, f"published_path has unsafe characters: {raw!r}"
    root = Path(publish_root).resolve()
    target = (root / norm).resolve()
    if target == root or not target.is_relative_to(root):
        return False, f"published_path escapes the publish root {publish_root!r}: {raw!r}"
    return True, f"published_path is safe and contained under {publish_root!r}"


def _check_canonical_url(data):
    """PUB-13: absolute https URL, no embedded credentials, real host."""
    url = data.get("canonical_url")
    if not _non_empty_string(url):
        return False, "canonical_url must be a non-empty string"
    if not url.startswith("https://") or len(url) <= len("https://"):
        return False, f"canonical_url must be an absolute https URL: {url!r}"
    parts = urllib.parse.urlsplit(url)
    if "@" in parts.netloc:
        return False, f"canonical_url must not embed credentials (user:pass@): {url!r}"
    if parts.username or parts.password:
        return False, f"canonical_url must not embed credentials (user:pass@): {url!r}"
    host = parts.hostname
    if not host or "." not in host:
        return False, f"canonical_url has no resolvable host: {url!r}"
    return True, f"canonical_url is absolute https: {url!r}"


def _check_author(data):
    author = data.get("author")
    if not isinstance(author, dict):
        return False, "author must be an object with {name, url, person_id}"
    bad = [f for f in AUTHOR_FIELDS if not _non_empty_string(author.get(f))]
    if bad:
        return False, f"author has empty or missing field(s): {', '.join(bad)}"
    return True, "author {name, url, person_id} present and non-empty"


def _check_safety(data):
    """PUB-4/5/6/7/10: normalised scans for IPs, markup, tokens, placeholders."""
    for path, text in _iter_strings(data):
        scan = _normalise_for_scan(text)
        stripped_raw = ANY_CONTROL_RE.sub("", text)
        lowered = scan.lower()
        for marker in INTERNAL_HOST_MARKERS:
            if marker in lowered:
                return False, f"internal hostname marker {marker!r} at {path}"
        # PUB-6: control-split tags ("<scr\0ipt>") are caught on the stripped form.
        if DANGEROUS_TAG_RE.search(stripped_raw) or DANGEROUS_TAG_RE.search(scan):
            return False, (
                f"dangerous tag (<script>/<iframe>/<object>/<embed>) in text field at {path}"
            )
        if EVENT_HANDLER_RE.search(scan):
            return False, f"event-handler attribute (on...=) in text field at {path}"
        if SVG_TAG_RE.search(scan):
            return False, f"<svg> markup in text field at {path}"
        # PUB-5: IPv4, IPv6, hex/octal and short-form IPs.
        hit = _find_ip(scan)
        if hit:
            kind, token = hit
            return False, f"{kind} address found in package: {token!r} at {path}"
        token = HOST_TOKEN_RE.search(scan)
        if token:
            return False, f"unresolved host token {token.group(0)!r} at {path}"
        for pattern in PLACEHOLDER_RES:
            hit = pattern.search(scan)
            if hit:
                return False, f"placeholder text {hit.group(0)!r} at {path}"
    return True, "no raw IPs, internal hostnames, dangerous markup, host tokens, or placeholders"


def _check_jsonld(data):
    entries = data.get("schema_jsonld")
    if entries is None:
        return True, "schema_jsonld absent (allowed; nothing to validate)"
    if not isinstance(entries, list) or not entries:
        return False, "schema_jsonld must be a non-empty list of JSON-LD objects"
    for index, entry in enumerate(entries):
        obj = entry
        if isinstance(entry, str):
            try:
                obj = json.loads(entry, object_pairs_hook=_reject_duplicate_keys)
            except ValueError as exc:
                return False, f"schema_jsonld[{index}] is not valid JSON: {exc}"
        if not isinstance(obj, dict):
            return False, (
                f"schema_jsonld[{index}] must be a JSON object, not an array "
                "or scalar (array form breaks naive validators)"
            )
        # PUB-11: @graph smuggling — one typed node per block only.
        if "@graph" in obj:
            nodes = obj.get("@graph")
            if not isinstance(nodes, list) or not nodes:
                return False, f"schema_jsonld[{index}] '@graph' must be a non-empty list"
            if len(nodes) != 1:
                return False, (
                    f"schema_jsonld[{index}] '@graph' smuggling: exactly one node per "
                    f"block is allowed (got {len(nodes)})"
                )
            node = nodes[0]
            if not isinstance(node, dict) or not _non_empty_string(node.get("@type")):
                return False, f"schema_jsonld[{index}] '@graph' node missing non-empty '@type'"
            if not (_non_empty_string(obj.get("@context"))
                    or _non_empty_string(node.get("@context"))):
                return False, f"schema_jsonld[{index}] missing non-empty '@context'"
            continue
        for key in ("@type", "@context"):
            if not _non_empty_string(obj.get(key)):
                return False, f"schema_jsonld[{index}] missing non-empty {key!r}"
    return True, f"schema_jsonld: {len(entries)} object(s), each with @type and @context"


def _check_cta_paths(data):
    """PUB-3/4: root-relative paths only; checks run on the decoded value."""
    paths = data.get("cta_paths")
    if not isinstance(paths, list) or not paths:
        return False, "cta_paths must be a non-empty list"
    for index, path in enumerate(paths):
        if not _non_empty_string(path):
            return False, f"cta_paths[{index}] must be a non-empty string"
        if "\x00" in path:
            return False, f"cta_paths[{index}] contains a NUL byte: {path!r}"
        norm = _normalise_for_scan(path)
        if "\\" in norm:
            return False, f"cta_paths[{index}] contains a backslash (off-site): {path!r}"
        lowered = norm.lower()
        for forbidden in CTA_FORBIDDEN:
            if forbidden in lowered:
                return False, f"cta_paths[{index}] contains forbidden {forbidden!r}: {path!r}"
        if not CTA_ROOT_RE.match(norm):
            return False, (
                f"cta_paths[{index}] must start with '/' and not '//' "
                f"(root-relative, not protocol-relative): {path!r}"
            )
        scheme = CTA_SCHEME_RE.search(norm)
        if scheme:
            return False, f"cta_paths[{index}] contains a URL scheme {scheme.group(0)!r}: {path!r}"
    return True, f"cta_paths: {len(paths)} safe root-relative path(s)"


def _check_scale_gate(data):
    """PUB-1: gate on the MEASURED word count; body_words is a cross-check."""
    body_words = data.get("body_words")
    if isinstance(body_words, bool) or not isinstance(body_words, int):
        return False, "body_words must be an integer (scale gate requires it)"
    if body_words < 0:
        return False, f"body_words must not be negative: {body_words}"
    noindex = data.get("noindex", False)
    if not isinstance(noindex, bool):
        return False, "noindex must be a boolean when present"
    measured = _measure_visible_words(data)
    if measured is None:
        return False, "no measurable body (body_text or body_html required; body_words is never trusted)"
    tolerance = max(BODY_WORDS_TOLERANCE_MIN, round(BODY_WORDS_TOLERANCE_PCT * measured))
    if abs(measured - body_words) > tolerance:
        return False, (
            f"body_words cross-check failed: caller asserts {body_words} but "
            f"{measured} visible words were measured (tolerance {tolerance} = "
            f"max({BODY_WORDS_TOLERANCE_MIN}, {int(BODY_WORDS_TOLERANCE_PCT * 100)}% of measured))"
        )
    if measured < MIN_BODY_WORDS:
        if not noindex:
            return False, (
                f"body_words {measured} < {MIN_BODY_WORDS}: thin bodies publish "
                "noindex — set noindex: true (and keep it out of the sitemap)"
            )
        return True, (
            f"body_words {measured} < {MIN_BODY_WORDS} with noindex: true — "
            "publish allowed but exclude from sitemap"
        )
    return True, f"body_words {measured} >= {MIN_BODY_WORDS} — indexable by default"


def _check_cta_and_body_index_fields(data):
    noindex = data.get("noindex", False)
    if noindex is True:
        return True, "noindex: true — publisher must not add this package to the sitemap"
    return True, "noindex not set — publisher may include the package in the sitemap"


def _build_checks(publish_root):
    return (
        ("human_signoff (P0)", _check_human_signoff),
        ("human_signoff.datetime", _check_signoff_datetime),
        ("required fields", _check_required_fields),
        ("length caps", _check_length_caps),
        ("text hygiene", _check_text_hygiene),
        ("slug safety", _check_slug),
        ("published_path safety", lambda data: _check_published_path(data, publish_root)),
        ("canonical_url", _check_canonical_url),
        ("author", _check_author),
        ("safety scan", _check_safety),
        ("schema_jsonld", _check_jsonld),
        ("cta_paths", _check_cta_paths),
        ("scale gate", _check_scale_gate),
        ("sitemap policy", _check_cta_and_body_index_fields),
    )


def validate_package(data, publish_root=DEFAULT_PUBLISH_ROOT):
    """Return (ok, results); results = list of {name, ok, detail}."""
    if not isinstance(data, dict):
        return False, [{"name": "package shape", "ok": False,
                        "detail": "package must be a JSON object"}]
    results = []
    ok = True
    for name, fn in _build_checks(publish_root):
        passed, detail = fn(data)
        results.append({"name": name, "ok": passed, "detail": detail})
        if not passed:
            ok = False
    return ok, results


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Deterministic publish-package validator (v2, P0 human_signoff gate)."
    )
    parser.add_argument("--package", required=True, help="path to the publish package JSON")
    parser.add_argument(
        "--publish-root", default=DEFAULT_PUBLISH_ROOT,
        help=f"publish root that published_path must resolve under (default: {DEFAULT_PUBLISH_ROOT})",
    )
    args = parser.parse_args(argv)

    try:
        with open(args.package, "r", encoding="utf-8") as handle:
            data = json.load(handle, object_pairs_hook=_reject_duplicate_keys)
    except (OSError, ValueError, RecursionError) as exc:
        print(f"[FAIL] package load: {exc}")
        print(f"FAIL: package could not be loaded: {exc}")
        return 1

    ok, results = validate_package(data, publish_root=args.publish_root)
    for result in results:
        status = "PASS" if result["ok"] else "FAIL"
        print(f"[{status}] {result['name']}: {result['detail']}")

    if ok:
        noindex = data.get("noindex", False) is True
        sitemap_note = (
            "noindex=true: publish allowed, do NOT add to sitemap"
            if noindex
            else "indexable: eligible for sitemap"
        )
        print(f"PASS: publish package is publishable ({len(results)} checks, {sitemap_note})")
        return 0

    first_failure = next(r for r in results if not r["ok"])
    print(f"FAIL: {first_failure['name']}: {first_failure['detail']}")
    return 1

if __name__ == "__main__":
    sys.exit(main())
