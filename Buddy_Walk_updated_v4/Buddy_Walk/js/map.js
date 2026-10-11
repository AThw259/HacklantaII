import {
  placeType,
  havenStatus,
  trustPoints,
  havenCriteriaLabel
} from "./havens.js?v=grid-4";


import {
  distinctRoutes,
  detourPoints
} from "./route-options.js?v=routes-1";


import {
  loadRouteEvidence
} from "./arcgis.js?v=grid-4";


import {
  distance,
  distanceToRoute,
  scoreRoute
} from "./scoring.js?v=grid-4";


import {
  connectivityCells,
  connectivityAtPoint,
  connectionColor,
  connectionLabel,
  routeConnectivity
} from "./connectivity.js?v=grid-4";


const $ =
  id =>
    document.getElementById(
      id
    );


let key =
  "";

let origin =
  null;

let target =
  null;

let rawRoutes =
  [];

let havens =
  [];

let havenKnown =
  false;

let havenCenter =
  null;

let havenRequestCenter =
  null;

let havenLoadPromise =
  null;

let havenRequestVersion =
  0;

let selected =
  null;

let revision =
  0;

let lastSearch =
  0;

let scoredRoutes =
  [];

let routeSafetyActive =
  false;

let safetyWatchId =
  null;

let safetyLastPosition =
  null;

let inactivityTimer =
  null;

let safetyCountdownTimer =
  null;

let alarmTimer =
  null;

let alarmContext =
  null;

// Standalone presenter demo state. This follows the uploaded SafeRoute demo
// pattern: a direct 10-second timer triggered by the Demo button, so the
// demo does not depend on GPS updates arriving during a judging session.
let demoAlarmTimer =
  null;

let demoSafetyCheckActive =
  false;

let demoSafetyMode =
  false;

let expandedSafePlaces =
  false;


// ===============================
// ROUTE SAFETY SETTINGS
// ===============================
// After the user actively chooses a route, Buddy Walk watches for meaningful
// movement. Normal route monitoring waits five minutes. A separate presenter
// demo button uses a deterministic 10-second timer, then opens a 15-second
// safety check. If that check is unanswered, the alarm starts and the app opens
// the device's 911 call flow. Browsers cannot silently complete the call.
const ROUTE_INACTIVITY_TIME =
  5 * 60 * 1000;

const DEMO_ROUTE_INACTIVITY_TIME =
  10 * 1000;

// Dedicated hackathon demo button delay. Kept separate from the real
// route-monitoring timer so the presenter demo is deterministic.
const DEMO_ALARM_DELAY =
  10 * 1000;

const SAFETY_CHECK_SECONDS =
  30;

const DEMO_SAFETY_CHECK_SECONDS =
  15;

// GPS often drifts a few meters even while a person is standing still.
const MOVEMENT_THRESHOLD_METERS =
  20;

const DEMO_MOVEMENT_THRESHOLD_METERS =
  10;

// Once the user is very close to the destination, stop inactivity monitoring
// so standing still after arrival cannot trigger an emergency flow.
const DESTINATION_ARRIVAL_METERS =
  35;

// Safe places are queried in a 2.5 km radius. Refresh only after the user has
// moved far enough that the existing set is no longer a good local view.
const SAFE_PLACE_REFRESH_DISTANCE =
  1200;

const DEFAULT_MAP_CENTER = [
  33.7490,
  -84.3880
];

const EMERGENCY_CALL_URI =
  "tel:911";

function inactivityDelay() {
  return demoSafetyMode
    ? DEMO_ROUTE_INACTIVITY_TIME
    : ROUTE_INACTIVITY_TIME;
}

function safetyCheckSeconds() {
  return demoSafetyMode
    ? DEMO_SAFETY_CHECK_SECONDS
    : SAFETY_CHECK_SECONDS;
}

function inactivityLabel() {
  return demoSafetyMode
    ? "10 seconds"
    : "5 minutes";
}

function movementThreshold() {
  return demoSafetyMode
    ? DEMO_MOVEMENT_THRESHOLD_METERS
    : MOVEMENT_THRESHOLD_METERS;
}

// =====================================================
// BASIC HELPERS
// =====================================================

function status(
  message
) {
  $("status")
    .textContent =
      message;
}


function element(
  tag,
  text = "",
  className = ""
) {
  const node =
    document.createElement(
      tag
    );


  node.textContent =
    text;


  if (
    className
  ) {
    node.className =
      className;
  }


  return node;
}


function pretty(
  value
) {
  return String(
    value
  )
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      letter =>
        letter.toUpperCase()
    );
}


async function request(
  url,
  options = {}
) {
  const response =
    await fetch(
      url,
      {
        ...options,

        signal:
          AbortSignal.timeout(
            25000
          )
      }
    );


  if (
    !response.ok
  ) {
    let details =
      {};


    try {
      details =
        await response.json();
    }

    catch {}


    if (
      details.code ===
      "NoSegment"
    ) {
      throw new Error(
        "No mapped walking path is close enough to the selected location."
      );
    }


    if (
      details.code ===
      "NoRoute"
    ) {
      throw new Error(
        "No connected walking route was found."
      );
    }


    throw new Error(
      `Service returned ${response.status}.`
    );
  }


  return response.json();
}


// =====================================================
// MAP
// =====================================================

if (
  !window.L
) {
  throw new Error(
    "Leaflet did not load."
  );
}


const map =
  L.map(
    "map",
    {
      zoomControl:
        false
    }
  )
    .setView(
      DEFAULT_MAP_CENTER,
      13
    );


L.control
  .zoom({
    position:
      "topright"
  })
  .addTo(
    map
  );


L.tileLayer(
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom:
      19,

    attribution:
      "&copy; OpenStreetMap contributors"
  }
)
  .addTo(
    map
  );


const routeLayer =
  L.layerGroup()
    .addTo(
      map
    );


const havenLayer =
  L.layerGroup()
    .addTo(
      map
    );


const connectivityLayer =
  L.layerGroup()
    .addTo(
      map
    );


// Canvas makes thousands of colored cells much faster.
const connectivityRenderer =
  L.canvas({
    padding:
      0.5
  });


const originMarker =
  L.circleMarker(
    [0, 0],
    {
      radius:
        8,

      color:
        "white",

      weight:
        3,

      fillColor:
        "#246baf",

      fillOpacity:
        1
    }
  )
    .bindPopup(
      "Your current location"
    );


let targetMarker =
  null;


// =====================================================
// CONNECTIVITY HEATMAP
// =====================================================

function renderConnectivityZones() {
  connectivityLayer
    .clearLayers();


  for (
    const cell of
      connectivityCells
  ) {
    const color =
      connectionColor(
        cell.score
      );


    L.rectangle(
      cell.bounds,
      {
        renderer:
          connectivityRenderer,

        stroke:
          false,

        fillColor:
          color,

        fillOpacity:
          0.20,

        // IMPORTANT:
        // users can still click the map through the heatmap.
        interactive:
          false
      }
    )
      .addTo(
        connectivityLayer
      );
  }
}


// =====================================================
// APP STATE
// =====================================================

function invalidate() {
  stopSafetyTracking();

  revision++;

  rawRoutes =
    [];

  scoredRoutes =
    [];

  selected =
    null;

  routeLayer
    .clearLayers();

  $("routes")
    .replaceChildren();

  $("route-count")
    .textContent =
      "0 ROUTES";

  renderSelectedRouteDetails();
}


