#!/usr/bin/env python3
from urllib.request import Request, urlopen

LOCAL = "http://127.0.0.1:8765/docs/1737944563-how-to-re_activate-and-extend-your-180_day-windows-trial.html"
LIVE = "https://www.stealthrdp.com/docs/1737944563-how-to-re_activate-and-extend-your-180_day-windows-trial.html"


def head(url):
    req = Request(url, method="HEAD")
    with urlopen(req, timeout=20) as res:
        print(f"HEAD {url}")
        print(f"  status={res.status}")
        print(f"  final={res.geturl()}")
        print(f"  content-type={res.headers.get('Content-Type')}")


def check_local():
    with urlopen(LOCAL, timeout=20) as res:
        html = res.read().decode("utf-8", "replace")
    checks = [
        ("status", res.status == 200),
        ("h1", "How to Extend the Windows Server 180-Day Evaluation Period" in html),
        ("old_title_absent", "How to Re-activate and Extend Your 180-Day Windows Trial" not in html),
        ("warning", "Windows Server Evaluation Notice" in html),
        ("docs-warning", 'class="docs-warning"' in html),
        ("rearm", "<code>slmgr -rearm</code>" in html),
        ("dlv", "<code>slmgr -dlv</code>" in html),
        ("ato", "<code>slmgr -ato</code>" in html),
        ("note", "does not convert an Evaluation edition into a licensed production edition" in html),
        ("ato_separate", "This step is not part of extending the evaluation period" in html),
        ("canonical_slug", "docs/1737944563-how-to-re_activate-and-extend-your-180_day-windows-trial.html" in html),
        ("no_indefinite", "indefinitely" not in html.lower()),
    ]
    print(f"GET {LOCAL} status={res.status} bytes={len(html)}")
    for name, ok in checks:
        print(f"  {name}: {'PASS' if ok else 'FAIL'}")


if __name__ == "__main__":
    head(LOCAL)
    check_local()
    head(LIVE)
