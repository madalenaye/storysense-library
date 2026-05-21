# storysense

Compose narrative visualizations from small, focused pieces. No framework or build step required.

## Import

**From CDN** (no download needed, requires an internet connection):

```js
import SS from 'https://cdn.jsdelivr.net/gh/madalenaye/storysense-library@main/src/index.js';
```

**Local** (clone the repo, then reference the folder):

```js
import SS from './storysense-library/src/index.js';
```

Named imports work too:

```js
import { storysense, normalizeNarrative, tooltip, timeline }
  from 'https://cdn.jsdelivr.net/gh/madalenaye/storysense-library@main/src/index.js';
```

D3 loads automatically from CDN either way.

---

## Quick start

```js
const raw   = await fetch('./story.json').then(r => r.json());
const story = SS.normalizeNarrative(raw);

SS.storysense('#chart', story, { responsive: true, aspectRatio: 860/460 })
  .add(SS.tooltip())
  .add(SS.timeline({ direction: 'x' }))
  .add(SS.characters({ layout: 'lane', side: 'above', r: 14, labels: true }))
  .add(SS.lifelines())
  .render();
```

---

## Aspect ratio

`aspectRatio` controls the shape of the chart as `width / height`. Two presets cover most cases:

```js
const LANDSCAPE = 860 / 460;  // ~1.87 — wide, good for horizontal timelines (direction: 'x')
const PORTRAIT  = 460 / 860;  // ~0.54 — tall, good for vertical timelines  (direction: 'y')
```

Use `responsive: true` together with `aspectRatio` so the chart fills its container and scales on resize without distorting. If you need a fixed size instead, pass `width` and `height` directly and omit both `responsive` and `aspectRatio`.

---

## Your data

Stories are plain JSON. The full schema is in `narrative.schema.json`. Below are the required fields for each type.

```json
{
  "title": "Little Red Riding Hood",
  "story": {
    "title": "Little Red Riding Hood",
    "eventIds": ["e1", "e2"]
  },
  "participants": [
    { "id": "red",  "name": "Red Riding Hood", "domain": "INDIVIDUAL" },
    { "id": "wolf", "name": "The Wolf",         "domain": "INDIVIDUAL" }
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

**Field reference**

| Field | Values |
|---|---|
| `participant.domain` | `INDIVIDUAL`, `SET`, `OBJECT` |
| `location.type` | `PHYSICAL`, `TRANSITIONAL`, `VIRTUAL`, `METAPHYSICAL` |
| `time.type` | `DATE`, `TIME`, `DURATION`, `SET` |
| `participation.role` | `PROTAGONIST`, `ANTAGONIST`, `HELPER`, `VICTIM`, `WITNESS`, `MENTOR`, `FOIL`, `DONOR`, `PROP` |
| `participation.presenceType` | `ACTIVE`, `PASSIVE`, `MENTIONED` (optional) |
| `interaction.sentiment` | `POSITIVE`, `NEGATIVE`, `NEUTRAL` (optional) |

`entryOrder` and `temporalOrder` are integers that set the order of participations and interactions within an event. They do not need to be consecutive.

Always pass raw JSON through `normalizeNarrative()` before rendering — it resolves all ID references and builds the internal maps each primitive depends on.

---

## storysense(container, story, opts)

| Option | Default | Description |
|---|---|---|
| `responsive` | `false` | Re-renders when the container resizes |
| `aspectRatio` | none | Width-to-height ratio, e.g. `860/460` for landscape |
| `width` / `height` | `null` / `500` | Fixed size in px (use instead of `aspectRatio` for static charts) |
| `padding` | `{top,right,bottom,left: 0}` | Inner whitespace in px |
| `axisRatio` | auto | Fractional position of the time axis (0 = top/left edge, 1 = bottom/right edge). Auto-computed from participant count and `characters()` settings — only set this manually if you need to override the default. |

Call `api.destroy()` to clean up the `ResizeObserver` when removing the chart from the DOM.

---

## Primitives

Each primitive declares what it `needs` from context and what it `provides` to later primitives. Add them in order — a primitive that needs something not yet provided will throw a clear error.

```
tooltip()      provides: tooltip
timeline()     provides: sceneX, sceneY, direction
  events()       needs: sceneX, sceneY
  characters()   needs: sceneX, sceneY, direction  |  provides: charPos, charRadius
    lifelines()    needs: charPos
    edges()        needs: charPos