function setTarget(
  point,
  name
) {
  invalidate();


  target =
    point;


  $("destination")
    .value =
      name;


  if (
    targetMarker
  ) {
    targetMarker
      .remove();
  }


  targetMarker =
    L.marker(
      point
    )
      .addTo(
        map
      )
      .bindPopup(
        name
      );


  const cell =
    connectivityAtPoint(
      point
    );


  if (
    cell
  ) {
    status(
      `Destination selected · Demo connectivity: ${connectionLabel(cell.score)} (${cell.score > 0 ? "+" : ""}${cell.score}). Compare routes to continue.`
    );
  }

  else {
    status(
      "Destination selected. Compare routes to plan this walk."
    );
  }
}


function setLive() {
  $("mode-badge")
    .textContent =
      "LIVE ROUTES · DEMO CONNECTIVITY";
}


// Click map to select destination.
map.on(
  "click",
  event => {
    setTarget(
      [event.latlng.lat, event.latlng.lng],
      "Selected map location"
    );
  }
);


// =====================================================
// ROUTE CARDS + ROUTE LINES
// =====================================================

function signedScore(value) {
  if (!Number.isFinite(value)) {
    return "N/A";
  }

  const rounded =
    Math.round(value * 10) / 10;

  return `${rounded > 0 ? "+" : ""}${rounded}`;
}


function routeDisplayName(route) {
  const index =
    scoredRoutes.findIndex(
      item => item.id === route.id
    );

  return `Route ${index >= 0 ? index + 1 : 1}`;
}


function routeRecommendation(route) {
  if (!scoredRoutes.length) {
    return route.category;
  }

  const fastest =
    Math.min(
      ...scoredRoutes.map(
        item => item.duration
      )
    );

  if (route.id === scoredRoutes[0]?.id) {
    return "Safest route";
  }

  if (route.duration === fastest) {
    return "Fastest option";
  }

  return route.category;
}


function routeLineColor(route, active) {
  if (active) {
    return "#1a73e8";
  }

  if (route.score >= 75) {
    return "#2a9d5b";
  }

  if (route.score >= 55) {
    return "#d79a2b";
  }

  return "#c84a42";
}


function routeSafePlaces(route) {
  return havens
    .map(
      place => ({
        place,
        routeDistance:
          distanceToRoute(
            place.position,
            route.points
          )
      })
    )
    .filter(
      item =>
        item.routeDistance <= 300
    )
    .sort(
      (a, b) => {
        const aOpen =
          havenStatus(a.place).state === "open"
            ? 0
            : 1;

        const bOpen =
          havenStatus(b.place).state === "open"
            ? 0
            : 1;

        return (
          aOpen - bOpen ||
          a.routeDistance - b.routeDistance
        );
      }
    );
}


function generateScoreExplanation(route) {
  const reasons = [];
  const cautions = [];
  const breakdown = route.breakdown;

  if (breakdown.safePlaces >= 10) {
    reasons.push("several nearby public or trusted places");
  }
  else if (breakdown.safePlaces > 0) {
    reasons.push("some nearby Safe Places");
  }

  if (breakdown.lighting >= 10) {
    reasons.push("strong mapped streetlight coverage");
  }
  else if (breakdown.lighting < 0) {
    cautions.push("weaker lighting coverage");
  }

  if (breakdown.crime === 0) {
    reasons.push("no scored recent crime penalty");
  }
  else if (breakdown.crime < 0) {
    cautions.push("recent crime reports near the route");
  }

  if (breakdown.connectivity >= 5) {
    reasons.push("stronger demo connectivity");
  }
  else if (breakdown.connectivity < 0) {
    cautions.push("weaker demo connectivity");
  }
const good =
    reasons.length
      ? reasons.slice(0, 3).join(", ")
      : "the available route evidence";

  const caution =
    cautions.length
      ? ` The main caution is ${cautions.slice(0, 2).join(" and ")}.`
      : "";

  return `This route scores ${route.score}/100 based on ${good}.${caution}`;
}


function renderSelectedRouteDetails() {
  const container =
    $("route-details");

  const route =
    scoredRoutes.find(
      item => item.id === selected
    );

  if (!route) {
    $("sheet-title").textContent =
      "Choose a destination";

    container.innerHTML = `
      <div class="empty-route-details">
        <div class="empty-icon">↗</div>
        <h2>Plan a route to compare safety</h2>
        <p>Search for a destination above, then choose among the available walking routes.</p>
      </div>`;

    return;
  }

  const name =
    routeDisplayName(route);

  $("sheet-title").textContent =
    `${name} · ${Math.round(route.duration / 60)} min`;

  container.replaceChildren();

  const hero =
    element("div", "", "detail-hero");

  const heroText =
    element("div");

  heroText.append(
    element("span", routeRecommendation(route).toUpperCase(), "sheet-kicker"),
    element("h2", name),
    element(
      "div",
      `${Math.round(route.duration / 60)} min · ${(route.distance / 1609.344).toFixed(1)} mi · ${(route.distance / 1000).toFixed(1)} km`,
      "detail-meta"
    )
  );

  hero.append(
    heroText,
    element("div", String(route.score), "detail-score")
  );

  container.append(hero);

  const scoreSection =
    element("section", "", "detail-section");

  scoreSection.append(
    element("h3", "Why this score?")
  );

  const scoreGrid =
    element("div", "", "score-grid");

  const scoreItems = [
    ["Starting score", route.breakdown.base],
    ["Safe places", route.breakdown.safePlaces],
    ["Lighting", route.breakdown.lighting],
    ["Recent crime", route.breakdown.crime],
    ["Connectivity", route.breakdown.connectivity]
  ];

  for (const [label, value] of scoreItems) {
    const item =
      element(
        "div",
        "",
        `score-item ${value > 0 && label !== "Starting score" ? "positive" : value < 0 ? "negative" : ""}`
      );

    item.append(
      element("span", label),
      element(
        "strong",
        label === "Starting score"
          ? String(value)
          : signedScore(value)
      )
    );

    scoreGrid.append(item);
  }

  scoreSection.append(
    scoreGrid,
    element(
      "p",
      generateScoreExplanation(route),
      "explanation"
    )
  );

  container.append(scoreSection);

  const safePlaceSection =
    element("section", "", "detail-section");

  safePlaceSection.append(
    element("h3", "Safe places on this chosen route")
  );

  const safePlaceList =
    element("div", "", "place-list");

  const routePlaces =
    routeSafePlaces(route);

  if (!routePlaces.length) {
    safePlaceList.append(
      element(
        "p",
        "No mapped safe place was found within 300 m of this route.",
        "data-note"
      )
    );
  }

  for (const item of routePlaces.slice(0, 8)) {
    const current =
      havenStatus(item.place);

    const row =
      element("div", "", "place-row");

    const text =
      element("div");

    text.append(
      element("strong", item.place.name),
      element(
        "small",
        `${pretty(item.place.type)} · ${Math.round(item.routeDistance)} m from route`
      )
    );

    row.append(
      text,
      element(
        "span",
        current.label,
        current.state === "open"
          ? "status-open"
          : current.state === "closed"
            ? "status-closed"
            : "status-unknown"
      )
    );

    row.onclick =
      () => {
        map.setView(item.place.position, 17);
      };

    safePlaceList.append(row);
  }

  safePlaceSection.append(
    safePlaceList,
    element(
      "p",
      `${routePlaces.length} mapped safe place${routePlaces.length === 1 ? "" : "s"} within 300 m of this route.`,
      "data-note"
    )
  );

  container.append(safePlaceSection);

  const crimeSection =
    element("section", "", "detail-section");

  crimeSection.append(
    element("h3", "Recent crime near this route")
  );

  const crimeList =
    element("div", "", "crime-list");

  const incidents =
    route.evidence?.crimeIncidents || [];

  if (!incidents.length) {
    crimeList.append(
      element(
        "p",
        route.unknown.includes("crime")
          ? "Current crime data is unavailable for this route."
          : "No classified recent incidents were returned within 150 m of this route.",
        "data-note"
      )
    );
  }

  for (const incident of incidents.slice(0, 6)) {
    const row =
      element("div", "", "crime-row");

    const text =
      element("div");

    text.append(
      element("strong", pretty(incident.type)),
      element(
        "small",
        `${Math.round(incident.routeDistance)} m from route · ${incident.daysAgo === 0 ? "today" : `${incident.daysAgo} day${incident.daysAgo === 1 ? "" : "s"} ago`}`
      )
    );

    row.append(
      text,
      element(
        "span",
        signedScore(incident.points),
        "status-closed"
      )
    );

    crimeList.append(row);
  }

  crimeSection.append(
    crimeList,
    element(
      "p",
      "Crime data uses recent public Atlanta records returned by the existing ArcGIS source. Counts are route context, not a prediction of personal safety.",
      "data-note"
    )
  );

  container.append(crimeSection);
}


