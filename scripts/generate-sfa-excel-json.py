#!/usr/bin/env python3
"""Regenerate src/data/sfa-excel.json from docs Excel (Sales Team SFA + Pembagian Insentif)."""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path

try:
    import openpyxl
except ImportError as e:
    raise SystemExit("Install openpyxl: pip install openpyxl") from e

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "docs" / "Insentif Team - Data Karyawan SFA.xlsx"
OUT = ROOT / "src" / "data" / "sfa-excel.json"

SKIP_JABATAN_TEAM = {
    "SPV",
    "ASM",
    "ASPS",
    "ASPR",
    "HORECA SPV",
    "FSR",
    "Task Force",
    "KEY ACCOUNT SUPERVISOR",
    "Key Account Supervisor",
    "WAREHOUSE CABANG SUPERVISOR",
}
LEAD_JABATAN = {
    "Salesman",
    "Canvas Motoris",
    "Sales Executive",
    "Horeca Executive",
    "Key Account Executive",
    "Sales TO",
}
MEMBER_JABATAN = {"Driver", "Helper"}


def is_vacant(p: dict) -> bool:
    n = (p.get("nama") or "").lower()
    return "vacant" in n or not p.get("nama")


def parse_sfa(ws) -> list[dict]:
    starts = [
        c
        for c in range(1, min(ws.max_column, 200) + 1)
        if ws.cell(2, c).value == "AREA"
    ]
    people: list[dict] = []
    for start_col in starts:
        area = cabang = None
        for r in range(3, ws.max_row + 1):
            nama = ws.cell(r, start_col + 2).value
            nik = ws.cell(r, start_col + 3).value
            kode = ws.cell(r, start_col + 4).value
            jabatan = ws.cell(r, start_col + 5).value
            mobil = ws.cell(r, start_col + 6).value
            a = ws.cell(r, start_col).value
            cab = ws.cell(r, start_col + 1).value
            if a:
                area = str(a).strip()
            if cab:
                cabang = str(cab).strip()
            if not nama and not jabatan and not kode:
                continue
            if cabang and cabang.startswith("*"):
                continue
            people.append(
                {
                    "area": area,
                    "cabang": cabang,
                    "nama": str(nama).strip() if nama else None,
                    "nik": None
                    if nik is None or str(nik).strip() == ""
                    else str(nik).strip(),
                    "kode": None
                    if kode is None or str(kode).strip() in ("", "0")
                    else str(kode).strip(),
                    "jabatan": str(jabatan).strip() if jabatan else None,
                    "mobil": str(mobil).strip() if mobil else None,
                }
            )
    return people


def extract_teams(people_list: list[dict]) -> list[dict]:
    teams: list[dict] = []
    current = None
    for p in people_list:
        j = (p.get("jabatan") or "").strip()
        if not j:
            continue
        if j in SKIP_JABATAN_TEAM or j.startswith("SP-"):
            if current:
                teams.append(current)
                current = None
            continue
        if j in LEAD_JABATAN:
            if current:
                teams.append(current)
            current = {
                "lead": p,
                "members": [p],
                "kode": p.get("kode"),
                "cabang": p.get("cabang"),
                "area": p.get("area"),
            }
            continue
        if current is not None and j in MEMBER_JABATAN:
            current["members"].append(p)
            continue
        if current:
            teams.append(current)
            current = None
    if current:
        teams.append(current)
    return teams


