# Saved canvas reference

The user supplied `Cloud-Menu UI Design System & Screens.html` on 31 October 2026 after the online Claude artifact was inaccessible. `tools/unpack-design-reference.py` decodes its data islands without executing embedded JavaScript. The ignored `.artifacts/design-reference` directory contains Guest flow, Owner portal, Design system, Kitchen & waiter screen, Owner dashboard (sample data), and Tables & QR generator.

Use the authored CSS and layout as the visual reference. The fixed canvas board dimensions describe compositions; application layouts must reflow for narrow, folded and unfolded screens. Actual QR matrices replace the canvas checkerboard placeholders. All pictured venue names, orders, payment states and dashboard numbers are samples, never production fixtures or aggregate results.

The export embeds unchanged Google Fonts assets with SIL Open Font License notices. The Latin variable font subsets for Cormorant Garamond and Manrope are self-hosted in `packages/ui/src/fonts`, with the full supplied notices. Font display uses swap. English and Swahili use the covered Latin characters.

The export includes inconsistent older labels (Plus Jakarta Sans, Lagoon, Night Lounge/Fresh Café/Grill House). Its actual CSS sets Cormorant Garamond and Manrope and the requested Noir & Gold hex values. Follow those rendered styles and the user's explicit four theme names. The claim that white on #C9A24B has 5.4:1 contrast is incorrect: use measured dark foreground text. Several sample chips are smaller than 44 px and captions are 10 px; production controls must meet the requested 44 px targets and remain legible when text is enlarged. Payment logos in the sticker example do not establish provider availability.
