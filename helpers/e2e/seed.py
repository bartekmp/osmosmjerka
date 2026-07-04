#!/usr/bin/env python3
"""Seed a throwaway osmosmjerka backend with one language set of crossword/word-search
friendly phrases, then print the admin token + language set id for the Playwright run.

Usage: seed.py <base_url> <admin_user> <admin_pass>
Prints two lines: TOKEN=<jwt> and LANGSET=<id>.
"""
import json
import sys
import time
import urllib.error
import urllib.request

# Short, heavily-overlapping words so the crossword generator has intersections to work
# with; also fine for the word-search grid. category;phrase;translation
WORDS = [
    ("cat", "kot"), ("dog", "pies"), ("rat", "szczur"), ("bat", "nietoperz"),
    ("owl", "sowa"), ("cow", "krowa"), ("ant", "mrowka"), ("bee", "pszczola"),
    ("fox", "lis"), ("hen", "kura"), ("pig", "swinia"), ("ram", "baran"),
    ("ape", "malpa"), ("elk", "los"), ("eel", "wegorz"), ("emu", "ptak"),
    ("asp", "zmija"), ("sow", "maciora"), ("tan", "opalenizna"), ("tar", "smola"),
    ("net", "siec"), ("ten", "dziesiec"), ("nap", "drzemka"), ("pan", "patelnia"),
    ("ear", "ucho"), ("era", "epoka"), ("oat", "owies"), ("toe", "palec"),
    ("eat", "jesc"), ("tea", "herbata"), ("ore", "ruda"), ("roe", "ikra"),
    ("arc", "luk"), ("oar", "wioslo"), ("rot", "gnicie"),
]


def _req(method, url, token=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def main():
    base, user, password = sys.argv[1], sys.argv[2], sys.argv[3]

    # Wait for the backend to answer before seeding.
    for _ in range(60):
        try:
            _req("GET", f"{base}/api/version")
            break
        except urllib.error.URLError:
            time.sleep(1)

    token = _req("POST", f"{base}/admin/login", body={"username": user, "password": password})["access_token"]

    set_id = _req(
        "POST",
        f"{base}/admin/language-sets",
        token=token,
        body={"name": "E2E-EN-PL", "display_name": "E2E", "description": "e2e", "author": "ci", "target_lang": "pl"},
    )["id"]

    content = "categories;phrase;translation\n" + "\n".join(f"animals;{w};{t}" for w, t in WORDS)
    _req(
        "POST",
        f"{base}/admin/upload-text?language_set_id={set_id}",
        token=token,
        body={"content": content, "separator": ";"},
    )

    print(f"TOKEN={token}")
    print(f"LANGSET={set_id}")


if __name__ == "__main__":
    main()
