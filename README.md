# Buddy Walk

**Buddy Walk** is a web-based safety navigation app that helps pedestrians compare walking routes using more than just distance and travel time.

Instead of only asking:

> **“What is the fastest route?”**

Buddy Walk also asks:

> **“Which route gives me the strongest safety support along the way?”**

The app compares routes using nearby safe places, streetlight coverage, recent crime incidents, and connectivity, then combines those factors into a transparent **Safety Score out of 100**.

Buddy Walk is designed as a **no-login experience** and focuses on quick access to safety tools when the user feels uncomfortable or stops moving during a trip.

---

## Table of Contents

- [Main Features](#main-features)
  - [1. Multiple Walking Routes](#1-multiple-walking-routes)
  - [2. Safety Score](#2-safety-score)
  - [Safe Place Button](#safe-place-button)
  - [Virtual Call](#virtual-call)
  - [SOS / Emergency Button](#sos--emergency-button)
  - [Movement Safety Monitoring](#movement-safety-monitoring)
    - [Normal Mode](#normal-mode)
    - [10-Second Hackathon Demo](#10-second-hackathon-demo)
- [Safety Score Criteria](#safety-score-criteria)
  - [1. Safe Places — up to +15 points](#1-safe-places--up-to-15-points)
  - [2. Streetlight Coverage — 0 to +15 points](#2-streetlight-coverage--0-to-15-points)
  - [3. Crime / Incident Risk — 0 to -25 points](#3-crime--incident-risk--0-to--25-points)
  - [4. Connectivity — -10 to +10 points](#4-connectivity---10-to-10-points)
  - [Complete Example](#complete-example)

---

# Main Features

## 1. Multiple Walking Routes

After the user chooses a destination, Buddy Walk generates multiple walking-route options and displays them on the map.

Each route can be compared using:

- Safety Score
- Estimated walking time
- Distance
- Nearby safe places
- Lighting coverage
- Recent crime incidents
- Connectivity score

The goal is not always to recommend the shortest route. A slightly longer route may receive a better score if it passes through better-lit areas, has more public places nearby, or has fewer recent serious incidents.

---

## 2. Safety Score

Every route begins with a base score of: 50 points

Buddy Walk then adds or subtracts points based on four factors:

- Safe Place Points
- Lighting Points
- Crime Points
- Connectivity Points

The final result is rounded and limited to: 0 ≤ Safety Score ≤ 100

### Score Categories

| Score | Category | Meaning |
|---|---|---|
| 0–25 | Higher Caution | Route has several risk factors or limited safety support |
| 25–50 | Caution | Route has noticeable weaknesses |
| 50–75 | Moderate / Safer | Route has a reasonable balance of safety-supporting factors |
| 75–100 | Strong Safety Support | Route has the strongest combination of the available factors |


---

## Safe Place Button

The green **Safe Place** button gives the user a fast way to find a nearby public place that may provide help, visibility, or access to other people.

Possible safe places include:

- hospitals
- police stations
- fire stations
- clinics
- libraries
- pharmacies
- supermarkets
- restaurants
- cafes
- hotels
- transit stations
- convenience stores

When the user presses the **Safe Place** button, Buddy Walk identifies the **nearest currently open safe place** and creates a walking route to it.

The user does not need to manually enter a destination or search through a list of places.

### Source

Safe places come from:

- **OpenStreetMap**
- **Overpass API**

Links:

- https://www.openstreetmap.org/
- https://overpass-api.de/

Because public Overpass servers can sometimes be unavailable or rate-limited, Buddy Walk can try multiple endpoints instead of depending on only one server.

---

### Source

Safe places come from:

- **OpenStreetMap**
- **Overpass API**

Links:

- https://www.openstreetmap.org/
- https://overpass-api.de/

Because public Overpass servers can sometimes be unavailable or rate-limited, Buddy Walk can try multiple endpoints instead of depending on only one server.

---

## Virtual Call

The **Virtual Call** feature creates a simulated incoming-call experience.

Its purpose is to give the user a quick social-interaction option if they feel uncomfortable walking alone or want to appear connected to another person.

Before starting the call, the user can choose from **multiple virtual callers**. This allows the user to select the person who best fits the situation.

Example caller choices can include:

- Mom
- Roommate
- Partner

Each caller can have a different name, generated voice,conversation style

After selecting a caller, Buddy Walk displays a simulated call screen and plays the corresponding voice conversation.

The feature includes:
- Multiple caller choices
- Caller selection screen
- Simulated incoming-call screen
- Call accept/end controls

---

## SOS / Emergency Button

The red **SOS** button provides quick access to the device's emergency calling flow.

When the user presses the button, Buddy Walk shows two choices:

- **Call Police** — opens the phone's emergency calling option so the user can quickly contact emergency services.
- **Cancel** — closes the SOS prompt 

---

## Movement Safety Monitoring

Buddy Walk can monitor whether the user is still moving while following a route.

If the user stops making meaningful movement for a certain period of time, the app displays an **"Are you safe?"** popup and gives the user a short amount of time to respond.

If the user presses **"I'm Safe"**, monitoring continues normally.

If the user does not respond before the countdown ends, Buddy Walk plays a loud alarm and opens the emergency calling flow.

Small GPS changes are ignored so normal location drift is not treated as real movement.

Monitoring automatically stops when the user reaches the destination.

---

# Safety Score Criteria

## 1. Safe Places — up to +15 points

Buddy Walk rewards routes that pass near public places that may provide help, people, staff, lighting, or a place to stop.

Only places close enough to the selected route contribute to the score.

### Safe Place Rating

| Points | Place Types |
|---:|---|
| +5 | Police station, Fire station, Hospital, Emergency ward, Campus police |
| +4 | Urgent care, Clinic |
| +3 | Library, Government building, Community center, Hotel |
| +2 | Pharmacy, Supermarket |
| +1 | Convenience store, Restaurant, Cafe, Transit station |

These values are Buddy Walk's own scoring weights for the hackathon. They are **not official OpenStreetMap safety ratings**.

### How Safe Place Points Are Calculated

Only safe places within approximately **200 meters of the route** contribute to the score.

For each place:

```text
Private / restricted access:
0 points

Confirmed open:
full points

Opening hours unknown:
about 60% of the normal points,
with a minimum of 1 point

Confirmed closed:
0 points
```

Then:

```text
Safe Place Score =
sum of eligible place points
```

The result is capped:

```text
Maximum Safe Place Score = +15
```

### Source

Safe-place locations are retrieved from:

- OpenStreetMap
- Overpass API

---

## 2. Streetlight Coverage — 0 to +15 points

Buddy Walk checks how much of the walking route passes near mapped streetlights.

### Source

Streetlight locations come from the **City of Atlanta street-light ArcGIS layer**:

https://services5.arcgis.com/5RxyIIJ9boPdptdo/ArcGIS/rest/services/COA_Street_lights/FeatureServer/0

### How Lighting Is Calculated

Buddy Walk samples points along the route.

For each sample point, the app checks whether a mapped streetlight is nearby.

Conceptually:

```text
Lighting Coverage =
route distance near mapped streetlights
---------------------------------------
total sampled route distance
```

### Lighting Score

| Streetlight Coverage | Points |
|---|---:|
| 80% or more | +15 |
| 50%–79% | +10 |
| 20%–49% | +5 |
| Below 20% / insufficient data | 0 |

### Example

```text
Route length sampled = 1,000 m
Route length near mapped lights = 720 m

Lighting Coverage =
720 / 1000
= 72%

Lighting Score = +10
```

### Limitation

A mapped streetlight does not guarantee that:

- it is currently working
- it is bright enough
- the surrounding area is actually well illuminated

Buddy Walk therefore treats this factor as a **streetlight-proximity estimate**, not a live measurement of brightness.

---

## 3. Crime / Incident Risk — 0 to -25 points

Buddy Walk checks recent crime records close to the selected route.

Crime incidents are grouped into five risk levels.

More serious incidents remain relevant for a longer time window.

### Crime Rating

| Risk Level | Penalty per Incident | Time Window | Crime Types |
|---:|---:|---|---|
| 1 | -1 | Last 7 days | Drug offense / possession, Vandalism / property damage |
| 2 | -2 | Last 7 days | Shoplifting / retail theft, Theft / larceny |
| 3 | -3 | Last 14 days | Vehicle theft, Burglary, Simple assault |
| 4 | -4 | Last 30 days | Robbery, Aggravated assault, Weapons offense |
| 5 | -5 | Last 30 days | Shooting, Sexual offense, Kidnapping, Homicide |

### Why Different Time Windows?

Buddy Walk uses:

```text
Risk 1–2:
count only incidents from the last 7 days

Risk 3:
count only incidents from the last 14 days

Risk 4–5:
count incidents from the last 30 days
```

This prevents older low-level incidents from affecting the score for too long while allowing recent serious incidents to remain relevant longer.

### How Crime Points Are Calculated

Only incidents within approximately **150 meters of the route** are considered.

For each eligible incident:

```text
Penalty = -Risk Level
```

Example:

```text
1 theft
= -2

1 simple assault
= -3

1 robbery
= -4

Total crime penalty
= -9
```

If one incident contains several offense descriptions, Buddy Walk counts only the **highest-risk eligible offense** for that incident.

The total deduction is capped at:

```text
Maximum Crime Penalty = -25
```

So:

```text
Crime Score =
max(-25, total eligible crime penalty)
```

This keeps crime important without allowing one dense cluster of records to completely overwhelm every other factor.

### Source

Crime data comes from Atlanta's public ArcGIS crime dataset:

https://services3.arcgis.com/Et5Qfajgiyosiw4d/arcgis/rest/services/OpenDataWebsite_Crime_view/FeatureServer/0

The dataset includes information such as:

- report date
- offense description
- crime classification/code
- incident identifier
- location information

The Buddy Walk 1–5 risk scale is a **custom hackathon classification**, not an official Atlanta Police Department severity score.

---

## 4. Connectivity — -10 to +10 points

Buddy Walk includes a connectivity layer to demonstrate how network access could contribute to safety-aware navigation.

A stronger connection may help the user:

- make a call
- send a message
- load maps
- contact emergency services
- use online safety tools

### Current Data Source

The connectivity layer is **synthetic demo data**.

It is not official Cox coverage information.

The demo model gives stronger values around places such as:

- university areas
- dense residential areas
- mixed-use areas
- busier urban regions

and weaker values in selected areas to create realistic variation.

### Connectivity Rating

| Connectivity Score | Description |
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

### How Connectivity Is Calculated

Buddy Walk samples multiple positions along the route.

Example:

```text
Sample scores:
6, 7, 5, 8, 4
```

Then:

```text
Average =
(6 + 7 + 5 + 8 + 4) / 5
= 6
```

So:

```text
Connectivity Score = +6
```

The final connectivity value is limited to:

```text
-10 <= Connectivity Score <= +10
```

---

## Complete Example

Assume Buddy Walk evaluates one route.

### Starting Score

```text
50
```

### Safe Places

The route passes near:

```text
1 hospital = +5
1 library  = +3
1 cafe     = +1

Safe Place Points = +9
```

### Lighting

```text
65% of the route is near mapped streetlights

Lighting Points = +10
```

### Crime

Recent eligible incidents near the route:

```text
1 theft   = -2
1 robbery = -4

Crime Points = -6
```

### Connectivity

```text
Average connectivity along the route = +5
```

### Final Calculation

```text
Safety Score =
50
+ 9
+ 10
- 6
+ 5

Safety Score = 68
```

According to the Buddy Walk score categories:

```text
68 -> 50–75 category
```

So this route would be classified as:

**Moderate / Safer**

---

## Data Source Summary

| Criterion | Source | Type |
|---|---|---|
| Map | OpenStreetMap | Real |
| Destination search | OpenStreetMap Nominatim | Real |
| Walking routes | openrouteservice / OSM routing | Real |
| Safe places | OpenStreetMap + Overpass API | Real mapped POI data |
| Streetlights | City of Atlanta ArcGIS | Real public inventory data |
| Crime incidents | Atlanta public ArcGIS crime dataset | Real public incident data |
| Connectivity | Buddy Walk generated model | Synthetic demo data |
| Safety Score weights | Buddy Walk | Custom heuristic |

---

## Important Note

Buddy Walk is a hackathon prototype.

Its Safety Score should be interpreted as **additional route context**, not a guarantee of personal safety.

Public datasets may be:

- incomplete
- delayed
- outdated
- temporarily unavailable

Crime history cannot predict whether a future incident will happen, and a mapped streetlight or nearby public place does not guarantee safety.

The purpose of Buddy Walk is to combine several useful signals into one understandable route comparison instead of relying only on travel time or distance.
