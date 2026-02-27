## HIGHMAPS — Data-Agnostic Geometry Explorer (Codex Spec v0.2)

### 0) One-line Definition

A local-first app that takes **any dataset** (time-based or indexed), renders it in a **baseline geometry**, morphs it into **alternate geometries**, and provides **interactive slicing / extraction tools** that return **lower-dimensional derived series** (e.g., “the bottom edge of each spiral loop”) for further inspection or export.

---

## 1) MVP Goals

1. **Import / define data** without domain assumptions (not “emotions”, not “narrative”).
2. **Map** selected fields onto a baseline (line/plane/point cloud).
3. **Transform** the baseline into a chosen geometry with **smooth morph animation**.
4. Provide **slicing & extraction**:

   * user selects a “feature” of the transformed geometry (e.g., spiral phase baseline),
   * app computes a **deterministic derived series**,
   * app renders the derived series as a new baseline chart,
   * app allows export of both original + derived.
5. Keep it **interpretable** by always letting users “come back down” to simpler views.

Non-goals: built-in semantic interpretation, built-in LLM, diagnostics, social features.

---

## 2) Core Concepts (must exist in code)

### 2.1 Dataset

A dataset is a table of rows.

* Each row has:

  * an `index` (numeric or timestamp)
  * any number of numeric / categorical fields

The app is “schema-light”: users can define field types in UI.

### 2.2 Mapping

A mapping selects:

* `index_field` (or implicit row number)
* 1–N `value_fields`
* an `embedding_mode` (2D / 3D)
* optional normalization

Mapping produces an **embedded point set**: `P = {p_i}` with stable IDs.

### 2.3 Geometry Transform

A transform is a function that maps baseline coordinates → new coordinates:
`T: R^k -> R^m` with parameters.

### 2.4 Slice / Extractor

An extractor is a deterministic operation on the transformed coordinates that outputs:

* a **derived dataset** (rows aligned to cycles/phases/conditions)
* optionally a selection mask of contributing points

Extractors are the MVP’s “meaning engine” (without semantics).

---

## 3) Data Model (machine-readable)

### 3.1 Stored Objects

* `Project`
* `Dataset`
* `FieldSchema`
* `ViewConfig`
* `TransformConfig`
* `ExtractorConfig`
* `DerivedDataset`

Use JSON serialization; store locally.

#### Dataset (raw)

```json
{
  "id": "uuid",
  "name": "My Dataset",
  "rows": [
    {"id":"r1","t":"2026-01-01","a":1.2,"b":0.3,"label":"x"},
    {"id":"r2","t":"2026-01-02","a":1.4,"b":0.1,"label":"y"}
  ]
}
```

#### FieldSchema

```json
{
  "dataset_id": "uuid",
  "index_field": "t",
  "fields": [
    {"name":"t","type":"time"},
    {"name":"a","type":"number"},
    {"name":"b","type":"number"},
    {"name":"label","type":"category"}
  ]
}
```

#### ViewConfig (baseline + embedding)

```json
{
  "dataset_id":"uuid",
  "embedding_dim": 2,
  "x": {"source":"index", "field":"t"},
  "y": {"source":"field", "field":"a"},
  "z": null,
  "color": {"source":"field","field":"b"},
  "size": {"source":"constant","value":1},
  "normalize": "zscore|minmax|none"
}
```

#### TransformConfig

```json
{
  "transform_id":"spiral_wrap",
  "params": {
    "period": 7,
    "tightness": 1.0,
    "radius_scale": 1.0
  }
}
```

#### ExtractorConfig

```json
{
  "extractor_id":"phase_trace",
  "params": {
    "period": 7,
    "phase": 6,
    "tolerance": 0.1
  }
}
```

---

## 4) Required UI Screens

### 4.1 Project Home

* Create/Open project
* List datasets + derived datasets
* “New Dataset” → Import or paste

### 4.2 Dataset Import

Inputs:

* paste CSV
* upload CSV
* manual entry (small datasets)
* sample dataset generator (for testing)

User sets:

* index field (time or integer)
* field types (number/category/time)

### 4.3 Explorer (main screen)

Layout (MVP):

* Left: dataset + view controls
* Center: visualization canvas
* Right: transform + extractor controls

Explorer must support:

* Baseline view toggle
* Transformed view toggle
* Split view (baseline left, transformed right) OR overlay switch
* Morph scrubber (0%→100%)
* Camera controls (pan/zoom; orbit if 3D)

### 4.4 Extraction Panel

Shows:

* list of extractors (phase trace, radial slice, threshold band…)
* extractor parameters
* “Preview extraction” (highlights contributing points)
* “Materialize derived dataset” (creates new dataset + new baseline chart)

### 4.5 Derived Dataset Viewer

* baseline chart of derived series
* export derived CSV/JSON
* ability to re-run with different parameters (non-destructive)

---

## 5) Visualization Requirements

### 5.1 Baseline Renderers (MVP)

* 2D line (index vs value)
* 2D scatter (x vs y)
* (Optional) 3D scatter

### 5.2 Transform Renderers

* Same point IDs as baseline
* Morph animation between baseline coords and transformed coords
* User can scrub morph percentage

### 5.3 Point Identity Contract (important)

Every row has a stable `row.id`.
Transforms and extractors must preserve row identity:

* `row.id` is carried into transformed points
* extracted/derived datasets include references back to source IDs