function selectRoute(routeId, shouldScroll = false) {
  if (!scoredRoutes.some(route => route.id === routeId)) {
    return;
  }

  selected = routeId;
  drawRoutes();
  startSafetyTracking();

  if (shouldScroll) {
    requestAnimationFrame(
      () => {
        $("routes")
          .querySelector(`[data-route-id="${routeId}"]`)
          ?.scrollIntoView({
            behavior: "smooth",
            inline: "center",
            block: "nearest"
          });
      }
    );
  }
}


function drawRoutes() {
  const scrollLeft =
    $("routes").scrollLeft;

  routeLayer.clearLayers();
  $("routes").replaceChildren();

  scoredRoutes =
    rawRoutes
      .map(
        route =>
          scoreRoute(
            route,
            havens,
            [],
            route.evidence
          )
      )
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.duration - b.duration
      );

  if (
    !scoredRoutes.some(
      route => route.id === selected
    )
  ) {
    selected =
      scoredRoutes[0]?.id || null;
  }

  $("route-count").textContent =
    `${scoredRoutes.length} ROUTE${scoredRoutes.length === 1 ? "" : "S"}`;

  for (const route of scoredRoutes) {
    const active =
      route.id === selected;

    const line =
      L.polyline(
        route.points,
        {
          color: routeLineColor(route, active),
          weight: active ? 7 : 5,
          opacity: active ? 1 : .72
        }
      )
        .addTo(routeLayer);

    if (active) {
      line.bringToFront();
    }

    line.on(
      "click",
      () => selectRoute(route.id, true)
    );

    const card =
      element(
        "button",
        "",
        `route${active ? " selected" : ""}`
      );

    card.type = "button";
    card.dataset.routeId = route.id;
    card.setAttribute("aria-pressed", String(active));

    const top =
      element("div", "", "route-top");

    top.append(
      element("span", routeDisplayName(route), "route-title")
    );

    const score =
      element("span", String(route.score), "route-score");

    score.append(
      element("small", " /100")
    );

    top.append(score);

    const metrics =
      element("div", "", "metrics");

    metrics.append(
      element(
        "span",
        `${route.nearby} safe place${route.nearby === 1 ? "" : "s"}`,
        "metric-pill"
      ),
      element(
        "span",
        route.connectivity === null
          ? "Connectivity N/A"
          : `Connection ${signedScore(route.connectivity)}`,
        "metric-pill"
      )
    );

    card.append(
      top,
      element("div", routeRecommendation(route), "recommend"),
      element(
        "div",
        `${Math.round(route.duration / 60)} min · ${(route.distance / 1609.344).toFixed(1)} mi`,
        "route-meta"
      ),
      metrics
    );

    card.onclick =
      () => selectRoute(route.id, false);

    $("routes").append(card);
  }

  $("routes").scrollLeft = scrollLeft;

  $("routes-prev").disabled =
    scoredRoutes.length < 2;

  $("routes-next").disabled =
    scoredRoutes.length < 2;

  renderSelectedRouteDetails();
}


// =====================================================
// SAFE PLACE DISPLAY
// =====================================================

function placePopup(
  place
) {
  const current =
    havenStatus(
      place
    );


  const base =
    trustPoints[
      place.type
    ] ||
    0;


  const container =
    element(
      "div"
    );


  container.append(
    element(
      "strong",
      place.name
    ),

    element(
      "div",
      `${pretty(place.type)} · ${havenCriteriaLabel(place.type)}`
    ),

    element(
      "div",
      `Base +${base} · Current +${current.points}`,
      "small"
    ),

    element(
      "div",
      current.label,
      "small"
    )
  );


  const button =
    element(
      "button",
      "Set as destination"
    );


  button.onclick =
    () => {
      setTarget(
        place.position,
        place.name
      );


      map.closePopup();
    };


  container.append(
    button
  );


  return container;
}


function renderHavens() {
  havenLayer.clearLayers();

  if (!havens.length) {
    return;
  }

  const sorted =
    [...havens].sort((a, b) =>
      origin
        ? distance(origin, a.position) - distance(origin, b.position)
        : 0
    );

  // Display every loaded safe place on the map. The list is intentionally
  // kept out of the route-detail sheet; the green circular action handles
  // finding the nearest usable place.
  for (const place of sorted) {
    const current =
      havenStatus(place);

    L.circleMarker(
      place.position,
      {
        radius: 8,
        color: "white",
        weight: 2,
        fillColor:
          current.points > 0
            ? "#217a59"
            : "#83978d",
        fillOpacity: 1
      }
    )
      .addTo(havenLayer)
      .bindPopup(placePopup(place));
  }
}


// =====================================================
// SAFE PLACE API
// =====================================================

const havenCache =
  new Map();


const OVERPASS_SERVERS = [
  "https://overpass-api.de/api/interpreter",

  "https://overpass.private.coffee/api/interpreter"
];


async function runOverpass(
  query
) {
  let lastError =
    null;


  for (
    const server of
      OVERPASS_SERVERS
  ) {
    try {
      console.log(
        "Trying Safe Place server:",
        server
      );


      const response =
        await fetch(
          server,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded;charset=UTF-8"
            },

            body:
              new URLSearchParams({
                data:
                  query
              }),

            signal:
              AbortSignal.timeout(
                18000
              )
          }
        );


      if (
        !response.ok
      ) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }


      const data =
        await response.json();


      if (
        !Array.isArray(
          data.elements
        )
      ) {
        throw new Error(
          "Invalid Safe Place response"
        );
      }


      return data;
    }

    catch (
      error
    ) {
      console.warn(
        "Safe Place server failed:",
        server,
        error
      );


      lastError =
        error;
    }
  }


  throw (
    lastError ||
    new Error(
      "All Safe Place services failed."
    )
  );
}


