#!/usr/bin/env python3
"""One-shot: clarify the Windows Server evaluation rearm article."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "data" / "docs-articles.json"
SLUG = "1737944563-how-to-re_activate-and-extend-your-180_day-windows-trial"
TITLE = "How to Extend the Windows Server 180-Day Evaluation Period"
SUMMARY = "Rearm the Windows Server evaluation period with slmgr -rearm, then check remaining time with slmgr -dlv."
CONTENT = """How to Extend the Windows Server 180-Day Evaluation Period

How to Extend the Windows Server 180-Day Evaluation Period
===========================================================

Last updated on Jan 28, 2025

### Step 1: Open PowerShell as Administrator

To begin, you need to run commands with administrator privileges. Here's how:

1.  Press the **Windows key**, type **PowerShell**, and when it appears, right-click on it.

2.  Select **Run as administrator** from the context menu.


### Step 2: Run the Re-arm Command

Once PowerShell is open with administrative privileges, enter the following command to re-arm the evaluation period:

    slmgr -rearm

This command resets the 180-day evaluation timer where Microsoft permits rearming on the installed Evaluation edition.

Note: Rearming resets the evaluation activation timer where supported by Microsoft. It does not convert an Evaluation edition into a licensed production edition.

### Step 3: Reboot Your System

To complete the process, reboot your computer for the changes to take effect. A restart is necessary for the re-arm to be fully implemented.

### Step 4: Check Evaluation Status

After rebooting, you can check the remaining evaluation period and rearm count by using the following command in PowerShell:

    slmgr -dlv

This command displays detailed evaluation status, including the number of re-arms remaining and how much time is left on the evaluation period.

### Step 5: Optional — Activate only with a valid license key

This step is not part of extending the evaluation period. It is a separate, conditional activation attempt that uses a valid Microsoft license key you already own. StealthRDP does not provide a Windows Server license.

If you have a valid license key and want to attempt activation, you can use the following command:

    slmgr -ato

This command tries to activate Windows using that valid license key, if one is available.

* * *

These steps rearm or extend the Microsoft evaluation period where the installed Evaluation edition supports it. They do not activate Windows, supply a commercial license, or authorize production use. For production workloads, obtain an appropriate Microsoft Windows Server license.

If you have any issues or need further assistance, contact our support team.

* * *
"""


def main() -> None:
    articles = json.loads(PATH.read_text(encoding="utf-8"))
    matches = [item for item in articles if item.get("slug") == SLUG]
    if len(matches) != 1:
        raise SystemExit(f"expected 1 article for {SLUG}, found {len(matches)}")
    article = matches[0]
    article["title"] = TITLE
    article["summary"] = SUMMARY
    article["content"] = CONTENT
    PATH.write_text(json.dumps(articles, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"updated {PATH} slug={SLUG}")


if __name__ == "__main__":
    main()
