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

Buddy Walk gives each route a **Safety Score from 0 to 100**.

Every route begins with a base score of:

**50 points**

The score is then adjusted using four factors:

- Safe Places
- Streetlight Coverage
- Crime / Incident Risk
- Connectivity

The final score is limited to the range **0–100**.

---

## 1. Safe Places

Buddy Walk rewards routes that pass near public places that may provide access to staff, other people, shelter, lighting, or assistance.

Only safe places within approximately **200 meters of the selected route** contribute to the Safety Score.

### Safe Place Rating

| Points | Place Types |
|---:|---|
| +5 | Police station, Fire station, Hospital, Emergency ward, Campus police |
| +4 | Urgent care, Clinic |
| +3 | Library, Government building, Community center, Hotel |
| +2 | Pharmacy, Supermarket |
| +1 | Convenience store, Restaurant, Cafe, Transit station |

### How Safe Place Points Are Calculated

Buddy Walk first checks whether a safe place is close enough to the selected route.

The score also considers whether the location is usable.

- Private or restricted-access location: **0 points**
- Confirmed open location: **full points**
- Opening hours unknown: approximately **60% of the normal points**, with a minimum of 1 point
- Confirmed closed location: **0 points**

For example, if a route passes near:

- 1 hospital: **+5**
- 1 library: **+3**
- 2 cafes: **+1 each**

The route receives:

**5 + 3 + 1 + 1 = 10 safe-place points**


### Safe Place Data Source

Safe-place locations are retrieved using:

- **OpenStreetMap**: https://www.openstreetmap.org/
---

## 2. Streetlight Coverage

Buddy Walk estimates how much of a walking route passes near mapped streetlights.

Routes with better streetlight coverage receive more points.

### Streetlight Rating

| Streetlight Coverage | Points |
|---|---:|
| 80% or more | +15 |
| 50%–79% | +10 |
| 20%–49% | +5 |
| Below 20% | 0 |

### How Streetlight Coverage Is Calculated

Buddy Walk samples multiple positions along the selected walking route.

For each sampled location, the system checks whether a mapped streetlight is located nearby.

The percentage of the route that is close to streetlights becomes the estimated **Streetlight Coverage**.

For example:

- Total sampled route length: **1,000 meters**
- Route near mapped streetlights: **720 meters**

Streetlight coverage is approximately:

**720 / 1000 = 72%**

According to the scoring table, a route with **72% streetlight coverage** receives:

**+10 points**

### Streetlight Data Source

Streetlight locations come from the **City of Atlanta public ArcGIS streetlight dataset**:https://www.arcgis.com/apps/mapviewer/index.html?url=https://services5.arcgis.com/5RxyIIJ9boPdptdo/ArcGIS/rest/services/COA_Street_lights/FeatureServer/0&source=sd.

---

## 3. Crime / Incident Risk 

Buddy Walk checks recent crime and incident records near each route.

Only incidents located within approximately **150 meters of the route** are considered.

Incidents are divided into five custom risk levels.

More serious incidents receive a larger penalty and remain relevant for a longer period.

### Crime Rating

| Risk Level | Penalty per Incident | Time Window | Crime Types |
|---:|---:|---|---|
| 1 | -1 | Last 7 days | Drug offense / possession, Vandalism / property damage |
| 2 | -2 | Last 7 days | Shoplifting / retail theft, Theft / larceny |
| 3 | -3 | Last 14 days | Vehicle theft, Burglary, Simple assault |
| 4 | -4 | Last 30 days | Robbery, Aggravated assault, Weapons offense |
| 5 | -5 | Last 30 days | Shooting, Sexual offense, Kidnapping, Homicide |

These risk levels are **Buddy Walk's custom hackathon classification**. They are not official Atlanta Police Department severity ratings.

### Why Different Time Windows Are Used

Lower-level incidents are only considered for a shorter period, while more serious incidents remain relevant for longer.

Buddy Walk uses:

- Risk Levels 1–2: incidents from the **last 7 days**
- Risk Level 3: incidents from the **last 14 days**
- Risk Levels 4–5: incidents from the **last 30 days**