def main() -> None:
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    people = parse_sfa(wb["Sales Team SFA"])

    by_cabang: dict[tuple, list] = defaultdict(list)
    for p in people:
        if p["cabang"]:
            by_cabang[(p["area"], p["cabang"])].append(p)

    raw_teams = []
    for plist in by_cabang.values():
        for t in extract_teams(plist):
            if is_vacant(t["lead"]):
                continue
            lead_j = t["lead"]["jabatan"]
            if lead_j not in LEAD_JABATAN:
                continue
            raw_teams.append(t)

    ws2 = wb["Pembagian Insentif"]
    examples = []
    for r in range(9, 15):
        examples.append(
            {
                "kode": ws2.cell(r, 1).value,
                "salesman": ws2.cell(r, 2).value,
                "typeSales": ws2.cell(r, 6).value,
                "incentiveGross": ws2.cell(r, 7).value,
                "salesShare": ws2.cell(r, 8).value,
                "driverHelperShare": ws2.cell(r, 9).value,
            }
        )

    emp_map: dict[str, dict] = {}
    out_teams = []
    for t in raw_teams:
        members_out = []
        helper_idx = 0
        for m in t["members"]:
            if is_vacant(m) or not m["nik"]:
                continue
            j = m["jabatan"]
            if j in LEAD_JABATAN:
                pos = "salesman"
            elif j == "Driver":
                pos = "driver"
            elif j == "Helper":
                helper_idx += 1
                pos = "helper1" if helper_idx == 1 else "helper2"
            else:
                continue
            emp_map[m["nik"]] = {
                "nik": m["nik"],
                "name": m["nama"],
                "cabang": m["cabang"] or t["cabang"],
                "area": m["area"] or t["area"],
                "jabatan": j,
                "kode": m.get("kode"),
                "mobil": m.get("mobil"),
            }
            members_out.append({"nik": m["nik"], "position": pos, "jabatan": j})
        if not members_out or not any(x["position"] == "salesman" for x in members_out):
            continue
        kode = t.get("kode") or f"TEAM-{t['lead']['nik']}"
        lead_j = t["lead"]["jabatan"]
        if "HRC" in (t.get("kode") or "") or lead_j == "Horeca Executive":
            team_type, role = "Horeca", "sales-horeca"
        elif "MT" in (t.get("kode") or "") or lead_j in (
            "Sales Executive",
            "Key Account Executive",
        ):
            team_type, role = "MT", "sales-mt"
        else:
            team_type, role = "GT", "canvasser"
        out_teams.append(
            {
                "code": kode,
                "name": f"{kode} · {t['lead']['nama']}",
                "teamType": team_type,
                "roleId": role,
                "cabang": t["cabang"],
                "area": t["area"],
                "members": members_out,
            }
        )

    individu = []
    seen_ind = set()
    for p in people:
        j = (p.get("jabatan") or "").strip()
        if is_vacant(p) or not p.get("nik"):
            continue
        if j in SKIP_JABATAN_TEAM or j.startswith("SP-"):
            if p["nik"] in seen_ind:
                continue
            seen_ind.add(p["nik"])
            individu.append(
                {
                    "nik": p["nik"],
                    "name": p["nama"],
                    "cabang": p["cabang"],
                    "area": p["area"],
                    "jabatan": j,
                    "kode": p.get("kode"),
                }
            )

    cabangs = sorted(
        {
            (p["area"], p["cabang"])
            for p in people
            if p["cabang"] and not str(p["cabang"]).startswith("*")
        }
    )

    out = {
        "source": "docs/Insentif Team - Data Karyawan SFA.xlsx",
        "sheets": {"splits": "Pembagian Insentif", "teams": "Sales Team SFA"},
        "poolRule": "non-salesman share remaining pool equally",
        "splits": {
            "3": {"salesman": 0.55, "poolNonSalesman": 0.45},
            "2": {"salesman": 0.7, "poolNonSalesman": 0.3},
            "1": {"salesman": 1.0, "poolNonSalesman": 0.0},
        },
        "examples": examples,
        "cabangs": [{"area": a, "cabang": c} for a, c in cabangs],
        "employees": list(emp_map.values()),
        "individu": individu,
        "teams": out_teams,
    }

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    sizes = Counter(len(t["members"]) for t in out_teams)
    print(f"Wrote {OUT.relative_to(ROOT)}")
    print(f"teams={len(out_teams)} employees={len(emp_map)} individu={len(individu)} sizes={dict(sizes)}")


if __name__ == "__main__":
    main()