---

## 6) Geometry Transform Library (MVP: 10–15)

Ship with **12 transforms**.

Each transform must define:

* `name`
* output dimension (2D or 3D)
* parameter schema (with defaults)
* mapping function

### 6.1 Required transforms (12)

1. `identity` (baseline)
2. `circle_wrap` (periodic wrap)
3. `spiral_wrap_2d` (Archimedean spiral)
4. `helix_wrap_3d`
5. `cylinder_wrap_3d`
6. `torus_wrap_3d` (two periods)
7. `mobius_strip_3d` (projected)
8. `klein_bottle_3d` (projected)
9. `sphere_map_3d` (latitude/longitude mapping)
10. `poincare_disk_2d` (hyperbolic)
11. `tesseract_projection_3d` (4D→3D projection)
12. `hypersphere_projection_3d` (S³→3D stereographic-like projection)

**Note:** These are visualization/projection tools; the app does not claim “true 4D navigation.” It provides projections + controllable rotations.

---

## 7) Extractors (this is the centerpiece)

### 7.1 Philosophy

Extractors are **geometry-aware but data-meaning-agnostic**.
They do not need multiple-choice fields. They operate on:

* index values (time/integer)
* transformed coordinates
* transform parameters (period, phase, etc.)

### 7.2 MVP Extractor Set (6)

1. **Phase Trace (the “bottom of spiral” tool)**

   * Inputs: `period`, `phase`, `tolerance`
   * Output: derived dataset containing points whose index position is at the chosen phase each cycle
   * Example: weekly spiral → “day 7 baseline series”

2. **Cycle Summary Curve**

   * Inputs: `period`, `aggregation` (mean/median/min/max), optional `phase_bins`
   * Output: a single cycle profile (phase 0..period-1) aggregated across cycles

3. **Radial Band Slice (spiral/circle)**

   * Inputs: `radius_min`, `radius_max`
   * Output: subset series filtered by radial distance in transformed space

4. **Angular Wedge Slice (spiral/circle/torus)**

   * Inputs: `theta_min`, `theta_max`
   * Output: subset selection + derived index ordering

5. **Plane Slice (3D)**

   * Inputs: plane normal (nx,ny,nz) + offset + thickness
   * Output: points near plane → derived dataset

6. **Nearest-Path Trace (interactive polyline)**

   * User draws a path on the transformed view
   * App selects nearest points to that path (within tolerance)
   * Output: derived dataset ordered along path distance

### 7.3 Phase Trace — exact behavior (must match conversation)

This is the key feature.

Given:

* an ordered index `i = 0..N-1` (derived from time ordering or integer ordering)
* `period` (e.g., 7)
* `phase` (e.g., 6 meaning “the last point in the cycle”)
  Return:
* all rows where `(i mod period) == phase`
* preserve chronological ordering
* create a derived dataset with:

  * `cycle_number = floor(i / period)`
  * `phase = phase`
  * original fields copied through (or at least selected fields)
  * plus `source_row_id`

This enables: “show me the same bottom point every time the cycle completes.”

---

## 8) Minimal “Pattern Surfacing” Without Semantics

Even in the agnostic version, add small, universal metrics (optional panel):

* count, missingness
* variance / volatility of chosen numeric field(s)
* correlation between cycles (for phase trace)
* trend slope

These are numeric, not interpretive.

---

## 9) Export

* Export current view config (JSON)
* Export selected points (CSV/JSON)
* Export derived dataset (CSV/JSON)
* Export transform + extractor settings (JSON “recipe”)

---

## 10) Local-First Storage

* No accounts.
* Everything stored locally.
* Project file can be exported/imported.

---

## 11) Implementation Skeleton (Codex directives)

### 11.1 Modules

* `core/schema` (field typing, parsing CSV, validation)
* `core/embedding` (baseline coordinate builder)
* `core/transforms` (registry + mapping functions)
* `core/extractors` (registry + extraction functions)
* `core/derive` (derived dataset materialization)
* `ui/explorer` (controls + canvas)
* `ui/dataset` (import/type assignment)
* `ui/derived` (viewer + export)

### 11.2 Registries (required)

Transforms and extractors must be implemented as registries:

* `TransformRegistry.get(id)` returns:

  * param schema
  * `apply(points, params) -> points_transformed`

* `ExtractorRegistry.get(id)` returns:

  * param schema
  * `preview(points_transformed, params) -> selectionMask`
  * `materialize(dataset, selectionMask, params) -> derivedDataset`

### 11.3 Determinism

Even though inputs can be arbitrary, the engine must behave deterministically:

* Sorting by index is stable.
* PCA (if used) is deterministic.
* Any algorithm that uses randomness must use a fixed seed stored in project settings.

---

## 12) MVP Acceptance Tests

1. User imports a CSV with a date column + numeric column.
2. Baseline line chart renders.
3. User selects `spiral_wrap_2d` with `period=7`; morph animates.
4. User runs `phase_trace(period=7, phase=6)` → derived dataset created.
5. Derived dataset line chart renders (cycle_number vs value).
6. User exports derived CSV.

---

## 13) What Codex Should Build First

Prioritize:

1. Data import + schema typing
2. Baseline chart
3. Spiral transform
4. Phase Trace extractor
5. Derived dataset viewer + export
   Then expand the transform library + add slicing tools.

