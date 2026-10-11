# SafeRoute Safety Score Criteria

Each route starts at **50 points**.

## Formula

```text
Final Safety Score =
50
+ Streetlight Points
+ Safe Place Points
+ Crime Points
+ Internet / Connectivity Points
```

Final score is capped between **0 and 100**.

## 1. Streetlights

| Condition | Points |
|---|---:|
| Very well lit | +15 |
| Good lighting | +10 |
| Some lighting | +5 |
| Poor lighting | -5 |
| Very dark | -10 |

## 2. Safe Places

| Trust level | Points per open place | Place types |
|---|---:|---|
| Very High Trust | +5 | Police, fire station, hospital / ER, campus police |
| High Trust | +4 | Urgent care, clinic |
| Medium Trust | +3 | Library, government building, community center, hotel |
| Low-Medium Trust | +2 | Pharmacy, grocery store |
| Low Trust | +1 | Convenience store, restaurant, cafe, transit station |

Add the full weight of each eligible place within 150 m of the route. **No Safe Haven cap.** Only the final overall score is capped at 100.

A place contributes only when its mapped opening hours indicate it is open now and it has no mapped private/restricted access. Closed places, missing hours, unsupported schedules, and unknown timezones contribute 0. Emergency facilities are not automatically assumed to be open 24/7. Listed hours do not guarantee admission or working services. Scores refresh every minute, using current time rather than estimated arrival time.

The MVP supports 24/7, daily or weekday/range schedules, split time intervals, overnight hours, and explicit closed days. Holiday, seasonal, appointment-only, or other complex expressions remain unknown. Atlanta-area schedules use America/New_York; elsewhere an explicit timezone tag is required for timed schedules.

## 3. Crime / Incident Risk

Crime uses a simple **1-5 risk level**. The penalty is the negative of the risk level, and lower-severity incidents expire sooner.

| Crime type | Risk level | Penalty | Count only if reported within |
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

For each route, count only distinct eligible incidents within **150 m**. Risk levels **1-2** are counted only for the most recent **7 days**, risk level **3** for the most recent **14 days**, and risk levels **4-5** for the most recent **30 days**. If a single incident contains multiple eligible offenses, count only its highest risk level. The **combined crime deduction remains capped at -25 points** so crime stays important without overwhelming lighting, safe places, and connectivity. Future-dated records, records outside the severity-specific time window, and unrecognized offenses are not scored. Shooting requires an explicit shooting description, not merely firearm involvement.

## 5. Internet / Connectivity

| Condition | Points |
|---|---:|
| Strong connectivity | +10 |
| Good connectivity | +5 |
| Average connectivity | 0 |
| Weak connectivity | -5 |
| Very weak / dead zone | -10 |

## Final Score Categories

| Score | Category |
|---|---|
| 85–100 | Excellent |
| 70–84 | Safer |
| 55–69 | Moderate |
| 40–54 | Caution |
| 0–39 | Higher Caution |

## Example

```text
Route A

Starting Score        50
Streetlights         +10
Safe Places          +10
Crime                 -5
Connectivity      +5
                     ----
Final Score           60
```

```text
Route B

Starting Score        50
Streetlights         +15
Safe Places          +15
Crime                 -3
Connectivity     +10
                     ----
Final Score           87
```

This score is a recommendation heuristic, not a guarantee that a route is completely safe.
