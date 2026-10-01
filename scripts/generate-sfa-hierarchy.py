#!/usr/bin/env python3
"""Regenerate src/data/sfa-hierarchy.json — struktur atasan-bawahan dari sheet Sales Team SFA.

Aturan baca (sheet vertikal):
- Baris dengan font KUNING di kolom NAMA = leader (SPV, ASPR, ASM, dst; VACANT juga leader).
- Baris di bawahnya sampai leader kuning berikutnya (satu cabang) = bawahan leader tsb.
- Baris sesudah "*CATATAN:" tidak punya leader di atasnya; leader ditebak dari
  keluarga jabatan (lihat resolve_orphan) dan diberi flag needsReview.

RSM tidak ada di Excel. RSM (per region) dan ASM (per AREA) diambil dari ORG_CONFIG;
baris ASM di Excel (Garut) dipakai sebagai node ASM area-nya.
"""

from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "data" / "sfa-hierarchy.json"

_spec = importlib.util.spec_from_file_location(
    "gen_sfa", ROOT / "scripts" / "generate-sfa-excel-json.py"
)
gen = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gen)

SUPERVISOR_WORDS = ("SPV", "SUPERVISOR", "ASPR", "ASPS", "ASS ", "ASM")
FIELD_SUP = ("ASPR", "ASPS")
OPS_JABATAN = {"Delivery Man", "Helper Delivery", "Driver Distributor", "Helper Gudang"}


# Master RSM / ASM per area (sumber: tabel struktur dari user, bukan Excel SFA)
ORG_CONFIG = [
    {
        "rsm": "Sulin Rohdiansah",
        "region": "RSM Barat",
        "areas": [
            {"area": "JAWA BARAT-1", "label": "Jabar 1", "asm": "Benny Herdiana"},
            {"area": "JAWA BARAT-2", "label": "Jabar 2", "asm": "Aris Johar"},
            {"area": "JAWA BARAT-3", "label": "Jabar 3", "asm": "Andreas Premadya"},
        ],
    },
    {
        "rsm": "Ahmad Oka Sugio",
        "region": "RSM Timur",
        "areas": [
            {"area": "JAWA TENGAH", "label": "Jateng", "asm": "Uut Kurniawan"},
            {"area": "JAWA TIMUR", "label": "Jatim", "asm": "Adi Harmono"},
        ],
    },
]


def region_of(area: str) -> str:
    for r in ORG_CONFIG:
        if any(a["area"] == area for a in r["areas"]):
            return r["region"]
    raise SystemExit(f"Area {area} tidak ada di ORG_CONFIG")


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def lead_nik(raw) -> str | None:
    """NIK leader; ambil angka depan (mis. '20250117-1(karena beda team)')."""
    if raw is None:
        return None
    m = re.match(r"\s*(\d+)", str(raw))
    return m.group(1) if m and m.group(1) != "0" else None


def is_leader_jabatan(j: str) -> bool:
    ju = j.upper()
    return any(w in ju for w in SUPERVISOR_WORDS) and not ju.startswith("SP-")


def resolve_orphan(p: dict, leaders: list[dict]) -> dict | None:
    """Leader terdekat (di cabang sama) menurut keluarga jabatan."""
    same = [l for l in leaders if l["cabang"] == p["cabang"] and l["row"] < p["row"]]
    if not same:
        return None
    j = p["jabatan"] or ""
    if j.startswith("SP-"):
        pick = [l for l in same if (l["jabatan"] or "").upper().startswith(FIELD_SUP)]
    elif j in OPS_JABATAN or j in ("Driver", "Helper"):
        pick = [l for l in same if not l["jabatan"]]
    else:
        pick = [l for l in same if (l["jabatan"] or "").upper() in ("SPV", "SPV DIST")]
    return (pick or same)[-1]


