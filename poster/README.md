# Printable poster — SynRG '26 schedule

**`poster-synrg-schedule.pdf`** — Letter, portrait, two pages:
**page 1 English, page 2 Spanish.** Print whichever you need, or both.

Also live, so it prints from any machine:
`carynamichel-hue.github.io/synrg/poster/poster-synrg-schedule.pdf`

## What is on it
The QR code (about 3.5 in), the address spelled out for anyone whose camera
will not cooperate, and **How to use it** in six steps: scan (open the Camera,
*don't press the button*, tap the link), Right now + the day buttons, **pick
your working groups** (find your name, tap I'm going for Session 1 and
Session 2), the map, the ride labels, and Who to meet. The footer points
Spanish speakers at the Español button.

## Printing
Just print the `.pdf`. If the print dialog asks, **leave "background
graphics" on** (otherwise the green panel and numbered circles disappear) and
**don't shrink it** with "fit to page" — a smaller page means a smaller code.

## Changing the wording
Edit the text in `tools/poster/make.mjs` and run it; it rewrites the `.html`,
the `.pdf`, the two `printview-*.png` pictures and the code in `../qr/`, then
decodes the code out of each finished page. It needs `npm i qrcode jsqr pngjs`
in the folder you run it from and headless Chrome on port 9336.
`tools/poster/pdf2png.ps1` renders the PDF pages to pictures with Windows'
own PDF engine, as a second check.

## Before you print a stack
**Scan it with a real phone.** The code was read back out of both PDF pages
and matched the address, but that is a computer reading a file — a phone
reading paper is the test that counts.
