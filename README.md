# paktaxcalculator.net

Static site for [paktaxcalculator.net](https://paktaxcalculator.net) — free Pakistan tax calculators.

## Pages

| File | Calculator |
|---|---|
| `index.html` | Homepage / calculator directory |
| `income-tax.html` | Income tax (salaried, business/AOP, company) + Section 82 residency checker |
| `withholding-tax.html` | Income tax withholding (WHT) |
| `sales-tax-gst.html` | Federal GST on goods (FBR) |
| `sales-tax-withholding.html` | Sales tax withholding (FBR + all provinces + ICT) |
| `sales-tax-punjab.html` | Punjab sales tax on services (PRA) |
| `sales-tax-sindh.html` | Sindh sales tax on services (SRB) |
| `sales-tax-kpk.html` | Khyber Pakhtunkhwa sales tax on services (KPRA) |
| `sales-tax-balochistan.html` | Balochistan sales tax on services (BRA) |
| `sales-tax-ict.html` | Islamabad sales tax on services (ICT) |
| `about.html` | About |
| `privacy.html` | Privacy policy |

## Structure

Each page is a self-contained static HTML file with inline CSS and JavaScript — no build step, no dependencies. Netlify publishes the repository root as-is.

Supporting files: `sitemap.xml`, `robots.txt`, `ads.txt` (AdSense publisher verification).

## Newsletter prompt behavior

`index.html` includes a scroll-triggered newsletter prompt that appears after roughly 45% page scroll and stores the visitor's dismiss/submit choice in `localStorage` so it is not shown repeatedly.

The current implementation is client-side only. To collect real subscriptions, connect the form submit handler to a newsletter backend/provider endpoint (for example, via a Netlify Function) and persist the email server-side.

## Deployment

Netlify builds from this repository. Publish directory is the repo root; there is no build command.

## Disclaimer

Rate data is compiled from federal and provincial finance acts and revenue-authority schedules. Rates change frequently — the calculators are for estimation only and are not a substitute for professional tax advice.
