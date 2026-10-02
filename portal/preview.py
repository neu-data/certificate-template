"""Preview a finished certificate with sample data, using the same slots as the portal.

    python portal/preview.py "Nguyễn Thị Minh Phương"

Reads portal/certificate-background.png and portal/layout.json (both written by
make_background.py) and writes portal/preview.png. In the real certificate the name
is set in Playfair Display (Google Slides); here Bodoni MT stands in for it.
"""
import json
import sys
from pathlib import Path

import qrcode
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent
FONTS = Path("C:/Windows/Fonts")
bg = Image.open(HERE / "certificate-background.png").convert("RGB")
L = json.loads((HERE / "layout.json").read_text(encoding="utf-8"))
S = bg.width / L["page"]["w"]                     # px per pt
d = ImageDraw.Draw(bg)
NAVY, GREY = (4, 36, 47), (128, 140, 150)

name = sys.argv[1] if len(sys.argv) > 1 else "Participant Name"
cert_id = "NDC-TR-2026-1-1047-001"
verify_url = f"https://script.google.com/macros/s/EXAMPLE/exec?verify={cert_id}"


def name_size(n, base):
    k = len(n)
    return base if k <= 18 else base * 0.84 if k <= 24 else base * 0.7 if k <= 30 else base * 0.58 if k <= 38 else base * 0.48


# Name: left-aligned, vertically centred in its slot
box = L["name"]
f = ImageFont.truetype(str(FONTS / "BOD_B.TTF"), int(name_size(name, box["size"]) * S))
d.text((box["x"] * S, (box["y"] + box["h"] / 2) * S), name, font=f, fill=NAVY, anchor="lm")

# ID line, centred
box = L["idline"]
f = ImageFont.truetype(str(FONTS / "GOTHIC.TTF"), int(box["size"] * S))
fb = ImageFont.truetype(str(FONTS / "GOTHICB.TTF"), int(box["size"] * S))
parts = [("Certificate ID: ", f, GREY), (cert_id, fb, NAVY), ("  ·  Verify at contact@neu-data.com", f, GREY)]
total = sum(ft.getlength(t) for t, ft, _ in parts)
x = (box["x"] + box["w"] / 2) * S - total / 2
for t, ft, c in parts:
    d.text((x, (box["y"] + box["h"] / 2) * S), t, font=ft, fill=c, anchor="lm")
    x += ft.getlength(t)

# QR code
q = L["qr"]
size = int(q["size"] * S)
img = qrcode.make(verify_url, box_size=10, border=1).convert("RGB").resize((size, size), Image.NEAREST)
bg.paste(img, (int(q["x"] * S), int(q["y"] * S)))

out = HERE / "preview.png"
bg.save(out)
print(out)
