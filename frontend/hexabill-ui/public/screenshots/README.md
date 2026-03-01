# Marketing screenshots

Place desktop and mobile screenshots here for the marketing site. See repo root **MARKETING_PAGE_SPEC.md** for the full brief.

## Filenames and features

| File | Feature |
|------|--------|
| `dashboard-desktop.png` | Main dashboard (tally cards, stats) |
| `dashboard-mobile.png` | Dashboard on mobile |
| `invoices-desktop.png` | Sales Ledger / invoices list |
| `branches-routes-desktop.png` | Branches & Routes page |
| `pos-desktop.png` | POS billing screen |
| `pos-mobile.png` | POS on mobile |
| `reports-desktop.png` | Reports page |
| `ledger-desktop.png` | Customer Ledger (optional) |

## Capture process

1. **Environment:** Run the app locally (or against staging) with a **demo tenant** that has sample branches, routes, products, and customers.
2. **Desktop:** Use a fixed viewport (e.g. 1280×720) or full screen. Capture each key screen listed above.
3. **Mobile:** Use browser DevTools device toolbar (e.g. iPhone 12, Pixel 5) or a real device. Capture at least Dashboard and POS.
4. **Video:** Screen record (e.g. OBS, Loom) following: **Login → Dashboard → (optional) Branches/Routes → Products → create one invoice → Reports.** Keep under 2 minutes. Save to `public/video/hexabill-demo.mp4` or host on YouTube/Vimeo and add the link to MARKETING_PAGE_SPEC.md.
5. Save files into this folder (`public/screenshots/`); video in `public/video/` if stored in repo.
