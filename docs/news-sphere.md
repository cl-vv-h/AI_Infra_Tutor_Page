# PULSE news entrance

The September 30 user brief requests an information sphere and a genuinely useful
reading surface, not a disconnected visual demo. This implementation keeps React,
Vite, static Pages hosting and the existing collection pipeline. No runtime news
API, account, remote font, image tracking, model call or new dependency is added.

## Rendering and interaction

- `NewsSphere` stores real 3D point positions and projects them onto one Canvas 2D
  surface, with depth ordering and perspective. This is not a map or WebGL mesh.
  It needs no GPU/WebGL dependency; unsupported Canvas falls back to the full feed.
- Size is bounded square-root activity; light encodes activity/depth. A maximum
  of five percent of current signals have restrained pulses. No importance or
  velocity data is fabricated. Connection lines mean same-category reading only.
- Category, time, search and explicit followed filters share a canonical URL and
  the same result set. Targets interpolate rather than replacing a canvas.
- Rotation takes 120 seconds per revolution. Hover slows it, drag has damped
  inertia, selection centers a node. Pause, single-step, reset, keyboard selection
  and touch preview-then-open are provided. Reduced motion removes automatic
  movement, including morphs and pointer deformation. Offscreen/hidden surfaces
  stop scheduling frames. Animation frames mutate drawing state, not React state.
- Desktop renders at most 1,200 points; mobile at most 320. The limit is disclosed;
  the feed retains all results. An active visible signal outside the cap substitutes
  one displayed point. Pixel density is capped at 2. Frame-rate targets are not a
  cross-device guarantee; lower-powered browsers can disable the visualization.

## Data and privacy contracts

`news-sphere/1` is a presentation/query version. `news-hotspots/1` remains the heat
and clustering definition without changes. 1/6/24/72/168-hour windows all end at
the actual collection snapshot; short windows recompute the existing heat score
over clipped reports. Stable IDs come from the retained catalog, not screen order.
There are no invented filler nodes, live claims, growth percentages or social
engagement. Source summaries are reused only when available; otherwise absence is
explicit. A topic is not necessarily a single event; similar titles remain unverified.

Follows reuse the original versioned key and Web Locks transaction, including
denied/corrupt storage failure reporting. No migration, new persistent settings,
tracking or changes to saved-reading data are introduced. Theme and visualization
preferences are session-only. Search and filters appear in the URL, never sent to
a search service. `mine` encodes no personal topic IDs in shared links.

## Compatibility and switch

The new default is `#/news`; new filter links explicitly carry `mode=radar`.
Existing reader query links remain reader links. `?view=daily` is the explicit
traditional reader entrance; its default filter/reset/share actions retain that
route rather than accidentally returning to the sphere. Weekly, release, archive,
reading-list and both forms of event tracking keep their original implementations.

Set `config/news-sphere.json` to `{"enabled":false}` and rebuild to restore the
original entrance. This is a build-time switch, not an instant remote kill switch.
It neither clears browser data nor alters news. Exact commit-level rollback and
rehearsal evidence belong to the corresponding release record.
