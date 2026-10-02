"""Generate Neudata certificates of completion from a participant list.

    python make_certificates.py                       # uses course.json and participants.csv
    python make_certificates.py --participants other.csv --course other.json

participants.csv columns (only `name` is required):
    name, email, sessions_attended, assignment, id
- `sessions_attended` and `assignment` (yes/no) are checked against the criteria in course.json;
  participants who do not qualify are listed but get no certificate.
- `id` is optional; missing IDs are generated as <id_prefix>-<NNN>.

Outputs, in output/:
- one PDF per certificate:  <ID>_<Name>.pdf
- certificates-issued.csv:  register of every certificate issued (for verification requests)
"""
import argparse
import csv
import json
import re
import shutil
import subprocess
import sys
import unicodedata
from pathlib import Path

HERE = Path(__file__).parent


def find_quarto():
    exe = shutil.which("quarto")
    if exe:
        return exe
    for p in (r"C:\Program Files\Quarto\bin\quarto.exe",
              r"C:\Program Files\RStudio\resources\app\bin\quarto\bin\quarto.exe",
              "/Applications/quarto/bin/quarto",
              "/Applications/RStudio.app/Contents/Resources/app/quarto/bin/quarto"):
        if Path(p).exists():
            return p
    sys.exit("Quarto not found. Install it from https://quarto.org (it includes Typst).")


def slug(text):
    """ASCII file-name version of a name: 'Nguyễn Thị Đào' -> 'Nguyen-Thi-Dao'."""
    text = text.replace("đ", "d").replace("Đ", "D")
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^A-Za-z0-9]+", "-", text).strip("-")


def qualifies(row, course):
    need = course.get("min_sessions")
    if need is not None and row.get("sessions_attended", "").strip():
        if int(row["sessions_attended"]) < int(need):
            return False, f"attended {row['sessions_attended']} of required {need} sessions"
    if course.get("require_assignment") and row.get("assignment", "").strip():
        if row["assignment"].strip().lower() not in ("yes", "y", "true", "1", "submitted"):
            return False, "assignment not submitted"
    return True, ""


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--participants", default=HERE / "participants.csv")
    ap.add_argument("--course", default=HERE / "course.json")
    ap.add_argument("--out", default=HERE / "output")
    args = ap.parse_args()
    # Windows consoles default to a legacy code page; names like "Nguyễn" need UTF-8
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")

    course = json.loads(Path(args.course).read_text(encoding="utf-8"))
    out = Path(args.out)
    out.mkdir(exist_ok=True)
    quarto = find_quarto()

    with open(args.participants, newline="", encoding="utf-8-sig") as f:
        people = list(csv.DictReader(f))

    issued, skipped = [], []
    seq = 0
    for row in people:
        name = row.get("name", "").strip()
        if not name:
            continue
        ok, why = qualifies(row, course)
        if not ok:
            skipped.append((name, why))
            continue
        seq += 1
        cert_id = row.get("id", "").strip() or f"{course['id_prefix']}-{seq:03d}"
        pdf = out / f"{cert_id}_{slug(name)}.pdf"
        inputs = {
            "name": name, "id": cert_id,
            "course": course["course"], "kind": course.get("kind", "Certificate of Completion"),
            "details": course["details"], "dates": course["dates"], "location": course["location"],
            "issued": course["issued"],
            "sign1_name": course["signatories"][0]["name"], "sign1_title": course["signatories"][0]["title"],
            "sign2_name": course["signatories"][1]["name"], "sign2_title": course["signatories"][1]["title"],
        }
        cmd = [quarto, "typst", "compile", str(HERE / "certificate.typ"), str(pdf)]
        for k, v in inputs.items():
            cmd += ["--input", f"{k}={v}"]
        res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
        if res.returncode != 0 or not pdf.exists():
            sys.exit(f"Failed for {name}:\n{res.stderr}")
        issued.append({"id": cert_id, "name": name, "email": row.get("email", ""),
                       "course": course["course"], "dates": course["dates"], "issued": course["issued"],
                       "file": pdf.name})
        print(f"  issued  {cert_id}  {name}")

    with open(out / "certificates-issued.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["id", "name", "email", "course", "dates", "issued", "file"])
        w.writeheader()
        w.writerows(issued)

    print(f"\n{len(issued)} certificate(s) written to {out}")
    for name, why in skipped:
        print(f"  not issued: {name} ({why})")


if __name__ == "__main__":
    main()
