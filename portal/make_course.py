"""Make the certificate portal for another course from this one.

    python portal/make_course.py courses/fcr-level1

The course folder holds course.json:
  "background"  printed text for make_background.py (run it with the same folder)
  "portal"      text replacements, per file in apps-script/, as [old, new] pairs
  "extra"       course-only Apps Script files kept in the course folder (e.g. Survey.gs)

Writes <course folder>/apps-script/: the shared Code.gs, Portal.html, Verify.html, Submit.html and
appsscript.json with the course's replacements applied, plus the extra files. Every pair must
match exactly once, so a change to the shared files that breaks a replacement stops the build.
Re-run after changing the shared apps-script files, then paste the new files into that course's
Apps Script project.
"""
import json
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).parent
SRC = HERE / "apps-script"


def main(course_dir):
    course = (HERE / course_dir).resolve()
    cfg = json.loads((course / "course.json").read_text(encoding="utf-8"))
    out = course / "apps-script"
    out.mkdir(exist_ok=True)
    for src in sorted(SRC.iterdir()):
        text = src.read_text(encoding="utf-8")
        for old, new in cfg.get("portal", {}).get(src.name, []):
            n = text.count(old)
            if n != 1:
                sys.exit(f"{src.name}: expected 1 match, found {n}: {old[:70]}")
            text = text.replace(old, new)
        (out / src.name).write_text(text, encoding="utf-8", newline="\n")
    for name in cfg.get("extra", []):
        shutil.copyfile(course / name, out / name)
    print(f"{cfg.get('name', course.name)}: wrote {out}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
