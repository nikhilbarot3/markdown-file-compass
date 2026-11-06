"""Collect real live UI answers; never substitute reference answers."""
import argparse
import asyncio
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from playwright.async_api import async_playwright
from contracts import validate_observation

HERE = Path(__file__).resolve().parent


async def collect(args):
    cases = [json.loads(line) for line in args.cases.read_text().splitlines() if line.strip()]
    if args.limit:
        cases = cases[:args.limit]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    failures = 0
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        with args.output.open("w") as output:
            for case in cases:
                context = await browser.new_context(viewport={"width": 1280, "height": 1800})
                page = await context.new_page()
                row = {**case, "app_url": args.url, "collected_at": datetime.now(timezone.utc).isoformat()}
                try:
                    await page.goto(args.url, wait_until="networkidle")
                    await page.get_by_label("Insurance plan").select_option(case["plan_id"])
                    await page.get_by_label("Message", exact=True).fill(case["user_input"])
                    await page.get_by_role("button", name="Check", exact=True).click()
                    results = page.get_by_role("region", name="Results", exact=True)
                    await results.get_by_role("heading", name="Why it matches: your policy facts").wait_for(timeout=120000)
                    row["response"] = (await page.locator('[aria-live="polite"] div.self-start').last.inner_text()).strip()
                    row["retrieved_contexts"] = []
                    for tr in await results.locator("table").first.locator("tbody tr").all():
                        cells = await tr.locator("td").all_inner_texts()
                        row["retrieved_contexts"].append(f"Section {cells[1]}: {cells[0]}")
                    numbers = re.search(r"\$([\d,.]+)\s+of\s+\$([\d,.]+)", await results.inner_text())
                    if not numbers:
                        raise ValueError("Missing observed price/limit")
                    row["price"], row["plan_limit"] = [float(v.replace(",", "")) for v in numbers.groups()]
                    validate_observation(row)
                    print(f"Collected {case['id']}")
                except Exception as error:
                    failures += 1
                    row["collection_error"] = type(error).__name__
                    print(f"Collection failed: {case['id']} ({type(error).__name__})")
                output.write(json.dumps(row) + "\n")
                output.flush()
                await context.close()
        await browser.close()
    return failures


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://localhost:8080")
    parser.add_argument("--cases", type=Path, default=HERE / "cases.jsonl")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--limit", type=int)
    raise SystemExit(1 if asyncio.run(collect(parser.parse_args())) else 0)