# Velan Concast Quotation Generator

A React + Vite application that reproduces the original Velan Concast quotation templates.

## Flow

1. Splash screen (Velan Concast logo, ~2s)
2. Product selection (Water Tank / Septic Tank)
3. Capacity selector (from the supplied templates)
4. Quotation editor (only editable fields)
5. Live preview (exact quotation layout)
6. Generate PDF (A4 portrait) → `Quotation_[QuoteNo].pdf`

## Editable fields

- Bill To
- Ship To
- Quote No
- Quote Given By
- Quote Date (date picker, DD.MM.YYYY) — Expiry Date auto = +10 days
- Customer Number
- Tank Capacity (Qty)
- Rate (Amount/Sub Total/GST/Total recalculate)
- Transportation Charge
- Crane Charge

## Calculations

- Amount = Qty × Rate × Nos
- Sub Total = sum of item amounts
- GST = Sub Total × 18%
- Total = Sub Total + GST
- Expiry Date = Quote Date + 10 days

## Data storage

Quotation data is auto-saved to `localStorage`. Buttons are available in the editor:
Save Draft, Restore Draft, Clear Draft.

## Run

```bash
npm install
npm run dev
```

Templates data lives in `src/data/waterTankTemplates.js` and `src/data/septicTankTemplates.js`, derived from the supplied quotation files.