function parseHavens(
  data
) {
  const places =
    [];


  const seen =
    new Set();


  for (
    const item of
      data.elements
  ) {
    const lat =
      item.lat ??
      item.center?.lat;


    const lng =
      item.lon ??
      item.center?.lon;


    if (
      !Number.isFinite(
        lat
      ) ||
      !Number.isFinite(
        lng
      )
    ) {
      continue;
    }


    const tags =
      item.tags ||
      {};


    const type =
      placeType(
        tags
      );


    if (
      !type
    ) {
      continue;
    }


    const id =
      `${item.type}-${item.id}`;


    if (
      seen.has(
        id
      )
    ) {
      continue;
    }


    seen.add(
      id
    );


    places.push({
      id,

      name:
        tags.name ||
        pretty(
          type
        ),

      type,

      hours:
        tags.opening_hours,

      access:
        tags.access,

      position: [
        lat,
        lng
      ]
    });
  }


  return places;
}


async function loadHavens(
  center,
  { expanded = false } = {}
) {
  const [
    lat,
    lng
  ] =
    center;


  const cacheKey =
    `${lat.toFixed(4)},${lng.toFixed(4)},${expanded ? "expanded" : "core"}`;


  if (
    havenCache.has(
      cacheKey
    )
  ) {
    return havenCache.get(
      cacheKey
    );
  }


  const radius =
    expanded ? 3200 : 2500;

  const extraRadius =
    2200;

  const expandedQueries =
    expanded
      ? `
  nwr["shop"="convenience"](around:${extraRadius},${lat},${lng});
  nwr["amenity"="cafe"](around:${extraRadius},${lat},${lng});
  nwr["amenity"="restaurant"](around:${extraRadius},${lat},${lng});
  nwr["railway"="station"](around:${extraRadius},${lat},${lng});
  nwr["public_transport"="station"](around:${extraRadius},${lat},${lng});
  nwr["emergency"="emergency_ward_entrance"](around:${radius},${lat},${lng});
  nwr["healthcare"="emergency_ward"](around:${radius},${lat},${lng});`
      : "";

  const query = `
[out:json][timeout:20];

(
  nwr["amenity"="police"](around:${radius},${lat},${lng});
  nwr["amenity"="fire_station"](around:${radius},${lat},${lng});
  nwr["amenity"="hospital"](around:${radius},${lat},${lng});
  nwr["amenity"="clinic"](around:${radius},${lat},${lng});
  nwr["amenity"="library"](around:${radius},${lat},${lng});
  nwr["amenity"="community_centre"](around:${radius},${lat},${lng});
  nwr["amenity"="pharmacy"](around:${radius},${lat},${lng});
  nwr["healthcare"="urgent_care"](around:${radius},${lat},${lng});
  nwr["office"="government"](around:${radius},${lat},${lng});
  nwr["tourism"="hotel"](around:${radius},${lat},${lng});
  nwr["shop"="supermarket"](around:${radius},${lat},${lng});
${expandedQueries}
);

out center tags;
`;


  const data =
    await runOverpass(
      query
    );


  const places =
    parseHavens(
      data
    );


  havenCache.set(
    cacheKey,
    places
  );


  return places;
}


async function updateSafePlacesIfNeeded(
  center,
  { force = false, expanded = expandedSafePlaces } = {}
) {
  if (!center) {
    return havens;
  }

  if (
    !force &&
    havenKnown &&
    havenCenter &&
    distance(center, havenCenter) < SAFE_PLACE_REFRESH_DISTANCE
  ) {
    return havens;
  }

  if (
    !force &&
    havenLoadPromise &&
    havenRequestCenter &&
    distance(center, havenRequestCenter) < SAFE_PLACE_REFRESH_DISTANCE
  ) {
    return havenLoadPromise;
  }

  const requestVersion =
    ++havenRequestVersion;

  const requestCenter =
    [...center];

  havenRequestCenter =
    requestCenter;

  const request =
    (async () => {
      try {
        const places =
          await loadHavens(
            requestCenter,
            { expanded }
          );

        // A newer request may have started while this one was loading.
        if (requestVersion !== havenRequestVersion) {
          return havens;
        }

        havens =
          places;

        if (expanded) {
          expandedSafePlaces =
            true;
        }

        havenKnown =
          true;

        havenCenter =
          requestCenter;

        renderHavens();

        // Safe-place proximity affects route scoring, so refresh the visible
        // route cards only when routes already exist.
        if (rawRoutes.length) {
          drawRoutes();
        }

        return havens;
      }
      catch (error) {
        if (requestVersion === havenRequestVersion) {
          console.warn(
            "Safe Place update failed:",
            error
          );
        }

        throw error;
      }
      finally {
        if (requestVersion === havenRequestVersion) {
          havenLoadPromise =
            null;

          havenRequestCenter =
            null;
        }
      }
    })();

  havenLoadPromise =
    request;

  return request;
}


function primeSafePlacesOnLaunch() {
  // Start the safe-place request as part of app startup. It does NOT depend on
  // choosing a destination. The default Atlanta map center gives the map data
  // immediately while browser geolocation is resolving; once location is
  // available, useCurrentLocation() updates the set only when necessary.
  updateSafePlacesIfNeeded(
    DEFAULT_MAP_CENTER,
    { force: true, expanded: false }
  )
    .then(() => {
      if (!origin) {
        status("Safe places loaded. Finding your location...");
      }
    })
    .catch(error => {
      console.warn("Initial Safe Place load failed:", error);
      // The app can still route if the external place service is unavailable.
    });
}


// =====================================================
// LOCATION
// =====================================================

function locate() {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      if (
        !navigator.geolocation
      ) {
        reject(
          new Error(
            "Location is unavailable."
          )
        );


        return;
      }


      navigator.geolocation
        .getCurrentPosition(
          position => {
            resolve([
              position.coords
                .latitude,

              position.coords
                .longitude
            ]);
          },


          () => {
            reject(
              new Error(
                "Location permission was denied or unavailable."
              )
            );
          },


          {
            enableHighAccuracy:
              true,

            timeout:
              12000,

            maximumAge:
              30000
          }
        );
    }
  );
}


function updateOrigin(
  point
) {
  origin =
    point;


  originMarker
    .setLatLng(
      point
    )
    .addTo(
      map
    );


  $("origin")
    .value =
      "Your current location";


  map.setView(
    point,
    15
  );
}


async function useCurrentLocation() {
  try {
    status(
      "Finding your location..."
    );


    const point =
      await locate();


    updateOrigin(
      point
    );

    status(
      "Location ready. Loading nearby safe places..."
    );

    try {
      await updateSafePlacesIfNeeded(point);
      status(
        "Location ready. Safe places loaded. Search for a destination."
      );
    }
    catch {
      status(
        "Location ready. Safe-place data is temporarily unavailable. You can still search for a destination."
      );
    }
  }

  catch (
    error
  ) {
    status(
      error.message
    );
  }
}


// =====================================================
// DESTINATION SEARCH
// =====================================================

