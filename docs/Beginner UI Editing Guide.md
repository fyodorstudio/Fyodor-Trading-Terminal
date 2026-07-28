# Beginner UI Editing Guide For Fyodor

This is a practical reading guide for learning how this repo turns words in files into visible UI. It uses real examples from Fyodor, not toy examples.

You do not need to understand everything at once. The useful first skill is this:

> Find the visible text or class name, identify the file that renders it, then change one small thing and check the app.

## The Mental Model

Fyodor's frontend is mostly:

- `*.tsx` files: the screen structure and behavior.
- `*.ts` files: helper logic, data formatting, calculations, types.
- `*.css` files: reusable styling rules that are too large or awkward to keep inline.
- Tailwind classes inside `className="..."`: small styling words directly attached to an element.

Example:

```tsx
<button className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700 hover:bg-blue-100">
  See recent releases
</button>
```

This creates a button. The words inside `className` control the look.

- `rounded-xl`: corner roundness
- `border`: show a border
- `border-blue-100`: pale blue border
- `bg-blue-50`: pale blue background
- `px-4 py-3`: horizontal and vertical padding
- `text-sm`: text size
- `font-black`: very bold text
- `hover:bg-blue-100`: change background when the cursor hovers it

## Where To Start Looking

For active UI work, start with these:

- `Main/src/app/tabs/primary/OverviewPlaceholderTab.tsx`
- `Main/src/app/components/OverviewPairSummary.tsx`
- `Main/src/app/components/OverviewPopovers.tsx`
- `Main/src/app/tabs/secondary/EventReplayTab.tsx`
- `Main/src/app/components/EventReplayBriefModal.tsx`
- `Main/src/app/components/EventReplayReleaseListModal.tsx`
- `Main/src/app/components/EventReplaySelectEventModal.tsx`
- `Main/src/app/tabs/primary/ChartsTab.tsx`
- `Main/src/app/components/ChartSettingsDrawer.tsx`
- `Main/src/app/components/ChartSettingsSections.tsx`
- `Main/src/app/components/TabNavigation.tsx`
- `Main/src/app/config/navigation.ts`
- `Main/src/styles.css`
- `Main/src/styles/`

Avoid using garbage files as examples unless you explicitly want to revive an old experiment.

## How To Change A Color

Real example: Overview button in `Main/src/app/components/OverviewPairSummary.tsx`.

Search for:

```tsx
See recent releases
```

You will find a button with classes like:

```tsx
className="inline-flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700 transition hover:border-blue-200 hover:bg-blue-100"
```

To change the still/default color:

- `bg-blue-50` controls the normal background.
- `text-blue-700` controls the normal text.
- `border-blue-100` controls the normal border.

To change hover color:

- `hover:bg-blue-100` controls the background when hovered.
- `hover:border-blue-200` controls the border when hovered.

Try changing:

```tsx
bg-blue-50 text-blue-700 hover:bg-blue-100
```

to:

```tsx
bg-slate-950 text-white hover:bg-blue-700
```

That makes the button dark by default and blue on hover.

## Hover, Still, Selected, Disabled

These are common UI states:

- Still/default: what it looks like normally.
- Hover: when the cursor is over it.
- Selected/active: when it represents the current selection.
- Disabled: when it cannot be clicked.

Real example: chart event marker CSS in `Main/src/styles/15-charts.css`.

Search for:

```css
.chart-event-marker:hover
```

You will see selectors like:

```css
.chart-event-marker:hover .chart-event-line,
.chart-event-marker.is-active .chart-event-line,
.chart-event-marker:focus-visible .chart-event-line {
  width: 2px;
}
```

Read this as:

- When `.chart-event-marker` is hovered, make the child `.chart-event-line` wider.
- When `.chart-event-marker` has the class `.is-active`, do the same.
- When keyboard focus is visible, do the same.

In React, active classes are usually added with conditions:

```tsx
className={active ? "is-active" : ""}
```

or:

```tsx
className={`${active ? "bg-slate-950 text-white" : "bg-white text-slate-700"}`}
```

## How To Change The Active Tab Jelly Animation

Real file:

```txt
Main/src/app/components/TabNavigation.tsx
```

Search for:

```tsx
layoutId="activeTabIndicator"
```

You will find:

```tsx
<motion.div
  layoutId="activeTabIndicator"
  className="absolute inset-0 bg-[var(--tab-active-bg)] shadow-md z-0 rounded-xl"
  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
/>
```

Important parts:

