# QR code — SynRG '26 schedule

Points at **https://carynamichel-hue.github.io/synrg/**

| File | Use it for |
|------|-----------|
| `synrg-qr.svg` | **Printing.** Vector — sharp at any size, from a table card to a door poster. |
| `synrg-qr.png` | Anywhere that will not take an SVG — email, slides, a Word document. 1023 px square. |

**Error correction is level H (30 %)**, the highest: a scuff, a crease or glare
on a taped-up sheet should not stop it scanning.

## Printing it
- **Two inches square is the practical minimum**; the poster uses about 3.5.
- **Keep the white border.** Scanners need that empty margin.
- Keep it dark on white. The dark is the page's ink green-black (#1c2b21).

## If the URL ever changes
A QR cannot be edited, only remade: run `tools/poster/make.mjs` (see the
poster README). It rebuilds this code and the poster together and reads the
code back out of the finished pages.
