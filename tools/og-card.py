#!/usr/bin/env python3
"""Builds the share card at liver-next/public/og.jpg.

The card is what WhatsApp shows when a couple forwards the link to a friend,
which the audit called the most expensive finding it had: the strongest
recommendation this business gets, arriving as a bare URL.

It is generated rather than hand-composed so the wording can be changed
without opening a design tool, and checked in rather than built at deploy so a
release never depends on a font server being reachable.

    pip install pillow
    python3 tools/og-card.py

Needs the two Heebo faces next to it or on the path given below. Heebo is the
face the site is set in; anything else on the card would be a second brand.
Fetch them once from the URLs in the Google Fonts CSS for Heebo 400 and 700.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PHOTO = ROOT / 'og-image.jpg'
OUT = ROOT / 'liver-next' / 'public' / 'og.jpg'
FONTS = Path('/tmp')  # where heebo400.ttf and heebo700.ttf were downloaded

NAME = 'ברק ליור'
TAGLINE = 'הפקת חתונות ואירועים'
GOLD = (176, 141, 87)  # --accent-line, decoration only
W, H = 1200, 630       # what every scraper expects, and what none of them crop


def build() -> None:
    img = Image.open(PHOTO).convert('RGB')
    if img.size != (W, H):
        img = img.resize((W, H), Image.LANCZOS)

    # A scrim over the lower half only, so the photograph stays a photograph
    # and the type still holds at the size a phone renders this.
    scrim = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(scrim)
    for y in range(H):
        t = max(0.0, (y - H * 0.42) / (H * 0.58))
        d.line([(0, y), (W, y)], fill=int(205 * (t ** 1.6)))
    img = Image.composite(Image.new('RGB', (W, H), (10, 12, 18)), img, scrim)

    draw = ImageDraw.Draw(img)
    bold = ImageFont.truetype(str(FONTS / 'heebo700.ttf'), 66)
    reg = ImageFont.truetype(str(FONTS / 'heebo400.ttf'), 34)

    # Set against the right edge, which is where this language starts.
    # direction='rtl' needs Pillow built with raqm; without it the letters
    # come out reversed and it is not subtle.
    m, base = 72, H - 96
    draw.text((W - m, base - 96), NAME, font=bold, fill=(255, 255, 255),
              anchor='ra', direction='rtl', language='he')
    draw.text((W - m, base - 8), TAGLINE, font=reg, fill=(226, 232, 240),
              anchor='ra', direction='rtl', language='he')
    draw.rectangle([W - m - 84, base + 56, W - m, base + 59], fill=GOLD)

    img.save(OUT, 'JPEG', quality=86, optimize=True, progressive=True)
    print(f'{OUT} {OUT.stat().st_size // 1024}KB')


if __name__ == '__main__':
    build()
