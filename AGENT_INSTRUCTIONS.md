# Fyodor Trading Terminal Agent Instructions

## Project Intent

Build a new streamlined app in `C:\dev\Fyodor Trading Terminal\Main`.

This is a separate app from `C:\dev\alternate_version`.

Do not duplicate the full reference app blindly. Reuse logic selectively where useful, but treat this project as a new product with its own structure and UX.

## Reference App

The folder `C:\dev\alternate_version` is the full-feature reference app.

Use it only as a source of business logic, data flow ideas, and feature reference for:

- charts integration
- economic calendar integration
- central bank data handling

## Non-Negotiable UI Rule

The new streamlined app must have a completely different UI from `C:\dev\alternate_version`.

That means:

- do not preserve the old layout
- do not preserve the old visual style
- do not preserve the old component composition
- do not copy the old dashboard/card patterns
- do not "refresh" the old UI lightly
- do not inherit the same spacing, colors, tab styling, or page structure

Only reuse behavior and logic where appropriate. The interface should feel like a different product.

## UI Design Constraints

Use the `uncodixfy` skill for all frontend/UI work when available.

Also follow the local rule file strictly:

- `C:\dev\Fyodor Trading Terminal\Uncodixfy\Uncodixfy.md`

Practical interpretation:

- avoid default AI dashboard styling
- avoid glossy/glassmorphism/floating-card aesthetics
- avoid oversized radii and decorative gradients
- prefer compact, trader-grade, tool-like layouts
- prioritize functional density and clarity over decorative polish

## Product Scope

The new app should contain exactly 4 primary tabs:

1. Home / Dashboard
2. Charts
3. Central Banks
4. Economic Calendar

## Functional Priorities

### 1. Home / Dashboard

A new dashboard designed specifically for the streamlined app.

This should not reuse the old dashboard UI.

### 2. Charts

Charts should remain functionally similar to the existing app:

- MT5 bridge integration
- symbol selection
- timeframe selection
- live/fallback behavior

UI can and should be redesigned, but chart functionality should stay close to the current implementation.

### 3. Central Banks

This page should focus on central bank data and rate/CPI state.

Important: economic calendar data should be automated into central bank data where possible.

This is a core purpose of the new streamlined app.

### 4. Economic Calendar

Keep the economic calendar as a primary tab, but redesign it fully.

It should continue to support bridge-backed data when available and fallback/mock handling when needed.

## Architecture Guidance

Preferred approach:

- start fresh in `C:\dev\Fyodor Trading Terminal\Main`
- copy only logic that is worth keeping
- extract reusable services instead of cloning whole screens
- keep UI code separate from imported business logic where possible

Reuse candidates from the reference app:

- `C:\dev\alternate_version\src\app\charts.tsx`
- `C:\dev\alternate_version\src\app\chartsApi.ts`
- `C:\dev\alternate_version\src\app\economic-calendar.tsx`
- `C:\dev\alternate_version\src\app\economicCalendarRanges.ts`
- `C:\dev\alternate_version\src\app\economicCalendarMock.ts`
- `C:\dev\alternate_version\src\app\utils\parseRates.ts`

These files are references for logic and integration, not UI templates.

## Working Rule

Before implementation:

- inspect the reference app
- propose a concrete implementation plan
- get approval before major coding if requested by the user

When implementing:

- preserve only the logic worth keeping
- rebuild the interface from scratch
- do not drift back into the old app's UI patterns