def main() -> None:
    wb = openpyxl.load_workbook(gen.XLSX, data_only=True)
    people = gen.parse_sfa(wb["Sales Team SFA"])

    leaders: list[dict] = []
    members: list[dict] = []
    current: dict | None = None
    last_cabang = None

    for p in people:
        if p["cabang"] != last_cabang:
            current = None
            last_cabang = p["cabang"]
        if not p["cabang"] or not p["nama"] and not p["jabatan"]:
            continue
        vacant = gen.is_vacant(p)

        if p["leader"] and not p["afterNote"]:
            current = {
                "id": f"L{p['row']}",
                "name": None if vacant else p["nama"],
                "nik": None if vacant else lead_nik(p["nikRaw"]),
                "jabatan": p["jabatan"],
                "area": p["area"],
                "cabang": p["cabang"],
                "row": p["row"],
                "needsReview": False,
                "reason": None,
            }
            leaders.append(current)
            continue

        if vacant:
            continue

        rec = {
            "name": p["nama"],
            "nik": gen.norm_nik(p["nik"]),
            "jabatan": p["jabatan"],
            "kode": p["kode"],
            "area": p["area"],
            "cabang": p["cabang"],
            "row": p["row"],
            "leaderId": None,
            "needsReview": False,
            "reason": None,
        }

        if p["afterNote"]:
            if is_leader_jabatan(p["jabatan"] or ""):
                # Supervisor tanpa font kuning di bawah *CATATAN → jadikan leader
                leader = {
                    "id": f"L{p['row']}",
                    "name": p["nama"],
                    "nik": gen.norm_nik(p["nik"]),
                    "jabatan": p["jabatan"],
                    "area": p["area"],
                    "cabang": p["cabang"],
                    "row": p["row"],
                    "needsReview": True,
                    "reason": "Supervisor di bawah *CATATAN (tidak berfont kuning)",
                }
                leaders.append(leader)
                continue
            target = resolve_orphan(p, leaders)
            rec["leaderId"] = target["id"] if target else None
            rec["needsReview"] = True
            rec["reason"] = "Baris tambahan di bawah *CATATAN — atasan ditebak dari jabatan"
        elif current is not None:
            rec["leaderId"] = current["id"]
        else:
            rec["needsReview"] = True
            rec["reason"] = "Tidak ada leader di atas baris ini"
        members.append(rec)

    # Orang yang sama (cabang + NIK) tercatat 2x: pakai baris reguler (bukan *CATATAN)
    uniq: dict[tuple, dict] = {}
    for m in members:
        if not m["nik"]:
            uniq[(m["cabang"], m["name"], m["row"])] = m
            continue
        key = (m["cabang"], m["nik"])
        prev = uniq.get(key)
        if prev is None or (prev["needsReview"] and not m["needsReview"]):
            uniq[key] = m
    members = sorted(uniq.values(), key=lambda m: m["row"])

    # Nama sama + cabang sama + NIK kosong → tandai duplikat
    seen: dict[tuple, int] = {}
    for m in members:
        key = (m["cabang"], (m["name"] or "").lower(), m["jabatan"])
        seen[key] = seen.get(key, 0) + 1
    for m in members:
        key = (m["cabang"], (m["name"] or "").lower(), m["jabatan"])
        if seen[key] > 1 and not m["nik"]:
            m["needsReview"] = True
            m["reason"] = (m["reason"] or "") + " Nama ganda tanpa NIK"

    areas = [a["area"] for r in ORG_CONFIG for a in r["areas"]]
    asm_name = {a["area"]: a["asm"] for r in ORG_CONFIG for a in r["areas"]}
    area_label = {a["area"]: a["label"] for r in ORG_CONFIG for a in r["areas"]}
    for a in {l["area"] for l in leaders} | {m["area"] for m in members}:
        region_of(a)  # pastikan semua area Excel terdaftar
    # Leader Excel berjabatan ASM = ASM area-nya
    asm_by_area = {l["area"]: l["id"] for l in leaders if (l["jabatan"] or "").upper() == "ASM"}

    out = {
        "source": "docs/DATA KARYAWAN SFA.xlsx",
        "note": "RSM/ASM dari ORG_CONFIG (tabel struktur user); leader dari font kuning Excel.",
        "regions": [
            {"id": slug(r["region"]), "name": r["region"], "rsm": r["rsm"]}
            for r in ORG_CONFIG
        ],
        "areas": [
            {
                "id": slug(a),
                "name": a,
                "label": area_label[a],
                "region": slug(region_of(a)),
                "asm": asm_name[a],
                "asmLeaderId": asm_by_area.get(a),
            }
            for a in areas
        ],
        "leaders": leaders,
        "members": members,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    review = sum(1 for m in members if m["needsReview"]) + sum(
        1 for l in leaders if l["needsReview"]
    )
    print(f"Wrote {OUT.relative_to(ROOT)}")
    print(
        f"regions={len(ORG_CONFIG)} areas={len(areas)} leaders={len(leaders)} "
        f"members={len(members)} needsReview={review}"
    )


if __name__ == "__main__":
    main()