network()      provides: charPos, charRadius
  edges()        needs: charPos
locations()    provides: locPos, locDotPos
  movement()     needs: locPos
```

---

### tooltip()

Add this first. All other primitives detect its presence and show tooltips on hover automatically — nothing else to configure.

```js
.add(SS.tooltip())
```

---

### timeline(opts)

Draws the time axis with one tick per event. This is the foundation for `events()`, `characters()`, `lifelines()`, and `edges()`.

```js
.add(SS.timeline({ direction: 'x' }))
```

| Option | Default | Description |
|---|---|---|
| `direction` | `'x'` | `'x'` for a horizontal axis, `'y'` for a vertical one |
| `margin` | `80` | Space in px before the first tick and after the last |
| `stroke` | `'#d1d5db'` | Axis line and tick colour |
| `tickRadius` | `2` | Tick dot radius. Set to `0` to hide ticks. |
| `times` | `true` | Show the time label for each event |
| `labelSide` | `'below'` | Which side of the axis the time labels appear on: `'below'` or `'above'` |
| `showLocations` | `false` | Colour-code axis segments by event location and label each run. Requires locations in the story data. |

When `showLocations` is `true`, each segment of the axis between location changes is coloured and labelled. Labels are placed on the opposite side from `labelSide` and staggered across up to three rows so they don't overlap.

---

### events(opts)

Places a marker on the axis at each event position. Hover shows the event title, time, and description.

```js
.add(SS.events({ shape: 'dot', r: 5 }))
```

| Option | Default | Description |
|---|---|---|
| `shape` | `'dot'` | `'dot'` or `'pin'` |
| `r` | `6` | Marker radius in px |
| `fill` | `'#6366f1'` | Colour, or `fn(event, index) => colour` |
| `titles` | `false` | Show the event title next to each marker |
| `onClick` | `null` | `fn(event, index)` called on click |

---

### characters(opts)

Draws one avatar node per participant per event they appear in. Two layout modes:

- **`lane`** — each participant occupies a fixed parallel track. Clean and predictable; pairs naturally with `lifelines()`.
- **`force`** — participants cluster around each event position via a D3 force simulation. Nodes are draggable.

```js
.add(SS.characters({ layout: 'lane', side: 'above', r: 14, labels: true }))
```

| Option | Default | Description |
|---|---|---|
| `layout` | `'lane'` | `'lane'` or `'force'` |
| `r` | `16` | Node radius in px. Automatically reduced if there isn't enough space. |
| `laneSpacing` | `38` | Target gap between lane centres in px (lane only). Reduced automatically if needed. |
| `side` | `'above'` | Where character lanes sit relative to the axis: `'above'`, `'below'`, or `'both'` (alternates above and below) |
| `color` | palette | `fn(participant) => colour` |
| `icons` | `true` | Show avatar images (fetched from DiceBear) |
| `iconStyle` | `'notionists'` | Any [DiceBear](https://www.dicebear.com/styles/) style slug |
| `iconUrl` | `null` | `fn(participant) => imageURL` — overrides `iconStyle` when provided |
| `labels` | `true` | Show participant name labels (lane mode only) |
| `onClick` | `null` | `fn(participant, eventIndex)` called on click |
| `perpDistance` | `70` | Force only: target distance above/below the axis in px |
| `axisStrength` | `0.9` | Force only: how tightly nodes snap to their event's axis position. Lower = more spread. |

The `axisRatio` (where the axis sits in the chart) is **automatically calculated** from the participant count, `laneSpacing`, and `side`. You rarely need to set it yourself.

---

### lifelines(opts)

Connects each participant's nodes with a continuous line through all events. Gaps where a participant is absent are shown as dashes.

```js
.add(SS.lifelines({ strokeWidth: 2, opacity: 0.6 }))
```

| Option | Default | Description |
|---|---|---|
| `stroke` | palette | `fn(participant) => colour` |
| `strokeWidth` | `1.5` | Line width in px |
| `opacity` | `0.4` | Line opacity |
| `dash` | `'4,4'` | SVG dash pattern for absent segments |

---

### edges(opts)

Draws curved arrows between participants for each interaction in an event. When two participants interact in both directions, the arcs curve to opposite sides automatically.

```js
.add(SS.edges({ arrow: true, curvature: 28 }))
```

| Option | Default | Description |
|---|---|---|
| `stroke` | `'#666'` | Arc colour |
| `strokeWidth` | `2` | Width in px |
| `opacity` | `0.6` | Arc opacity |
| `arrow` | `true` | Show arrowhead at the target end |
| `curvature` | `30` | How strongly opposing arcs bend away from each other |
| `global` | `false` | Aggregate interactions across all events instead of per-event. Useful with `network()`. |

---

### network(opts)

Places all participants in a force-directed layout with no timeline. Node size scales with how many events each participant appears in — more appearances, larger node. Nodes are draggable. Pair with `edges({ global: true })` to show interactions.

```js
.add(SS.network({ r: 20, labels: true }))
.add(SS.edges({ global: true, arrow: false }))
```

| Option | Default | Description |
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

---

### locations(opts)

Draws one node per location that appears in at least one event, arranged in a draggable circular layout. Each node shows a small dot per event held at that location. Drag nodes to rearrange the map — `movement()` paths update live.

This is a **standalone** visualization. It works on its own or with `movement()`, but does not connect to `timeline()`.

```js
.add(SS.locations({ r: 30, labels: true }))
.add(SS.movement({ arrow: true }))
```

| Option | Default | Description |
|---|---|---|
| `r` | `28` | Node radius in px |
| `fill` | `'#fef9ee'` | Node background colour |
| `stroke` | `'#e0b97a'` | Node border colour |
| `labels` | `true` | Show location names above each node |
| `margin` | `80` | Edge gap for the automatic circle layout |
| `positions` | `null` | Manual layout override: `{ locationId: { x, y }, ... }` |

---

### movement(opts)

Draws Bezier arcs between locations in narrative order, showing how the story moves through space. Same-location arcs loop below the node. Hover an arc to see which events it connects. Must be added after `locations()`.

```js
.add(SS.movement({ arrow: true, curvature: 25 }))
```

| Option | Default | Description |
|---|---|---|
| `stroke` | `'#999'` | Arc colour |
| `strokeWidth` | `2` | Width in px |
| `opacity` | `0.7` | Arc opacity |
| `arrow` | `true` | Show direction chevron at the arc midpoint |
| `curvature` | `25` | How strongly arcs bend. Higher = more pronounced curve. |

---

## Writing your own primitive

A primitive is a plain object with four properties. No class, no registration, no build step.

```js
const highlights = {
  id:       'highlights',
  needs:    ['sceneX', 'sceneY'],
  provides: [],

  render(ctx) {
    const layer  = ctx.get('layer')('overlay');
    const sceneX = ctx.get('sceneX');
    const sceneY = ctx.get('sceneY');

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
  .add(highlights)   // plain object, no ()
  .render();
```

Showing a tooltip from a custom primitive:

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

---

## Context reference

| Key | Type | Set by |
|---|---|---|
| `svg` | D3 `<svg>` selection | core |
| `layer` | `fn(name) → D3 <g>` | core |
| `tooltip` | `{ show(x, y, html), hide() }` | `tooltip()` |
| `sceneX` | `fn(eventIndex) → px` | `timeline()` |
| `sceneY` | `fn(eventIndex) → px` | `timeline()` |
| `direction` | `'x'` or `'y'` | `timeline()` |
| `charPos` | `fn(participantId, eventIndex) → {x, y}` | `characters()` or `network()` |
| `charRadius` | `number` | `characters()` or `network()` |
| `locPos` | `fn(locationId) → {x, y}` | `locations()` |
| `locDotPos` | `fn(eventIndex) → {x, y}` | `locations()` |

Layer draw order, back to front: `background`, `paths`, `edges`, `nodes`, `pins`, `labels`, `overlay`.

---

## Running locally

```bash
python3 -m http.server 3000
# or
npx serve .
```

Then open `http://localhost:3000/test.html` to see all primitive combinations side by side.

Sample stories are in `stories/`. The schema is in `narrative.schema.json`.
