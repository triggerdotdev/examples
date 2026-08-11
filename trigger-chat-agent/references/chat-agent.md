# Chat agent visual contract

This file pins the Trigger.dev chat agent values used with the Marketing v3 `design-quality` principles.

## Type scale

Ratio: 1.25, rooted at 16px.

| Role | Size | Line height |
| --- | ---: | ---: |
| Metadata | 10px | 16px |
| Label | 12px | 16px |
| Control | 14px | 20px |
| Body | 16px | 26–28px |
| Card title | 20–25px | 24–30px |
| Lesson lead | 31px | 34px |
| Empty-state display | 39–49px | 42–52px |

Satoshi is used for display and headings, Geist for prose and controls, and Geist Mono for code, stats, and uppercase metadata. Prose is capped at 65ch; compact card copy at 55ch.

## Spacing rhythm

All layout uses the 4/8px scale: 4, 8, 12, 16, 24, 32, 48, and 64px. The chat column is 52rem wide with 16px mobile and 24px desktop gutters. Card padding is 20px mobile and 24–32px desktop.

## Radius ladder

- 8px: small nested controls and code tokens
- 12px: buttons, options, and graph nodes
- 16px: composer and teaching cards
- 999px: status dots, avatars, and true chips only

Nested elements step down one rung from their container.

## Card sizing

- Lead topic card: minimum 224px
- Quiz, steps, glossary, compare, prompt, and code cards: content-sized with bounded internal overflow for code/media
- Stat card: minimum 256px
- Flow graph canvas: 180–480px, computed from graph bounds
- Linear diagram: fixed 112px track beneath a 48px header

Variable educational content must remain complete; bounded code and graph regions scroll or pan rather than stretching the conversation column.

## Color budget

- Background and hierarchy: charcoal scale
- Apple: primary interaction, focus, and emphasis; no more than one dominant apple action per view
- Lavender: user-authored message only
- Amber/rose: warning and error states only
- Body text never falls below charcoal-500 on charcoal-1000

## Motion

- Hover/focus feedback: 150–200ms
- Message/card arrival: 200–300ms ease-out
- Multi-element reveal: ≤700ms total
- No blur, bounce, or decorative looping; status pulses are the only repeating motion

## Signature

UX axis: a conversational answer resolves into a live, validated teaching component. All other surfaces remain deliberately restrained.
