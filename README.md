# storysense

Compose narrative visualizations from small, focused pieces. No framework or build step.

## Import

**From CDN** (no download needed, requires an internet connection):

```js
import SS from 'https://cdn.jsdelivr.net/gh/madalenaye/storysense-library@main/src/index.js';
```


**Local** (clone the repo, then reference the folder):

```js
import SS from './storysense-library/src/index.js';
```

Named imports work with both:

```js
import { storysense, normalizeNarrative, tooltip, timeline }
  from 'https://cdn.jsdelivr.net/gh/madalenaye/storysense-library@main/src/index.js';
```

D3 loads automatically from CDN either way.

## Quick start

```js
const raw   = await fetch('./story.json').then(r => r.json());
const story = SS.normalizeNarrative(raw);

SS.storysense('#chart', story, { responsive: true, aspectRatio: 860/460 })
  .add(SS.tooltip())
  .add(SS.timeline({ direction: 'x' }))
  .add(SS.characters({ layout: 'lane', r: 14, labels: true }))
  .add(SS.lifelines())
  .render();
```

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

Pass the raw JSON through `normalizeNarrative()` before rendering. It resolves all ID references and builds the maps each primitive depends on.

## storysense(container, story, opts)

| Option | Default | Description |
|---|---|---|
| `responsive` | `false` | Re-renders when the container resizes |
| `aspectRatio` | none | Width/height ratio, e.g. `860/460` |
| `width` / `height` | `null` / `500` | Fixed size in px |
| `padding` | `{top,right,bottom,left: 0}` | Inner whitespace in px |
| `axisRatio` | `0.5` | Where the axis sits vertically. `0.72` pushes it down to leave room for characters above. |

Call `api.destroy()` to clean up the ResizeObserver when removing the chart from the DOM.

## Primitives

Each primitive declares what it needs from earlier primitives and what it provides to later ones. Add them in order.

```
tooltip()     provides: tooltip
timeline()    provides: sceneX, sceneY, direction
  events()      needs: sceneX, sceneY
  characters()  needs: sceneX, sceneY, direction  |  provides: charPos, charRadius
    lifelines()   needs: charPos
    edges()       needs: charPos
network()     provides: charPos, charRadius
  edges()       needs: charPos
locations()   provides: locPos, locDotPos
  movement()    needs: locPos
```

### tooltip()

Add this first to enable hover tooltips. Other primitives detect its presence automatically.

```js
.add(SS.tooltip())
```

### timeline(opts)

Draws the time axis with one tick per event.

```js
.add(SS.timeline({ direction: 'x', stroke: '#e5e7eb', tickRadius: 4 }))
```

| Option | Default | Description |
|---|---|---|
| `direction` | `'x'` | `'x'` horizontal, `'y'` vertical |
| `margin` | `80` | Space before the first tick and after the last, in px |
| `stroke` | `'#333'` | Axis and tick colour |
| `tickRadius` | `3` | Tick dot size. Set to `0` to hide. |
| `times` | `true` | Show time labels under each tick |

### events(opts)

Places a marker on the axis at each event. Hover shows the event title, time, and description.

```js
.add(SS.events({ shape: 'dot', r: 5, fill: '#172554' }))
```

| Option | Default | Description |
|---|---|---|
| `shape` | `'dot'` | `'dot'` or `'pin'` |
| `r` | `6` | Radius in px |
| `fill` | `'#6366f1'` | Colour, or `fn(event, index) => colour` |
| `titles` | `false` | Show event titles above each marker |
| `onClick` | `null` | `fn(event, index)` |

### characters(opts)

One avatar node per participant per event they appear in. Two layouts:

- `lane` — each participant gets a fixed parallel track. Pairs well with `lifelines`.
- `force` — participants cluster around each event via D3 force simulation. Nodes are draggable.

```js
.add(SS.characters({ layout: 'lane', side: 'above', r: 14, laneSpacing: 32, labels: true }))
```

| Option | Default | Description |
|---|---|---|
| `layout` | `'lane'` | `'lane'` or `'force'` |
| `r` | `16` | Node radius in px |
| `laneSpacing` | `38` | Gap between lanes (lane only) |
| `side` | `'above'` | `'above'` or `'below'` the axis |
| `color` | palette | `fn(participant) => colour` |
| `icons` | `true` | Show avatar images |
| `iconStyle` | `'notionists'` | Any DiceBear style slug |
| `iconUrl` | `null` | `fn(participant) => imageURL` |
| `labels` | `true` | Show name labels (lane only) |
| `perpDistance` | `70` | Force only: target distance above/below the axis in px |
| `axisStrength` | `0.9` | Force only: how tightly nodes snap to their event's x. Lower = more spread. |
| `onClick` | `null` | `fn(participant, eventIndex)` |

