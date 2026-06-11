# StorySense

A small JavaScript library for composing narrative visualizations from focused, single-purpose pieces. No framework and build step.

```js
SS.storysense('#chart', story)
  .add(SS.tooltip())
  .add(SS.timeline())
  .add(SS.participants())
  .add(SS.lifelines())
  .render();
```

## Contents

1. [Install](#install)
2. [Demos and examples](#demos-and-examples)
3. [Quick start](#quick-start)
4. [Your data](#your-data)
5. [Sizing the chart](#sizing-the-chart)
6. [Chart options](#chart-options)
7. [Primitives](#primitives)
   - [Foundation](#foundation): `tooltip`, `timeline`
   - [On the timeline](#on-the-timeline): `events`, `participants`, `lifelines`, `edges`
   - [Standalone views](#standalone-views): `network`, `locations`, `movement`
8. [Custom primitives](#custom-primitives)
9. [Reference](#reference)

## Install

Two ways to load the library. Both pull D3 in automatically.

**From a CDN** (requires an internet connection):

```js
import SS from 'https://cdn.jsdelivr.net/gh/madalenaye/storysense-library@main/src/index.js';
```

**Local** (clone the repo, then reference the folder):

```js
import SS from './storysense-library/src/index.js';
```

Named imports also work:

```js
import { storysense, normalizeNarrative, tooltip, timeline }
  from 'https://cdn.jsdelivr.net/gh/madalenaye/storysense-library@main/src/index.js';
```

## Demos and examples

**Live demo:** see the library in action at **<https://madalenaye.github.io/storysense-library/>**

Two pages are bundled with the repo so you can see the library in action before wiring it into your own project:

- **Primitives** at [`primitives/index.html`](primitives/index.html) — reference page. Each primitive (`timeline`, `events`, `participants`, `lifelines`, `edges`, `network`, `locations`, `movement`) rendered on its own, with the dependencies it needs and the keys it provides.
- **Examples** at [`examples.html`](examples.html) — gallery of every meaningful primitive stack rendered side by side, each with the exact source snippet used to build it. Use it to pick a starting point and copy the code into your project.

Sample stories live in [`stories/`](stories/) and the JSON schema is in [`narrative.schema.json`](narrative.schema.json).

## Quick start

A minimal chart with a horizontal timeline, participant lanes, and lifelines:

```js
// 1. Load a story and normalize it. Always do this before rendering.
const raw   = await fetch('./story.json').then(r => r.json());
const story = SS.normalizeNarrative(raw);

// 2. Create a chart bound to a container element.
//    `responsive` re-renders on resize. `aspectRatio` is width / height.
SS.storysense('#chart', story, { responsive: true, aspectRatio: 860/460 })
  // 3. Stack primitives in draw order. Each one declares what it needs;
  //    you'll get a clear error if you add them out of order.
  .add(SS.tooltip())                                                          // hover popups
  .add(SS.timeline({ direction: 'x' }))                                       // time axis
  .add(SS.participants({ layout: 'lane', side: 'above', r: 14, labels: true })) // one avatar per appearance
  .add(SS.lifelines())                                                        // line through each participant's nodes
  .render();
```

What happens at each step:

1. **Normalize:** `normalizeNarrative(raw)` resolves the id references in your JSON, orders events by `story.eventIds`, and assigns each participant a stable colour. See [Your data](#your-data).
2. **Create:** `storysense(container, story, opts)` builds the chart.
3. **Compose:** Each `.add(...)` stacks a primitive. Order matters because primitives depend on values published by earlier ones.
4. **Render:** `.render()` draws everything.

## Your data

Stories are plain JSON. The full schema lives in `narrative.schema.json`. Here is a small example with all the required fields:

```json
{
  "title": "Little Red Riding Hood",
  "story": {
    "title": "Little Red Riding Hood",
    "eventIds": ["e1", "e2"]
  },
  "participants": [
    { "id": "red",  "name": "Red Riding Hood", "domain": "INDIVIDUAL" },
    { "id": "wolf", "name": "The Wolf",        "domain": "INDIVIDUAL" }
  ],
  "locations": [
    { "id": "forest", "name": "The Forest", "type": "PHYSICAL" }
  ],
  "times": [
    { "id": "t1", "value": "Morning", "type": "TIME" }
  ],
  "events": [
    {
      "id": "e1",
      "title": "Into the Woods",
      "timeId": "t1",
      "locationId": "forest",
      "participations": [
        { "entryOrder": 1, "participantId": "red", "role": "PROTAGONIST" }
      ],
      "interactions": []
    },
    {
      "id": "e2",
      "title": "The Encounter",
      "timeId": "t1",
      "locationId": "forest",
      "participations": [
        { "entryOrder": 1, "participantId": "red",  "role": "PROTAGONIST" },
        { "entryOrder": 2, "participantId": "wolf", "role": "ANTAGONIST"  }
      ],
      "interactions": [
        {
          "temporalOrder": 1,
          "fromParticipantId": "wolf",
          "toParticipantId": "red",
          "action": "threatens",
          "description": "The wolf blocks the path.",
          "sentiment": "NEGATIVE"
        }
      ]
    }
  ]
}
```

### Field values

| Field | Allowed values |
|---|---|
| `participant.domain` | `INDIVIDUAL`, `SET`, `OBJECT` |
| `location.type` | `PHYSICAL`, `TRANSITIONAL`, `VIRTUAL`, `METAPHYSICAL` |
| `time.type` | `DATE`, `TIME`, `DURATION`, `SET` |
| `participation.role` | `PROTAGONIST`, `ANTAGONIST`, `HELPER`, `VICTIM`, `WITNESS`, `MENTOR`, `FOIL`, `DONOR`, `PROP` |
| `participation.presenceType` | `ACTIVE`, `PASSIVE`, `MENTIONED` (optional) |
| `interaction.sentiment` | `POSITIVE`, `NEGATIVE`, `NEUTRAL` (optional) |

### Two ordering rules

- `entryOrder` and `temporalOrder` are integers that sort participations and interactions inside an event. They do not need to be consecutive.
- The visualization order of events comes from `story.eventIds`, not from the order of the `events` array. You can define events in any order and sequence them separately.

### Why `normalizeNarrative()` is required

Always pass raw JSON through `normalizeNarrative()` before rendering. It does three things the primitives depend on:

1. **Resolves id references.** `locationId: "forest"` becomes `location: { id: "forest", name: "The Forest", ... }`. The same applies to `timeId`, `participantId`, `fromParticipantId`, and `toParticipantId`. Primitives work with resolved objects, never raw ids.
2. **Sorts by story order.** Events follow `story.eventIds`. Participations sort by `entryOrder`. Interactions sort by `temporalOrder`.
3. **Assigns a colour palette.** Each participant gets a stable colour from Tableau 10, based on its index in `participants`. Primitives read it via `data.colorOf(participantId)`.

## Sizing the chart

`aspectRatio` controls the chart shape as `width / height`. Two presets cover most cases:

```js
const LANDSCAPE = 860 / 460;  // wide, pairs with direction: 'x'
const PORTRAIT  = 460 / 860;  // tall, pairs with direction: 'y'
```

Use `responsive: true` together with `aspectRatio` so the chart fills its container and scales on resize without distorting.

For a fixed-size chart, pass `width` and `height` directly and omit both `responsive` and `aspectRatio`.

## Chart options

`storysense(container, story, opts)`

| Option | Default | What it does |
|---|---|---|
| `responsive` | `false` | Re-renders when the container resizes |
| `aspectRatio` | none | Width-to-height ratio, e.g. `860/460` |
| `width` | `null` | Fixed width in px (use together with `height`) |
| `height` | `500` | Fixed height in px |
| `padding` | `{top,right,bottom,left: 0}` | Inner whitespace in px |
| `axisRatio` | auto | Fractional position of the time axis. `0` = top/left edge, `1` = bottom/right edge. Computed from participant count and `participants()` settings. Set manually only to override. |

Call `api.destroy()` to clean up the `ResizeObserver` when removing the chart from the DOM.

## Primitives

A primitive is a small object that draws one type of mark. Each one declares what it `needs` from earlier primitives, and what it `provides` to later ones. If a primitive needs something that hasn't been added yet, `render()` throws a clear error.

### Dependency overview

```
tooltip()      provides: tooltip
timeline()     provides: sceneX, sceneY, direction
  events()       needs: sceneX, sceneY
  participants() needs: sceneX, sceneY, direction  |  provides: charPos, charRadius
    lifelines()    needs: charPos
    edges()        needs: charPos
network()      provides: charPos, charRadius
  edges()        needs: charPos
locations()    provides: locPos, locDotPos
  movement()     needs: locPos
```

### Foundation

#### `tooltip()`

Add this first. Every other primitive detects its presence and shows tooltips on hover automatically. No configuration.

```js
.add(SS.tooltip())
```

#### `timeline(opts)`

Draws the time axis with one tick per event. Foundation for `events()`, `participants()`, `lifelines()`, and `edges()`.

```js
.add(SS.timeline({ direction: 'x' }))
```

| Option | Default | What it does |
|---|---|---|
| `direction` | `'x'` | `'x'` for horizontal, `'y'` for vertical |
| `margin` | `80` | Space in px before the first tick and after the last |
| `stroke` | `'#d1d5db'` | Axis line and tick colour |
| `tickRadius` | `2` | Tick dot radius. `0` hides ticks. |
| `times` | `true` | Show the time label for each event |
| `labelSide` | `'below'` | Side of the axis for time labels: `'below'` or `'above'` |
| `showLocations` | `false` | Colour-code axis segments by event location and label each run. Requires `locations` in the data. |

When `showLocations` is `true`, each segment between location changes is coloured. Labels sit on the opposite side from `labelSide` and stagger across up to three rows so they don't overlap.

### On the timeline

These primitives all build on `timeline()`.

#### `events(opts)`

Places a marker at each event's position on the axis. Hover shows the event title, time, and description.

```js
.add(SS.events({ shape: 'dot', r: 5 }))
```

| Option | Default | What it does |
|---|---|---|
| `shape` | `'dot'` | `'dot'` or `'pin'` |
| `r` | `6` | Marker radius in px |
| `fill` | `'#6366f1'` | Colour string, or `fn(event, index) => colour` |
| `titles` | `false` | Show the event title next to each marker |
| `onClick` | `null` | `fn(event, index)` called on click |

#### `participants(opts)`

Draws one avatar node per participant, per event they appear in.

Two layout modes:

- **`lane`**: each participant occupies a fixed parallel track. Clean and predictable. Pairs naturally with `lifelines()`.
- **`force`**: participants cluster around each event position via a D3 force simulation. Nodes are draggable.

```js
.add(SS.participants({ layout: 'lane', side: 'above', r: 14, labels: true }))
```

| Option | Default | What it does |
|---|---|---|
| `layout` | `'lane'` | `'lane'` or `'force'` |
| `r` | `16` | Node radius in px. Reduced automatically if space is tight. |
| `laneSpacing` | `38` | Gap between lane centres in px (lane only). Reduced automatically if needed. |
| `side` | `'above'` | Where lanes sit relative to the axis: `'above'`, `'below'`, `'both'` (alternates) |
| `color` | palette | `fn(participant) => colour` |
| `icons` | `true` | Show avatar images (fetched from DiceBear) |
| `iconStyle` | `'notionists'` | Any [DiceBear](https://www.dicebear.com/styles/) style slug |
| `iconUrl` | `null` | `fn(participant) => imageURL`. Overrides `iconStyle` when set. |
| `labels` | `true` | Show participant name labels (lane mode only) |
| `onClick` | `null` | `fn(participant, eventIndex)` called on click |
| `perpDistance` | `70` | Force only: target distance above/below the axis in px |
| `axisStrength` | `0.9` | Force only: how tightly nodes snap to their event's axis position. Lower = more spread. |

`axisRatio` (where the axis sits) is calculated automatically from the participant count, `laneSpacing`, and `side`. You rarely need to set it yourself.

#### `lifelines(opts)`

Connects each participant's nodes with a continuous line through all events. Gaps where a participant is absent appear as dashes.

```js
.add(SS.lifelines({ strokeWidth: 2, opacity: 0.6 }))
```

| Option | Default | What it does |
|---|---|---|
| `stroke` | palette | `fn(participant) => colour` |
| `strokeWidth` | `1.5` | Line width in px |
| `opacity` | `0.4` | Line opacity |
| `dash` | `'4,4'` | SVG dash pattern for absent segments |

#### `edges(opts)`

Draws curved arrows between participants for each interaction in an event. When two participants interact in both directions, the arcs curve to opposite sides automatically.

```js
.add(SS.edges({ arrow: true, curvature: 28 }))
```

| Option | Default | What it does |
|---|---|---|
| `stroke` | `'#666'` | Arc colour |
| `strokeWidth` | `2` | Width in px |
| `opacity` | `0.6` | Arc opacity |
| `arrow` | `true` | Show arrowhead at the target end |
| `curvature` | `30` | How strongly opposing arcs bend away from each other |
| `global` | `false` | Aggregate interactions across all events instead of per-event. Useful with `network()`. |

### Standalone views

These primitives stand on their own and do not need `timeline()`.

#### `network(opts)`

Places all participants in a force-directed layout. No time axis. Node size scales with how many events each participant appears in (more appearances, larger node). Nodes are draggable. Pair with `edges({ global: true })` to show interactions.

```js
.add(SS.network({ r: 20, labels: true }))
.add(SS.edges({ global: true, arrow: false }))
```

| Option | Default | What it does |
|---|---|---|
| `r` | `18` | Base radius in px (scaled per participant by appearance count) |
| `color` | palette | `fn(participant) => colour` |
| `icons` | `true` | Show avatar images |
| `iconStyle` | `'notionists'` | DiceBear style slug |
| `iconUrl` | `null` | `fn(participant) => imageURL` |
| `labels` | `true` | Show name labels |
| `charge` | `-300` | Repulsion between nodes |
| `linkDist` | `100` | Target distance between connected nodes |
| `onClick` | `null` | `fn(participant)` called on click |

#### `locations(opts)`

Draws one node per location that appears in at least one event, arranged in a draggable circular layout. Each node shows a small dot per event held there. Drag a node to rearrange the map; `movement()` paths update live.

```js
.add(SS.locations({ r: 30, labels: true }))
.add(SS.movement({ arrow: true }))
```

| Option | Default | What it does |
|---|---|---|
| `r` | `28` | Node radius in px |
| `fill` | `'#fef9ee'` | Node background colour |
| `stroke` | `'#e0b97a'` | Node border colour |
| `labels` | `true` | Show location names above each node |
| `margin` | `80` | Edge gap for the automatic circle layout |
| `positions` | `null` | Manual layout override: `{ locationId: { x, y }, ... }` |

#### `movement(opts)`

Draws Bezier arcs between locations in narrative order, showing how the story moves through space. Same-location arcs loop below the node. Hover an arc to see which events it connects. Must be added after `locations()`.

```js
.add(SS.movement({ arrow: true, curvature: 25 }))
```

| Option | Default | What it does |
|---|---|---|
| `stroke` | `'#999'` | Arc colour |
| `strokeWidth` | `2` | Width in px |
| `opacity` | `0.7` | Arc opacity |
| `arrow` | `true` | Show a direction chevron at the arc midpoint |
| `curvature` | `25` | How strongly arcs bend. Higher = more pronounced curve. |

## Custom primitives

A primitive is a plain object with four properties. No class, no registration, no build step.

`ctx` is the shared context passed to every primitive's `render` function:

- `ctx.get(key)` reads a value set by an earlier primitive.
- `ctx.set(key, value)` publishes a value for later primitives.
- `ctx.data` is the normalized story (the output of `normalizeNarrative()`).

Example: a gold halo on any event flagged with `"highlight": true` in the JSON.

```js
const highlights = {
  id:       'highlights',           // unique name, used in error messages
  needs:    ['sceneX', 'sceneY'],   // must be added after timeline()
  provides: [],                     // gives nothing to later primitives

  render(ctx) {
    const layer  = ctx.get('layer')('overlay');  // draw on top of everything
    const sceneX = ctx.get('sceneX');            // fn(eventIndex) -> x px
    const sceneY = ctx.get('sceneY');            // fn(eventIndex) -> y px

    ctx.data.events.forEach((event, i) => {
      if (!event.highlight) return;
      layer.append('circle')
        .attr('cx', sceneX(i)).attr('cy', sceneY(i))
        .attr('r', 14).attr('fill', 'gold').attr('opacity', 0.5);
    });
  },
};

SS.storysense('#chart', story, opts)
  .add(SS.tooltip())
  .add(SS.timeline())
  .add(highlights)   // already an object, no parentheses
  .render();
```

In your story JSON, mark whichever events you want highlighted:

```json
{ "id": "e3", "title": "The Encounter", "highlight": true, ... }
```

### Showing a tooltip from a custom primitive

```js
render(ctx) {
  const tt    = ctx.get('tooltip');
  const svgEl = ctx.get('svg').node();

  layer.append('circle')
    .on('mousemove', function(e) {
      if (!tt) return;
      const rect = svgEl.parentElement.getBoundingClientRect();
      tt.show(e.clientX - rect.left, e.clientY - rect.top, '<strong>Hello</strong>');
    })
    .on('mouseleave', () => tt?.hide());
}
```

## Reference

### Context keys

| Key | Type | Set by |
|---|---|---|
| `svg` | D3 `<svg>` selection | core |
| `layer` | `fn(name) -> D3 <g>` | core |
| `tooltip` | `{ show(x, y, html), hide() }` | `tooltip()` |
| `sceneX` | `fn(eventIndex) -> px` | `timeline()` |
| `sceneY` | `fn(eventIndex) -> px` | `timeline()` |
| `direction` | `'x'` or `'y'` | `timeline()` |
| `charPos` | `fn(participantId, eventIndex) -> {x, y}` | `participants()` or `network()` |
| `charRadius` | `number` | `participants()` or `network()` |
| `locPos` | `fn(locationId) -> {x, y}` | `locations()` |
| `locDotPos` | `fn(eventIndex) -> {x, y}` | `locations()` |

### Layer order

Drawn back to front: `background`, `paths`, `edges`, `nodes`, `pins`, `labels`, `overlay`.