$("search-form")
  .onsubmit =
    async event => {
      event
        .preventDefault();


      const query =
        $("destination")
          .value
          .trim();


      if (
        query.length <
        3
      ) {
        status(
          "Enter at least 3 characters."
        );


        return;
      }


      if (
        Date.now() -
          lastSearch <
        1100
      ) {
        status(
          "Please wait a moment before searching again."
        );


        return;
      }


      lastSearch =
        Date.now();


      $("search-results")
        .replaceChildren();


      status(
        "Searching OpenStreetMap..."
      );


      try {
        const data =
          await request(
            `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`
          );


        for (
          const place of
            data
        ) {
          const button =
            element(
              "button",
              place.display_name
            );


          button.onclick =
            () => {
              setTarget(
                [
                  Number(
                    place.lat
                  ),

                  Number(
                    place.lon
                  )
                ],

                place.display_name
              );


              $("search-results")
                .replaceChildren();


              map.setView(
                target,
                15
              );
            };


          $("search-results")
            .append(
              button
            );
        }


        status(
          data.length
            ? "Choose a destination."
            : "No destination found."
        );
      }

      catch (
        error
      ) {
        status(
          `Search unavailable: ${error.message}`
        );
      }
    };


// =====================================================
// ROUTING
// =====================================================

const walkingCache =
  new Map();


let lastWalkingRequest =
  0;


async function routeRequest(
  points,
  sessionKey = ""
) {
  const coordinates =
    points.map(
      point => [
        point[1],
        point[0]
      ]
    );


  const cacheId =
    JSON.stringify(
      [
        sessionKey
          ? "ors"
          : "public",

        coordinates
      ]
    );


  if (
    walkingCache.has(
      cacheId
    )
  ) {
    return walkingCache.get(
      cacheId
    );
  }


  const delay =
    Math.max(
      0,

      1100 -
      (
        Date.now() -
        lastWalkingRequest
      )
    );


  if (
    delay
  ) {
    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          delay
        )
    );
  }


  lastWalkingRequest =
    Date.now();


  let result;


  if (
    sessionKey
  ) {
    const body = {
      coordinates,

      instructions:
        false
    };


    if (
      points.length ===
      2
    ) {
      body.alternative_routes = {
        target_count:
          3,

        share_factor:
          0.4,

        weight_factor:
          1.6
      };
    }


    result =
      await request(
        "https://api.heigit.org/openrouteservice/v2/directions/foot-walking/geojson",
        {
          method:
            "POST",

          headers: {
            Authorization:
              sessionKey,

            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(
              body
            )
        }
      );
  }

  else {
    const path =
      coordinates
        .map(
          point =>
            point.join(
              ","
            )
        )
        .join(
          ";"
        );


    const data =
      await request(
        `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${path}?alternatives=3&overview=full&geometries=geojson&steps=false`
      );


    if (
      !data.routes?.length
    ) {
      throw new Error(
        "No walking route was found."
      );
    }


    result = {
      features:
        data.routes.map(
          route => ({
            geometry:
              route.geometry,

            properties: {
              summary: {
                distance:
                  route.distance,

                duration:
                  route.duration
              }
            }
          })
        )
    };
  }


  walkingCache.set(
    cacheId,
    result
  );


  return result;
}


async function findWalkingRoutes(
  from,
  to,
  version,
  sessionKey
) {
  const initial =
    await routeRequest(
      [
        from,
        to
      ],
      sessionKey
    );


  const candidates = [
    ...(
      initial.features ||
      []
    )
  ];


  let chosen =
    distinctRoutes(
      candidates
    );


  for (
    const waypoint of
      detourPoints(
        from,
        to
      )
  ) {
    if (
      version !==
        revision ||
      chosen.length >=
        5
    ) {
      break;
    }


    try {
      const extra =
        await routeRequest(
          [
            from,
            waypoint,
            to
          ],
          sessionKey
        );


      candidates.push(
        ...(
          extra.features ||
          []
        )
      );


      chosen =
        distinctRoutes(
          candidates
        );
    }

    catch {}
  }


  return chosen;
}


// =====================================================
// PLAN ROUTES
// =====================================================

$("plan")
  .onclick =
    async () => {
      if (
        !origin
      ) {
        status(
          "Your current location is not ready."
        );


        return;
      }


      if (
        !target
      ) {
        status(
          "Choose a destination first."
        );


        return;
      }


      if (
        distance(
          origin,
          target
        ) >
        15000
      ) {
        status(
          "Choose a destination within 15 km for this MVP."
        );


        return;
      }


      invalidate();


      const version =
        revision;


      $("plan")
        .disabled =
          true;


      status(
        "Finding walking routes..."
      );


      try {
        const features =
          await findWalkingRoutes(
            origin,
            target,
            version,
            key
          );


        // ==============================================
        // CREATE ROUTES + CONNECTIVITY SCORE
        // ==============================================

        rawRoutes =
          features
            .slice(
              0,
              5
            )
            .map(
              (
                feature,
                index
              ) => {
                const points =
                  feature.geometry
                    .coordinates
                    .map(
                      point => [
                        point[1],
                        point[0]
                      ]
                    );


                const connection =
                  routeConnectivity({
                    points
                  });


                return {
                  id:
                    `route-${index}`,

                  name:
                    `Walking route ${index + 1}`,

                  points,

                  distance:
                    feature.properties
                      .summary
                      .distance,

                  duration:
                    feature.properties
                      .summary
                      .duration,

                  evidence: {
                    connectivityPoints:
                      connection.points
                  },

                  dataNotes: [
                    connection.note,

                    "Connectivity is synthetic demo data, not official Cox coverage."
                  ]
                };
              }
            );


        if (
          !rawRoutes.length
        ) {
          throw new Error(
            "No routes found."
          );
        }


        // Safe places are loaded at app startup and refreshed from movement,
        // never because the user selected a destination or planned a route.
        status(
          "Checking lighting and crime..."
        );


        // Preserve synthetic connectivity while adding
        // crime/streetlight evidence.
        try {
          const previousRoutes =
            rawRoutes;


          const enriched =
            await loadRouteEvidence(
              rawRoutes
            );


          rawRoutes =
            enriched.map(
              (
                route,
                index
              ) => {
                const original =
                  previousRoutes[
                    index
                  ];


                return {
                  ...route,

                  evidence: {
                    ...route.evidence,

                    connectivityPoints:
                      original
                        ?.evidence
                        ?.connectivityPoints ??
                      0
                  },

                  dataNotes: [
                    ...(
                      route.dataNotes ||
                      []
                    ),

                    ...(
                      original
                        ?.dataNotes ||
                      []
                    )
                  ]
                };
              }
            );
        }

        catch (
          error
        ) {
          console.warn(
            "Lighting/crime lookup failed:",
            error
          );
        }


        selected =
          null;


        drawRoutes();


        map.fitBounds(
          L.latLngBounds(
            rawRoutes.flatMap(
              route =>
                route.points
            )
          ),
          {
            padding: [
              55,
              90
            ]
          }
        );


        status(
          `${rawRoutes.length} route(s) ready. Connectivity uses synthetic Georgia demo data.`
        );
      }

      catch (
        error
      ) {
        console.error(
          error
        );


        status(
          `Route failed: ${error.message}`
        );
      }

      finally {
        $("plan")
          .disabled =
            false;
      }
    };


// =====================================================
// RECENTER
// =====================================================

$("fit")
  .onclick =
    () => {
      if (
        rawRoutes.length
      ) {
        map.fitBounds(
          L.latLngBounds(
            rawRoutes.flatMap(
              route =>
                route.points
            )
          ),
          {
            padding: [
              55,
              90
            ]
          }
        );
      }

      else if (
        origin
      ) {
        map.setView(
          origin,
          15
        );
      }
    };