### lifelines(opts)

Draws a line per participant through all events they appear in. Absent sections show as dashes.

```js
.add(SS.lifelines({ strokeWidth: 2.5, opacity: 0.75 }))
```

| Option | Default | Description |
|---|---|---|
| `stroke` | palette | `fn(participant) => colour` |
| `strokeWidth` | `1.5` | Line width in px |
| `opacity` | `0.4` | Opacity |
| `dash` | `'4,4'` | Dash pattern for absent segments |

### edges(opts)

Curved arrows between participants for each interaction. Opposing edges (A to B and B to A) curve to opposite sides automatically.

```js
.add(SS.edges({ strokeWidth: 2, opacity: 0.65, arrow: true, curvature: 28 }))
```

| Option | Default | Description |
|---|---|---|
| `stroke` | `'#666'` | Colour |
| `strokeWidth` | `2` | Width in px |
| `opacity` | `0.6` | Opacity |
| `arrow` | `true` | Show arrowhead |
| `curvature` | `30` | Arc strength for parallel edges |
| `global` | `false` | Group interactions across all events instead of per-event. Use with `network()`. |

### network(opts)

All participants in a force-directed layout, no timeline. Node size scales with how many events they appear in. Nodes are draggable. Pair with `edges()`.

```js
.add(SS.network({ r: 20, labels: true }))
.add(SS.edges({ strokeWidth: 2, arrow: false }))
```

| Option | Default | Description |
|---|---|---|
| `r` | `18` | Base radius (scales with appearance count) |
| `color` | palette | `fn(participant) => colour` |
| `icons` | `true` | Show avatar images |
| `iconStyle` | `'notionists'` | DiceBear style slug |
| `iconUrl` | `null` | `fn(participant) => imageURL` |
| `labels` | `true` | Show name labels |
| `charge` | `-300` | Repulsion strength |
| `linkDist` | `100` | Target distance between connected nodes |
| `onClick` | `null` | `fn(participant)` |

### locations(opts)

One node per location, arranged in a circle. Each node shows a dot per event held there. Nodes are draggable.

```js
.add(SS.locations({ r: 30, labels: true }))
```

| Option | Default | Description |
|---|---|---|
| `r` | `28` | Node radius in px |
| `fill` | `'#fef9ee'` | Node background |
| `stroke` | `'#e0b97a'` | Node border colour |
| `labels` | `true` | Show location names |
| `margin` | `80` | Edge gap for the circle layout |
| `positions` | `null` | Manual layout: `{ locationId: { x, y }, ... }` |

### movement(opts)

Bezier arcs between locations in story order. Hover to see which events an arc connects.

```js
.add(SS.movement({ arrow: true }))
```

| Option | Default | Description |
|---|---|---|
| `stroke` | `'#999'` | Arc colour |
| `strokeWidth` | `2` | Width in px |
| `opacity` | `0.7` | Opacity |
| `arrow` | `true` | Show direction chevron |
| `curvature` | `25` | Arc bend amount |

## Writing your own primitive

A primitive is a plain object with `id`, `needs`, `provides`, and a `render(ctx)` method.

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
  .add(highlights)  // pass the object directly, no ()
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

## Context reference

| Key | Type | Set by |
|---|---|---|
| `svg` | D3 `<svg>` selection | core |
| `layer` | `fn(name)` → D3 `<g>` | core |
| `tooltip` | `{ show(x, y, html), hide() }` | `tooltip()` |
| `sceneX` | `fn(eventIndex) → px` | `timeline()` |
| `sceneY` | `fn(eventIndex) → px` | `timeline()` |
| `direction` | `'x'` or `'y'` | `timeline()` |
| `charPos` | `fn(participantId, eventIndex) → {x, y}` | `characters()` or `network()` |
| `charRadius` | `number` | `characters()` or `network()` |
| `locPos` | `fn(locationId) → {x, y}` | `locations()` |
| `locDotPos` | `fn(eventIndex) → {x, y}` | `locations()` |

Layer names, bottom to top: `background`, `paths`, `edges`, `nodes`, `pins`, `labels`, `overlay`.

## Running

```bash
npx serve .
# or
python3 -m http.server 3000
```

| Page | Description |
|---|---|
| `/` | Landing page |
| `/primitives/` | Every primitive shown individually |
| `/demo/` | Four composed views with story switching |

Sample stories are in `stories/`. Load your own JSON using the "Load JSON" button in the demo.