- `motion.div` means this uses Framer Motion animation.
- `layoutId="activeTabIndicator"` tells Framer Motion that the same blue pill is moving between tabs.
- `transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}` controls the jelly feeling.

If you want more jelly:

```tsx
transition={{ type: "spring", bounce: 0.35, duration: 0.7 }}
```

If you want sharper/snappier:

```tsx
transition={{ type: "spring", bounce: 0.05, duration: 0.35 }}
```

## How To Change Specialist Tools Dropdown

There are two places:

1. Labels and order:

```txt
Main/src/app/config/navigation.ts
```

Example:

```ts
export const ANALYSIS_TAB_ORDER = [
  { id: "dashboard", label: "DIFFERENTIAL CALCULATOR", groupLabel: "Active Tool" },
  { id: "macro-drivers", label: "MACRO DRIVERS", groupLabel: "Active Tool" },
  { id: "event-tools", label: "EVENT REPLAY", groupLabel: "Active Experiment" },
  { id: "prototyping", label: "PROTOTYPING", groupLabel: "Garbage / Ignore" },
];
```

Change labels here if you want the dropdown text to change.

2. Dropdown behavior and styling:

```txt
Main/src/app/components/TabNavigation.tsx
```

Search for:

```tsx
tab.children!.map
```

That area renders each child button in the Specialist Tools dropdown.

## How To Edit A Popover Or Modal

First identify which popover you mean.

Overview:

- `OverviewReleasePopover` lives in `Main/src/app/components/OverviewPopovers.tsx`
- `OverviewPairDetailsModal` lives in `Main/src/app/components/OverviewPopovers.tsx`

Event Replay:

- `EventReplayBriefModal.tsx`
- `EventReplayReleaseListModal.tsx`
- `EventReplaySelectEventModal.tsx`

Example: if you want to edit Pair Details, search:

```tsx
export function OverviewPairDetailsModal
```

Inside that function, the structure is usually:

```tsx
<div className="overlay">
  <section className="modal">
    <header>...</header>
    <div className="body">...</div>
  </section>
</div>
```

To add a section, add another block inside the body:

```tsx
<section>
  <h4>My New Section</h4>
  <p>Useful explanation here.</p>
</section>
```

To remove a section, delete the block that renders it, but be careful not to delete the closing tags for the modal.

## Why Is There Blank Space?

Blank space usually comes from one of these:

- `p-*`: padding inside a box.
- `m-*`: margin outside a box.
- `gap-*`: space between grid/flex children.
- `min-h-*`: minimum height.
- `h-[...]`: fixed/custom height.
- `flex-1`: this element expands to fill remaining space.
- `justify-between`: pushes items apart.
- `overflow-hidden` or `overflow-auto`: controls scrolling/cropping.

Real example:

```tsx
className="workspace-page workspace-page-compact flex h-[calc(100vh-98px)] min-h-[560px] flex-col gap-3 overflow-hidden"
```

This means:

- `h-[calc(100vh-98px)]`: height is the browser height minus 98 pixels.
- `min-h-[560px]`: never smaller than 560 pixels.
- `gap-3`: space between child sections.
- `overflow-hidden`: do not let the whole page scroll.

If a card feels too small:

- increase padding: `p-3` to `p-4` or `p-5`
- change grid widths: `lg:grid-cols-[380px_minmax(0,1fr)]`
- remove a restrictive max width: `max-w-*`
- increase modal width: `max-w-[1180px]` to `max-w-[1320px]`

If a card feels too empty:

- reduce padding: `p-5` to `p-3`
- reduce gap: `gap-4` to `gap-2`
- reduce text size: `text-xl` to `text-base`

## How To Fix Different Sized Boxes

Different sized boxes usually happen because the content inside them is different length.

Useful tools:

```tsx
grid
grid-cols-2
items-stretch
h-full
min-h-[120px]
line-clamp-2
overflow-hidden
```

Example:

```tsx
<div className="grid gap-3 lg:grid-cols-2">
  <section className="h-full min-h-[180px]">...</section>
  <section className="h-full min-h-[180px]">...</section>
</div>
```

This says both cards should stretch and have the same minimum height.

If text makes one box taller, either allow wrapping gracefully or clamp it:

```tsx
<p className="line-clamp-2">Long event title here</p>
```

Use clamping only when hiding extra text is acceptable.

## How To Add Cool Effects

There are two main ways.

### Simple CSS/Tailwind Effects

Use classes like:

```tsx
transition
transition-all
duration-300
hover:scale-[1.01]
hover:-translate-y-0.5
hover:shadow-md
active:scale-[0.99]
```