// =====================================================
// SETTINGS
// =====================================================

$("settings-button")
  .onclick =
    () =>
      $("settings-dialog")
        .showModal();


$("save-settings")
  .onclick =
    () => {
      key =
        $("api-key")
          .value
          .trim();


      $("api-key")
        .value =
          "";


      status(
        key
          ? "Routing API key set for this session."
          : "Using public walking routes."
      );
    };


document
  .querySelectorAll(
    "[data-close]"
  )
  .forEach(
    button => {
      button.onclick =
        () => {
          const dialog =
            $(
              button.dataset.close
            );


          dialog
            ?.close();
        };
    }
  );


// =====================================================
// ROUTE SAFETY + ALWAYS-AVAILABLE QUICK ACTIONS
// =====================================================

function stopAlarm() {
  clearInterval(alarmTimer);
  alarmTimer = null;

  if (navigator.vibrate) {
    navigator.vibrate(0);
  }
}


function alarmBeep() {
  try {
    if (!alarmContext) {
      alarmContext =
        new (
          window.AudioContext ||
          window.webkitAudioContext
        )();
    }

    if (alarmContext.state === "suspended") {
      alarmContext.resume();
    }

    const oscillator =
      alarmContext.createOscillator();

    const gain =
      alarmContext.createGain();

    oscillator.frequency.value =
      980;

    // Deliberately attention-grabbing for the emergency demo. The browser or
    // device still controls the user's actual media volume.
    gain.gain.value =
      0.18;

    oscillator
      .connect(gain)
      .connect(alarmContext.destination);

    oscillator.start();
    oscillator.stop(
      alarmContext.currentTime + 0.18
    );
  }
  catch (error) {
    console.warn(
      "Alarm audio unavailable:",
      error
    );
  }
}


function startAlarm() {
  stopAlarm();
  alarmBeep();

  alarmTimer =
    setInterval(
      alarmBeep,
      900
    );

  if (navigator.vibrate) {
    navigator.vibrate([
      350,
      180,
      350,
      180,
      700
    ]);
  }
}


function closeSafetyCheck() {
  const closingDemo =
    demoSafetyCheckActive;

  clearInterval(
    safetyCountdownTimer
  );

  safetyCountdownTimer =
    null;

  demoSafetyCheckActive =
    false;

  stopAlarm();

  if ($("safety-check-dialog").open) {
    $("safety-check-dialog").close();
  }

  if (closingDemo) {
    resetDemoButton();
  }
}


function attemptEmergencyCall({
  keepAlarm = false
} = {}) {
  if (!keepAlarm) {
    closeSafetyCheck();
  }

  $("unsafe-status").textContent =
    "Opening the phone emergency calling flow…";

  // A web page can open the device's 911 handler, but the browser/OS controls
  // whether the user must confirm before the call is actually placed.
  window.location.href =
    EMERGENCY_CALL_URI;
}


function showEmergencyConfirmation() {
  if (!$("emergency-dialog").open) {
    $("emergency-dialog").showModal();
  }
}


function showSafetyCheck(
  options = {}
) {
  const isDemo =
    Boolean(options.demo);

  if (!routeSafetyActive && !isDemo) {
    return;
  }

  // Pause the normal route timer while any safety check is on screen.
  clearTimeout(
    inactivityTimer
  );

  inactivityTimer =
    null;

  demoSafetyCheckActive =
    isDemo;

  // The popup itself is quiet. The alarm should only sound if the user does
  // not answer the safety check before the countdown reaches zero.
  stopAlarm();

  let remaining =
    isDemo
      ? DEMO_SAFETY_CHECK_SECONDS
      : SAFETY_CHECK_SECONDS;

  $("safety-countdown").textContent =
    String(remaining);

  $("safety-check-message").textContent =
    isDemo
      ? "DEMO: no movement has been detected for 10 seconds."
      : "No meaningful movement has been detected for 5 minutes.";

  $("unsafe-status").textContent =
    isDemo
      ? "DEMO · safety check active for 15 seconds"
      : "No movement for 5 minutes · safety check active for 30 seconds";

  if (isDemo) {
    const button =
      $("demo-alarm-button");

    if (button) {
      button.disabled =
        true;

      button.classList
        .remove("running");

      button.classList
        .add("checking");

      button.innerHTML =
        '<span aria-hidden="true">!</span><strong>Safety check</strong>';
    }
  }

  if (!$("safety-check-dialog").open) {
    $("safety-check-dialog").showModal();
  }

  clearInterval(
    safetyCountdownTimer
  );

  safetyCountdownTimer =
    setInterval(
      () => {
        remaining -= 1;

        $("safety-countdown").textContent =
          String(Math.max(remaining, 0));

        if (remaining > 0) {
          return;
        }

        clearInterval(
          safetyCountdownTimer
        );

        safetyCountdownTimer =
          null;

        const shouldEscalate =
          isDemo
            ? demoSafetyCheckActive
            : routeSafetyActive;

        if (!shouldEscalate) {
          closeSafetyCheck();
          return;
        }

        demoSafetyCheckActive =
          false;

        if ($("safety-check-dialog").open) {
          $("safety-check-dialog").close();
        }

        $("unsafe-status").textContent =
          "Safety check unanswered · alarm active · opening 911 call flow";

        // Only now, after the unanswered 15-second demo countdown (or the
        // normal safety check), make the loud alert sound.
        startAlarm();

        resetDemoButton();

        attemptEmergencyCall({
          keepAlarm: true
        });

        // Desktop browsers may have no telephone handler and remain here.
        window.setTimeout(
          () => stopAlarm(),
          15000
        );
      },
      1000
    );
}

function resetDemoButton() {
  const button =
    $("demo-alarm-button");

  if (!button) {
    return;
  }

  button.disabled =
    false;

  button.classList
    .remove(
      "running",
      "checking"
    );

  button.innerHTML =
    '<span aria-hidden="true">▶</span><strong>Demo 10s</strong>';
}


function stopDemoAlarm({
  closeCheck = false
} = {}) {
  clearTimeout(
    demoAlarmTimer
  );

  demoAlarmTimer =
    null;

  if (
    closeCheck &&
    demoSafetyCheckActive
  ) {
    closeSafetyCheck();
  }

  demoSafetyCheckActive =
    false;

  resetDemoButton();
}


function startDemoAlarm() {
  // Match the uploaded SafeRoute demo behavior: the 10-second presenter timer
  // starts directly from this click instead of waiting for a GPS callback.
  stopDemoAlarm({
    closeCheck: true
  });

  // Temporarily pause the real 5-minute route timer while the demo is running.
  // It is resumed after the presenter clears the safety check.
  clearTimeout(
    inactivityTimer
  );

  inactivityTimer =
    null;

  // Prime mobile audio from a direct user gesture so the later emergency alarm
  // has the best chance of being audible on Safari/Chrome.
  try {
    if (!alarmContext) {
      alarmContext =
        new (
          window.AudioContext ||
          window.webkitAudioContext
        )();
    }

    alarmContext.resume?.();
  }
  catch {}

  const button =
    $("demo-alarm-button");

  if (button) {
    button.disabled =
      true;

    button.classList
      .add("running");

    button.innerHTML =
      '<span aria-hidden="true">●</span><strong>Check in 10s</strong>';
  }

  $("unsafe-status").textContent =
    "DEMO active · safety check will appear in 10 seconds";

  demoAlarmTimer =
    window.setTimeout(
      () => {
        demoAlarmTimer =
          null;

        showSafetyCheck({
          demo: true
        });
      },
      DEMO_ALARM_DELAY
    );
}