This prevents older lower-risk incidents from affecting a route indefinitely while still giving recent serious incidents a stronger influence on the Safety Score.

### How Crime Points Are Calculated

Each eligible incident receives a penalty based on its risk level.

For example:

- 1 theft: **-2**
- 1 simple assault: **-3**
- 1 robbery: **-4**

The total penalty would be:

**-2 - 3 - 4 = -9 points**

If a single incident contains several offense descriptions, Buddy Walk counts only the **highest-risk eligible offense** for that incident.

This helps prevent the same incident from being counted multiple times.

### Crime Data Source

Crime data comes from **Atlanta's public ArcGIS crime dataset**: https://www.arcgis.com/apps/dashboards/af4a3506502f4e9fa81b2b3f63c61397#
The dataset provides information such as:

- report date
- offense description
- crime classification or code
- incident identifier
- location information

Buddy Walk uses this public information to determine whether recent incidents occurred close to a proposed route.

---

## 4. Connectivity — -10 to +10 points

Buddy Walk includes connectivity as an additional route factor.

A stronger network connection may help users:

- make phone or internet calls
- send messages
- load maps
- access online safety tools
- communicate with friends or family
- access emergency information

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

Buddy Walk samples multiple locations along a route and calculates the average connectivity value.

For example, suppose five sampled locations have these connectivity values:

- 6
- 7
- 5
- 8
- 4

The average is:

**(6 + 7 + 5 + 8 + 4) / 5 = 6**

The route therefore receives:

**Connectivity Score = +6**

The connectivity contribution is limited to:

**-10 to +10 points**

### Current Connectivity Data Source

The current connectivity layer uses **synthetic demo data generated by Buddy Walk**.

It is not official Cox coverage information.

The demo model gives stronger connectivity values around areas such as:

- university campuses
- dense residential areas
- mixed-use areas
- busy urban areas

Other regions are assigned lower values to create realistic variation across the map.

This feature demonstrates how real connectivity information could potentially be integrated into safety-aware navigation in the future.

---

# Complete Safety Score Example

Assume Buddy Walk evaluates one walking route.

## Starting Score

The route begins with:

**50 points**

## Safe Places

The route passes near:

- 1 hospital: **+5**
- 1 library: **+3**
- 1 cafe: **+1**

Total Safe Place Points:

**+9**

## Streetlights

Approximately **65%** of the route is near mapped streetlights.

According to the streetlight scoring system:

**Streetlight Points = +10**

## Crime

Recent eligible incidents near the route include:

- 1 theft: **-2**
- 1 robbery: **-4**

Total Crime Points:

**-6**

## Connectivity

The average connectivity value along the route is:

**+5**

## Final Calculation

The final Safety Score is:

**50 + 9 + 10 - 6 + 5 = 68**

Therefore:

**Safety Score = 68 / 100**

---

# Safety Score Categories

| Score | Category |
|---:|---|
| 0–25 | High Risk |
| 25–50 | Lower Safety |
| 50–75 | Moderate / Safer |
| 75–100 | Safer |

A score of **68** belongs to the **50–75** category.

The route would therefore be classified as:

**Moderate / Safer**

---

# Safety Score Formula

The overall concept can be summarized as:

**Safety Score = 50 + Safe Place Score + Streetlight Score + Crime Score + Connectivity Score**

After all factors are combined, the final value is limited to:

**0 ≤ Safety Score ≤ 100**

---

# Data Source Summary

| Criterion | Source | Data Type |
|---|---|---|
| Base Map | OpenStreetMap | Real |
| Destination Search | OpenStreetMap Nominatim | Real |
| Walking Routes | OpenRouteService + OpenStreetMap | Real |
| Safe Places | OpenStreetMap + Overpass API | Real mapped POI data |
| Streetlights | City of Atlanta ArcGIS | Real public inventory data |
| Crime Incidents | Atlanta public ArcGIS crime dataset | Real public incident data |
| Connectivity | Buddy Walk generated model | Synthetic demo data |
| Safety Score Weights | Buddy Walk | Custom heuristic |

---