Example:

```tsx
className="rounded-xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
```

This makes a card lift slightly on hover and press down on click.

### Framer Motion Effects

Real file:

```txt
Main/src/app/components/CentralBanksViews.tsx
```

Search for:

```tsx
<motion.div
```

Example:

```tsx
<motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -10 }}
>
```

Read this as:

- `initial`: how it starts
- `animate`: how it settles
- `exit`: how it disappears

Other useful ideas:

```tsx
initial={{ opacity: 0, scale: 0.98 }}
animate={{ opacity: 1, scale: 1 }}
exit={{ opacity: 0, scale: 0.98 }}
```

or:

```tsx
initial={{ opacity: 0, x: 20 }}
animate={{ opacity: 1, x: 0 }}
exit={{ opacity: 0, x: -20 }}
```

Use motion for screen changes, modals, drawers, selected panels, and things that should feel spatial.

Use normal CSS hover classes for small button/card feedback.

## How To Think When You Do Not Know What You Want

Do not start with colors. Start with the job.

Ask:

1. What is the user trying to decide here?
2. What should they see first?
3. What is secondary and can be hidden behind a popover/modal?
4. What is repeated information?
5. What is noisy but still useful?
6. Does this fit at 100% Chrome zoom without whole-page scrolling?
7. Is this a scan surface, a detail surface, or an action surface?

Examples:

- Overview should be a scan surface. It should show a pair brief quickly.
- Pair Details should be a detail surface. It can show more rows and use internal modal scroll if needed.
- Event Replay should be an action/study surface. Pair, event, release, playback, and replay brief need a clear order.
- Charts should be an inspection surface. Too many badges or overlays can block the actual chart, so density matters.

## The Three UI Levers

When something feels ugly, usually one of these is wrong:

### 1. Hierarchy

The important thing does not look important enough, or everything is shouting.

Fix with:

- bigger title for primary value
- smaller labels
- less bold text on secondary details
- fewer borders
- clearer grouping

### 2. Density

There is too much or too little information in the space.

Fix with:

- compact rows
- popovers for details
- two-column layout
- internal scroll area
- removing repeated labels

### 3. Alignment

Things do not line up, so the eye gets tired.

Fix with:

- `grid`
- consistent `gap-*`
- consistent `p-*`
- same card heights
- clear left/right columns

## Good Search Habits

In VS Code, search the visible label first:

```txt
Select Event
Pair details
Specialist Tools
Replay Brief
Calendar Coverage
```

If that fails, search a class name from the browser inspector:

```txt
overview-factor-chip
chart-event-marker
calendar-empty-state
```

If that fails, search the route/component name:

```txt
OverviewPlaceholderTab
EventReplayTab
ChartsTab
TabNavigation
```

## How To Make A Safe Tiny Change

1. Pick one visible thing.
2. Find the file by searching the label.
3. Change one class, one label, or one small block.
4. Run the app or refresh the browser.
5. If it got worse, undo that one change.

Good first experiments:

- Change `bg-blue-50` to `bg-slate-50`.
- Change `p-4` to `p-3`.
- Change `gap-4` to `gap-2`.
- Add `hover:shadow-md`.
- Change `rounded-2xl` to `rounded-xl`.
- Change `text-xl` to `text-lg`.

Avoid as a beginner:

- renaming route ids
- editing files under `garbage`
- changing bridge code
- changing TypeScript types before understanding who uses them
- deleting CSS selectors globally
- moving files without updating imports

## Real Repo Translation Cheatsheet

```tsx
onClick={() => setPairDetailsOpen(true)}
```

Means: when clicked, open the Pair Details modal.

```tsx
{pairDetailsOpen ? <OverviewPairDetailsModal /> : null}
```

Means: show the modal only when `pairDetailsOpen` is true.

```tsx
items.map((item) => <Card key={item.id} />)
```

Means: repeat one card for every item.

```tsx
condition ? "bg-blue-50" : "bg-white"
```

Means: use one style if condition is true, otherwise another.

```tsx
disabled={!props.nextEvent}
```

Means: disable the button when there is no next event.

```tsx
className={`rounded-xl ${active ? "bg-slate-950 text-white" : "bg-white text-slate-700"}`}
```

Means: always use `rounded-xl`, then choose active or inactive colors.

## Best Beginner Rule

Do not try to understand the whole repo at once.

Understand one visible thing:

- What file renders it?
- What data does it show?
- What classes style it?
- What state opens/closes/changes it?

That is enough to start making real edits.