function resetInactivityTimer() {
  clearTimeout(
    inactivityTimer
  );

  inactivityTimer =
    null;

  if (!routeSafetyActive) {
    return;
  }

  inactivityTimer =
    setTimeout(
      showSafetyCheck,
      inactivityDelay()
    );
}


function handleSafetyPosition(
  position
) {
  if (!routeSafetyActive) {
    return;
  }

  const current = [
    position.coords.latitude,
    position.coords.longitude
  ];

  originMarker
    .setLatLng(current)
    .addTo(map);

  // Refresh the safe-place set only after substantial movement, never just
  // because the user picked a different destination.
  updateSafePlacesIfNeeded(current)
    .catch(() => {});

  if (
    target &&
    distance(current, target) <= DESTINATION_ARRIVAL_METERS
  ) {
    stopSafetyTracking();
    $("unsafe-status").textContent =
      "Destination reached · movement monitoring stopped";
    return;
  }

  if (!safetyLastPosition) {
    safetyLastPosition =
      current;

    resetInactivityTimer();
    return;
  }

  const moved =
    distance(
      safetyLastPosition,
      current
    );

  const reportedSpeed =
    Number.isFinite(position.coords.speed)
      ? position.coords.speed
      : null;

  const reportedAccuracy =
    Number.isFinite(position.coords.accuracy)
      ? position.coords.accuracy
      : 0;

  // In 10-second demo mode, GPS jitter can otherwise look like walking and
  // continuously restart the timer. Prefer the phone's speed estimate when
  // available; otherwise require displacement large enough to beat the
  // reported GPS uncertainty.
  const demoDistanceThreshold =
    Math.max(
      DEMO_MOVEMENT_THRESHOLD_METERS,
      Math.min(20, reportedAccuracy * 0.75)
    );

  const meaningfulMovement =
    demoSafetyMode
      ? (
          reportedSpeed !== null
            ? reportedSpeed >= 0.45
            : moved >= demoDistanceThreshold
        )
      : moved >= movementThreshold();

  if (meaningfulMovement) {
    safetyLastPosition =
      current;

    if (!demoSafetyCheckActive) {
      closeSafetyCheck();
    }

    resetInactivityTimer();

    $("unsafe-status").textContent =
      `Movement detected · ${inactivityLabel()} safety timer reset`;
  }
}


function startSafetyTracking() {
  stopSafetyTracking();

  routeSafetyActive =
    true;

  // Create/resume audio from the route-pick gesture so a later alarm has the
  // best chance of being audible on mobile browsers.
  try {
    if (!alarmContext) {
      alarmContext =
        new (
          window.AudioContext ||
          window.webkitAudioContext
        )();
    }

    alarmContext.resume?.();
  }
  catch {}

  if (!navigator.geolocation) {
    if (demoSafetyMode) {
      safetyLastPosition = null;
      resetInactivityTimer();
      $("unsafe-status").textContent =
        "Route selected · 10-second demo timer active (GPS unavailable)";
      return;
    }

    routeSafetyActive =
      false;

    $("unsafe-status").textContent =
      "Route selected · movement monitoring is unavailable on this device";
    return;
  }

  safetyLastPosition =
    origin
      ? [...origin]
      : null;

  resetInactivityTimer();

  safetyWatchId =
    navigator.geolocation.watchPosition(
      handleSafetyPosition,
      error => {
        console.warn(
          "Route safety location error:",
          error
        );

        // Keep the presenter demo deterministic even if a browser briefly
        // fails to provide another GPS fix. Normal 5-minute monitoring pauses
        // because it should not claim to know whether the user is moving.
        if (demoSafetyMode) {
          $("unsafe-status").textContent =
            "10-second demo timer is active; waiting for movement or safety check.";
          return;
        }

        clearTimeout(
          inactivityTimer
        );

        inactivityTimer =
          null;

        $("unsafe-status").textContent =
          `Location monitoring is unavailable, so the ${inactivityLabel()} safety timer is paused.`;
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000
      }
    );

  $("unsafe-status").textContent =
    `Route selected · ${inactivityLabel()} no-movement safety monitoring active`;
}


function stopSafetyTracking() {
  routeSafetyActive =
    false;

  if (
    safetyWatchId !== null &&
    navigator.geolocation
  ) {
    navigator.geolocation.clearWatch(
      safetyWatchId
    );
  }

  safetyWatchId =
    null;

  safetyLastPosition =
    null;

  clearTimeout(
    inactivityTimer
  );

  inactivityTimer =
    null;

  closeSafetyCheck();
}


function setSheetExpanded(
  expanded
) {
  const sheet =
    $("route-options");

  sheet.classList.toggle(
    "expanded",
    expanded
  );

  document.body.classList.toggle(
    "sheet-expanded",
    expanded
  );

  $("sheet-handle").setAttribute(
    "aria-expanded",
    String(expanded)
  );
}


function currentSafetyReferencePoint() {
  if (safetyLastPosition) {
    return safetyLastPosition;
  }

  if (origin) {
    return origin;
  }

  return null;
}


function chooseNearestUsableHaven(
  point,
  places = havens
) {
  const usable =
    places
      .map(place => ({
        place,
        status: havenStatus(place)
      }))
      .filter(item =>
        item.status.label !== "Restricted access" &&
        item.status.state !== "closed"
      )
      .sort((a, b) => {
        const aOpen =
          a.status.state === "open" ? 0 : 1;

        const bOpen =
          b.status.state === "open" ? 0 : 1;

        if (aOpen !== bOpen) {
          return aOpen - bOpen;
        }

        return (
          distance(point, a.place.position) -
          distance(point, b.place.position)
        );
      });

  return usable[0] || null;
}


function showSafePlaceImmediately(
  point,
  chosen
) {
  const {
    place,
    status: placeStatus
  } = chosen;

  updateOrigin(point);
  setTarget(
    place.position,
    place.name
  );

  map.setView(
    place.position,
    16
  );

  targetMarker?.openPopup();

  const distanceMiles =
    distance(point, place.position) /
    1609.344;

  const hoursText =
    placeStatus.state === "open"
      ? "confirmed open"
      : "hours not confirmed";

  $("unsafe-status").textContent =
    `${place.name} · ${distanceMiles.toFixed(1)} mi · ${hoursText} · calculating route…`;
}


$("call-911").onclick =
  showEmergencyConfirmation;


$("cancel-911").onclick =
  () => $("emergency-dialog").close();


$("confirm-911").onclick =
  () => {
    $("emergency-dialog").close();
    attemptEmergencyCall();
  };


$("safety-call-911").onclick =
  () => {
    const wasDemo =
      demoSafetyCheckActive;

    if (wasDemo) {
      stopDemoAlarm();
    }

    attemptEmergencyCall();
  };


$("im-safe").onclick =
  () => {
    const wasDemo =
      demoSafetyCheckActive;

    closeSafetyCheck();

    if (wasDemo) {
      stopDemoAlarm();

      if (routeSafetyActive) {
        resetInactivityTimer();

        $("unsafe-status").textContent =
          "Demo cleared · normal 5-minute route monitoring continues";
      }
      else {
        $("unsafe-status").textContent =
          "Demo cleared · you marked yourself safe";
      }

      return;
    }

    resetInactivityTimer();

    $("unsafe-status").textContent =
      "Safety check cleared · movement monitoring continues";
  };


