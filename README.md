# Buddy Walk

**Buddy Walk** is a web-based safety navigation app that helps pedestrians compare walking routes using more than just distance and travel time.

Instead of only asking **“What is the fastest route?”**, Buddy Walk also asks:

> **“Which route gives me the strongest safety support along the way?”**

The project combines walking routes with nearby safe places, mapped streetlights, recent crime reports, and a demo connectivity layer to generate a transparent **Safety Score out of 100** for each route.

Buddy Walk is designed as a **no-login experience**. The main features can be used without creating an account or profile.

---

## Table of Contents

- [Main Features](#main-features)
  - [1. Multiple Walking Routes](#1-multiple-walking-routes)
  - [2. Safety Score](#2-safety-score)
- [Safety Score Criteria](#safety-score-criteria)
  - [1. Safe Places — up to +15 points](#1-safe-places--up-to-15-points)
  - [2. Streetlight Coverage — 0 to +15 points in the current implementation](#2-streetlight-coverage--0-to-15-points-in-the-current-implementation)
  - [3. Crime / Incident Risk — 0 to -25 points](#3-crime--incident-risk--0-to--25-points)
  - [4. Connectivity — -10 to +10 points](#4-connectivity---10-to-10-points)
- [Complete Example](#complete-example)
- [Safety Tools](#safety-tools)
  - [Safe Place Button](#safe-place-button)
  - [Virtual Call](#virtual-call)
  - [SOS / Emergency Button](#sos--emergency-button)
- [Movement Safety Monitoring](#movement-safety-monitoring)
  - [Normal Mode](#normal-mode)
  - [10-Second Hackathon Demo](#10-second-hackathon-demo)
- [Route Details](#route-details)
- [Data Source Summary](#data-source-summary)
- [Privacy](#privacy)
- [Limitations](#limitations)
- [Optional GitHub Media](#optional-github-media)

---

## Main Features

### 1. Multiple Walking Routes

After the user enters a destination, Buddy Walk requests multiple walking-route options and displays them on the map.

Each route card shows information such as:

- Safety Score
- estimated walking time
- distance
- number of nearby safe places
- connectivity score
- route recommendation

Routes are ranked primarily by **Safety Score**, with travel time used as a secondary comparison.

**Data sources**

- Destination search: [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/)
- Walking routes: [openrouteservice](https://openrouteservice.org/) when an API key is provided
- Public fallback routing: [OpenStreetMap routing service](https://routing.openstreetmap.de/)

---

### 2. Safety Score

Every route begins with a base score of **50 points**.

Buddy Walk then adjusts that score using four factors:

```text
Safety Score =
50
+ Safe Place Points
+ Lighting Points
+ Crime Points
+ Connectivity Points
```

The final result is rounded and limited to:

```text
0 <= Safety Score <= 100
```

Community-report scoring is **not used** in the current version.

### Score Categories

| Final Score | Category |
|---|---|
| 85–100 | Excellent |
| 70–84 | Safer |
| 55–69 | Moderate |
| 40–54 | Caution |
| 0–39 | Higher Caution |

The score is a **hackathon recommendation heuristic**, not a guarantee that a route is safe.

---

# Safety Score Criteria

## 1. Safe Places — up to +15 points

Buddy Walk loads nearby public places when the website launches instead of waiting for the user to choose a destination.

The map can include places such as:

- police stations
- fire stations
- hospitals
- emergency wards
- campus police
- urgent care
- clinics
- libraries
- government buildings
- community centers
- hotels
- pharmacies
- supermarkets
- convenience stores
- restaurants
- cafes
- transit stations

The green **Safe Place** button expands the search to include more public options, then selects a nearby usable place and can route the user to it.

### Data Source

Safe-place data comes from **OpenStreetMap** through the **Overpass API**.

- [OpenStreetMap](https://www.openstreetmap.org/)
- [Overpass API](https://overpass-api.de/)

Buddy Walk currently tries more than one public Overpass server so that a failure from one endpoint does not immediately break the Safe Place feature.

### Safe Place Rating

| Place Type | Base Points |
|---|---:|
| Police station | +5 |
| Fire station | +5 |
| Hospital | +5 |
| Emergency ward | +5 |
| Campus police | +5 |
| Urgent care | +4 |
| Clinic | +4 |
| Library | +3 |
| Government building | +3 |
| Community center | +3 |
| Hotel | +3 |
| Pharmacy | +2 |
| Supermarket | +2 |
| Convenience store | +1 |
| Restaurant | +1 |
| Cafe | +1 |
| Transit station | +1 |

These point values are **Buddy Walk's own trust weighting for the hackathon**. They are not an official OpenStreetMap or government safety rating.

### How Safe Place Points Are Calculated

Only safe places within approximately **200 meters of the route** contribute to the Safety Score.

For each nearby place:

```text
If access is private/restricted:
    0 points

If the place is confirmed open:
    full base points

If opening hours are unknown:
    max(1, round(base points × 0.60))

If the place is confirmed closed:
    0 points
```

Then:

```text
Raw Safe Place Points =
sum of all eligible nearby place points

Safe Place Score =
min(15, Raw Safe Place Points)
```

So safe places can contribute a maximum of:

```text
+15 points
```

The route-detail panel can show safe places within **300 meters** for context, even though scoring uses the tighter **200-meter** distance.

---

## 2. Streetlight Coverage — 0 to +15 points in the current implementation

Buddy Walk checks how much of a route passes near mapped streetlights.

### Data Source

Streetlight locations come from the **City of Atlanta street-light ArcGIS layer**:

[City of Atlanta Street Lights — ArcGIS FeatureServer](https://services5.arcgis.com/5RxyIIJ9boPdptdo/ArcGIS/rest/services/COA_Street_lights/FeatureServer/0)

### How Lighting Is Calculated

Buddy Walk samples the route in small sections of roughly **25 meters**.

For every sample, it checks whether there is a mapped streetlight within **50 meters**.

```text
Lighting Coverage =
route length near mapped lights
--------------------------------
total sampled route length
```

The coverage is then converted into points:

| Portion of Route Near a Mapped Streetlight | Lighting Rating | Points |
|---|---|---:|
| 80% or more | Very well lit | +15 |
| 50%–79% | Good lighting | +10 |
| 20%–49% | Some lighting | +5 |
| Less than 20% / insufficient data | Unknown | 0 |

For example:

```text
Route length sampled = 1,000 m
Length within 50 m of a mapped streetlight = 720 m

Coverage = 720 / 1000 = 72%

Lighting Points = +10
```

### Important Limitation

A mapped streetlight does **not** guarantee that the light is currently working or that the street is bright enough in practice.

Buddy Walk therefore treats this as a **streetlight-inventory proximity estimate**, not a measurement of actual illumination.

---

## 3. Crime / Incident Risk — 0 to -25 points

Buddy Walk checks recent public crime records close to each route.

### Data Source

Crime records come from the public Atlanta crime ArcGIS dataset:

[Atlanta Crime Open Data — ArcGIS FeatureServer](https://services3.arcgis.com/Et5Qfajgiyosiw4d/arcgis/rest/services/OpenDataWebsite_Crime_view/FeatureServer/0)

The dataset includes fields such as report date, NIBRS/UCR code, offense description, and incident identifier.

### Buddy Walk Crime Risk Scale

Crime is converted to a simple **1–5 risk level**.

| Crime Type | Risk Level | Penalty per Incident | Counted If Reported Within |
|---|---:|---:|---|
| Drug offense / possession | 1 | -1 | 7 days |
| Vandalism / property damage | 1 | -1 | 7 days |
| Shoplifting / retail theft | 2 | -2 | 7 days |
| Theft / larceny | 2 | -2 | 7 days |
| Vehicle theft | 3 | -3 | 14 days |
| Burglary | 3 | -3 | 14 days |
| Simple assault | 3 | -3 | 14 days |
| Robbery | 4 | -4 | 30 days |
| Aggravated assault | 4 | -4 | 30 days |
| Weapons offense | 4 | -4 | 30 days |
| Shooting | 5 | -5 | 30 days |
| Sexual offense | 5 | -5 | 30 days |
| Kidnapping | 5 | -5 | 30 days |
| Homicide | 5 | -5 | 30 days |

The **1–5 risk scale is a Buddy Walk hackathon heuristic**. It is not an official severity score published by the Atlanta Police Department or the NIBRS program.

### Why Different Time Windows?

Lower-level incidents expire from the route score sooner:

```text
Risk 1–2 -> previous 7 days
Risk 3   -> previous 14 days
Risk 4–5 -> previous 30 days
```

This keeps a recent serious incident relevant for longer while preventing older low-level incidents from continuing to heavily affect the route.

### How Crime Points Are Calculated

Only incidents within approximately **150 meters of the route** are considered.

For every eligible incident:

```text
Penalty = -Risk Level
```

Example:

```text
1 theft            -> -2
1 simple assault   -> -3
1 robbery          -> -4

Raw Crime Penalty = -9
```

If the same incident contains multiple eligible offense records, Buddy Walk counts only the **highest-risk offense** for that incident.

The final crime deduction is capped:

```text
Crime Points =
max(-25, Raw Crime Penalty)
```

Therefore:

```text
Maximum crime deduction = -25
```

This prevents a dense cluster of incidents from completely overwhelming every other route factor.

Records are ignored when they are:

- outside the route-distance threshold
- older than the allowed time window for their risk level
- future-dated
- not recognized by the crime classifier

If crime data cannot be evaluated, Buddy Walk does not invent a penalty.

---

## 4. Connectivity — -10 to +10 points

Buddy Walk includes a connectivity layer to demonstrate how access to stronger cellular/internet coverage could become part of safety-aware navigation.

A better-connected route may help a pedestrian:

- make a call
- send a message
- load maps
- contact emergency services
- use online safety tools

### Data Source

The current connectivity layer is **synthetic hackathon demo data**.

It is **not official Cox coverage data** and should not be presented as real network availability.

The generated map gives stronger values around:

- dense urban areas
- university campuses
- residential / mixed-use areas

and adds deterministic local variation so that neighboring regions do not all receive the same value.

### Connectivity Scale

The internal connectivity cells use integer values from:

```text
-10 to +10
```

| Score | Label |
|---:|---|
| +9 to +10 | Excellent |
| +7 to +8 | Very Strong |
| +5 to +6 | Strong |
| +3 to +4 | Good |
| +1 to +2 | Fair |
| -1 to 0 | Average |
| -3 to -2 | Fair-Poor |
| -5 to -4 | Weak |
| -7 to -6 | Very Weak |
| -9 to -8 | Poor |
| -10 | Very Poor |

### How Route Connectivity Is Calculated

Buddy Walk samples up to roughly **35 locations along the route**.

For example:

```text
Sample scores:
6, 7, 5, 8, 4

Average =
(6 + 7 + 5 + 8 + 4) / 5
= 6
```

The average is rounded and limited to:

```text
-10 <= Connectivity Points <= +10
```

In this example:

```text
Connectivity Points = +6
```

The connectivity result is added directly to the Safety Score.

---

# Complete Example

Assume Buddy Walk evaluates a route with the following evidence:

```text
Starting Score                         50

Safe Places:
Hospital                               +5
Library                                +3
Cafe                                   +1
-----------------------------------------
Safe Place Points                      +9

Lighting:
65% of route near mapped streetlights +10

Crime:
1 theft                                -2
1 robbery                              -4
-----------------------------------------
Crime Points                           -6

Connectivity:
Average route connectivity             +5
```

Final calculation:

```text
50 + 9 + 10 - 6 + 5 = 68
```

Therefore:

```text
Safety Score = 68 / 100
Category = Moderate
```

---

# Safety Tools

## Safe Place Button

The green Safe Place button is designed for situations where the user wants to quickly move toward a more populated or trusted public location.

When pressed, Buddy Walk:

1. checks the user's current location
2. expands the nearby Safe Place search
3. prefers places confirmed open when possible
4. ignores mapped private/restricted or closed locations
5. finds a nearby usable place
6. sets it as the destination
7. calculates a walking route to it

The button does not wait for the user to manually search for a destination.

Safe places are also loaded automatically when Buddy Walk launches.

---

## Virtual Call

The **Virtual Call** feature creates a simulated incoming-call experience.

It is intended to give the user a quick social-interaction option if they feel uncomfortable walking alone.

The current module includes several caller personas and prerecorded/generated audio clips.

The feature is presented as **Virtual Call** in the project description even though some internal development files still use the earlier `fake-call` name.

---

## SOS / Emergency Button

The red SOS button gives the user quick access to the phone's emergency calling flow.

Buddy Walk first asks for confirmation before opening:

```text
tel:911
```

A browser cannot silently place an emergency call by itself. The phone, operating system, or browser controls the final calling step.

---

# Movement Safety Monitoring

After the user actively chooses a route, Buddy Walk can monitor movement using browser geolocation.

### Normal Mode

```text
No meaningful movement for 5 minutes
        ↓
"Are you safe?" safety check
        ↓
30-second response window
        ↓
No response
        ↓
Loud alarm + vibration when supported
        ↓
Open device 911 calling flow
```

Meaningful movement normally requires approximately **20 meters** of displacement to reduce false resets caused by GPS drift.

When the user gets within approximately **35 meters of the destination**, movement monitoring stops automatically.

If live location monitoring becomes unavailable, the normal inactivity timer is paused rather than pretending Buddy Walk still knows whether the user is moving.

---

## 10-Second Hackathon Demo

Waiting five minutes during a presentation is impractical, so Buddy Walk includes a demonstration mode.

```text
Press "Demo 10s"
        ↓
Wait 10 seconds
        ↓
"Are you safe?" popup
        ↓
15-second countdown
        ↓
Press "I'm Safe"
        OR
No response
        ↓
Loud alarm + emergency calling flow
```

The demo timer is intentionally independent of GPS updates so it works reliably during a hackathon presentation.

---

# Route Details

Selecting a route opens a detailed route panel containing:

- final Safety Score
- score category
- full point breakdown
- safe places close to the selected route
- recent classified crime incidents near the route
- route distance
- estimated walking time

The score breakdown shows exactly how each factor affected the final result so the recommendation is not a black box.

---

# Data Source Summary

| Feature / Criterion | Source | Real or Demo? |
|---|---|---|
| Base map | OpenStreetMap | Real |
| Destination search | OpenStreetMap Nominatim | Real |
| Walking routes | openrouteservice / OpenStreetMap public routing | Real external routing |
| Safe places | OpenStreetMap through Overpass API | Real mapped POI data |
| Streetlights | City of Atlanta ArcGIS street-light inventory | Real public inventory data |
| Crime reports | Atlanta public ArcGIS crime dataset | Real public incident data |
| Connectivity | Buddy Walk synthetic model | **Demo only** |
| Safety Score weights | Buddy Walk scoring model | **Custom heuristic** |

---

# Privacy

Buddy Walk is designed around a **no-login** approach.

The project does not require:

- a user account
- a profile
- saved route history
- community posting
- a personal safety profile

Browser location is used when the user grants permission because features such as navigation, nearby Safe Places, and movement monitoring depend on the device's current position.

---

# Limitations

Buddy Walk is a hackathon prototype and should not be treated as an emergency-service replacement.

Important limitations include:

- Public datasets may be incomplete or delayed.
- A mapped streetlight may be broken or may not provide enough illumination.
- OpenStreetMap places and opening hours may be missing or outdated.
- Public Overpass API servers can occasionally be unavailable or rate-limited.
- Crime history does not predict whether a future incident will occur.
- The 1–5 crime scale and other Safety Score weights are custom project heuristics.
- Connectivity is synthetic demo data, not actual Cox network coverage.
- GPS can drift, especially indoors or near tall buildings.
- A web browser cannot silently complete a 911 call.

The Safety Score should therefore be interpreted as **additional route context**, not a guarantee of personal safety.

---

## Optional GitHub Media

If you want to make the README more visual later, a simple structure is:

```text
assets/readme/
├── overview.png
├── route-comparison.gif
├── safe-place.gif
├── virtual-call.gif
├── safety-demo.gif
└── demo-video.mp4
```

Recommended placements:

- `overview.png` — directly below the project introduction
- `route-comparison.gif` — under **Multiple Walking Routes**
- `safe-place.gif` — under **Safe Place Button**
- `virtual-call.gif` — under **Virtual Call**
- `safety-demo.gif` — under **10-Second Hackathon Demo**
- `demo-video.mp4` — near the top or bottom as the full project demo