$("safety-check-dialog").addEventListener(
  "cancel",
  event => {
    // Do not allow Escape/back to silently dismiss an active safety check.
    event.preventDefault();
  }
);


$("demo-alarm-button").onclick =
  startDemoAlarm;


$("nearest").onclick =
  async () => {
    $("nearest").disabled =
      true;

    $("unsafe-status").textContent =
      "Finding the nearest safe place…";

    try {
      let point =
        currentSafetyReferencePoint();

      if (!point) {
        point =
          await locate();
      }

      // The green button intentionally expands the safe-place search. It adds
      // lower-trust public options such as cafes, restaurants, convenience
      // stores and transit stations while keeping the higher-trust places.
      // Once expanded, this richer set remains active as the user moves.
      await updateSafePlacesIfNeeded(
        point,
        {
          force: !expandedSafePlaces,
          expanded: true
        }
      );

      const chosen =
        chooseNearestUsableHaven(
          point,
          havens
        );

      if (!chosen) {
        throw new Error(
          "No nearby safe place was found. Try again after moving to another area."
        );
      }

      showSafePlaceImmediately(
        point,
        chosen
      );

      const loadedCount =
        havens.length;

      $("unsafe-status").textContent +=
        ` · ${loadedCount} safe places now shown`;

      // Preserve the original Safe Place function: route to the nearest
      // usable place with the existing route planner.
      $("plan").click();
    }
    catch (error) {
      $("unsafe-status").textContent =
        error.message;
    }
    finally {
      $("nearest").disabled =
        false;
    }
  };


// =====================================================
// FAKE CALL — UPLOADED MODULE INTEGRATION
// =====================================================

$("fake-call").onclick =
  () => {
    if (
      window.FakeCall &&
      typeof window.FakeCall.open === "function"
    ) {
      window.FakeCall.open();

      $("unsafe-status").textContent =
        "Choose who should fake-call you.";

      return;
    }

    console.error(
      "Fake Call module is unavailable. Check the fake-call/ folder and browser console."
    );

    $("unsafe-status").textContent =
      "Fake Call could not load. Check the fake-call folder.";
  };


window.addEventListener(
  "fakecall",
  event => {
    const phase =
      event.detail?.phase;

    const persona =
      event.detail?.persona;

    const names = {
      mom: "Mom",
      friend: "Alex",
      roommate: "Sam"
    };

    const callerName =
      names[persona] ||
      "Fake caller";

    if (phase === "scheduled") {
      $("unsafe-status").textContent =
        `${callerName} call scheduled.`;
    }
    else if (phase === "ringing") {
      $("unsafe-status").textContent =
        `${callerName} is calling…`;
    }
    else if (phase === "active") {
      $("unsafe-status").textContent =
        `Fake call with ${callerName} is active.`;
    }
    else if (phase === "ended" || phase === "idle") {
      $("unsafe-status").textContent =
        routeSafetyActive
          ? "Route safety monitoring is active."
          : "";
    }
  }
);


// =====================================================
// ROUTE BOTTOM SHEET
// =====================================================

const routeSheet =
  $("route-options");

const sheetHandle =
  $("sheet-handle");

let sheetDragStartY =
  0;

let sheetDragStartOffset =
  0;

let sheetDragging =
  false;


function sheetCollapsedOffset() {
  const collapsed =
    parseFloat(
      getComputedStyle(
        document.documentElement
      )
        .getPropertyValue(
          "--sheet-collapsed"
        )
    ) ||
    198;

  return Math.max(
    0,
    routeSheet
      .getBoundingClientRect()
      .height -
      collapsed
  );
}


function applySheetDrag(
  offset
) {
  const clamped =
    Math.max(
      0,
      Math.min(
        sheetCollapsedOffset(),
        offset
      )
    );

  const desktop =
    window.matchMedia(
      "(min-width: 900px)"
    ).matches;

  routeSheet.style.transform =
    desktop
      ? `translate(0, ${clamped}px)`
      : `translate(-50%, ${clamped}px)`;
}


sheetHandle
  .addEventListener(
    "pointerdown",
    event => {
      sheetDragging =
        true;

      sheetDragStartY =
        event.clientY;

      sheetDragStartOffset =
        routeSheet.classList
          .contains("expanded")
          ? 0
          : sheetCollapsedOffset();

      routeSheet.classList
        .add("dragging");

      sheetHandle
        .setPointerCapture(
          event.pointerId
        );
    }
  );


sheetHandle
  .addEventListener(
    "pointermove",
    event => {
      if (!sheetDragging) {
        return;
      }

      applySheetDrag(
        sheetDragStartOffset +
        event.clientY -
        sheetDragStartY
      );
    }
  );


function finishSheetDrag(
  event
) {
  if (!sheetDragging) {
    return;
  }

  sheetDragging =
    false;

  routeSheet.classList
    .remove("dragging");

  const movement =
    event.clientY -
    sheetDragStartY;

  routeSheet.style.transform =
    "";

  if (
    Math.abs(movement) < 12
  ) {
    setSheetExpanded(
      !routeSheet.classList
        .contains("expanded")
    );
  }
  else {
    setSheetExpanded(
      movement < 0
    );
  }
}


sheetHandle
  .addEventListener(
    "pointerup",
    finishSheetDrag
  );


sheetHandle
  .addEventListener(
    "pointercancel",
    finishSheetDrag
  );


sheetHandle
  .addEventListener(
    "keydown",
    event => {
      if (
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();

        setSheetExpanded(
          !routeSheet.classList
            .contains("expanded")
        );
      }
    }
  );


let routeScrollTimer =
  null;


$("routes")
  .addEventListener(
    "scroll",
    () => {
      clearTimeout(
        routeScrollTimer
      );

      routeScrollTimer =
        setTimeout(
          () => {
            const container =
              $("routes");

            const center =
              container.scrollLeft +
              container.clientWidth / 2;

            const cards = [
              ...container.children
            ];

            const nearestCard =
              cards
                .map(
                  card => ({
                    card,
                    distance:
                      Math.abs(
                        card.offsetLeft +
                        card.offsetWidth / 2 -
                        center
                      )
                  })
                )
                .sort(
                  (a, b) =>
                    a.distance -
                    b.distance
                )[0]
                ?.card;

            if (
              nearestCard &&
              nearestCard.dataset.routeId !==
              selected
            ) {
              selectRoute(
                nearestCard.dataset.routeId,
                false
              );
            }
          },
          130
        );
    },
    { passive: true }
  );


// =====================================================
// ROUTE SCROLL BUTTONS
// =====================================================

for (
  const [
    id,
    direction
  ] of [
    [
      "routes-prev",
      -1
    ],

    [
      "routes-next",
      1
    ]
  ]
) {
  $(id)
    .onclick =
      () => {
        const card =
          $("routes")
            .firstElementChild;


        if (
          card
        ) {
          $("routes")
            .scrollBy({
              left:
                direction *
                (
                  card
                    .getBoundingClientRect()
                    .width +
                  12
                ),

              behavior:
                "smooth"
            });
        }
      };
}


// =====================================================
// START
// =====================================================

renderConnectivityZones();

renderHavens();
primeSafePlacesOnLaunch();


drawRoutes();

setLive();

useCurrentLocation();