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
  scoreRoute,
  penalties
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


const reportLifetime =
  30 *
  86400000;


let key =
  "";

let origin =
  null;

let target =
  null;

let reportPoint =
  null;

let rawRoutes =
  [];

let havens =
  [];

let havenKnown =
  false;

let selected =
  null;

let revision =
  0;

let callTimer =
  null;

let lastSearch =
  0;


let reports =
  [];


try {
  reports =
    JSON.parse(
      localStorage.getItem(
        "saferoute-reports"
      ) ||
      "[]"
    )
      .filter(
        report =>
          report &&

          Object.prototype
            .hasOwnProperty.call(
              penalties,
              report.type
            ) &&

          Array.isArray(
            report.position
          ) &&

          report.position.length ===
            2 &&

          report.position.every(
            Number.isFinite
          ) &&

          Number.isFinite(
            report.created
          ) &&

          report.created >
            Date.now() -
              reportLifetime
      )
      .slice(-100);
}

catch {
  reports =
    [];
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
      [
        33.7490,
        -84.3880
      ],
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


const reportLayer =
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
          0.31,

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
  revision++;


  rawRoutes =
    [];


  routeLayer
    .clearLayers();


  $("routes")
    .replaceChildren();


  $("route-count")
    .textContent =
      "0 ROUTES";
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
    reportPoint = [
      event.latlng.lat,
      event.latlng.lng
    ];


    setTarget(
      reportPoint,
      "Selected map location"
    );
  }
);


// =====================================================
// ROUTE CARDS + ROUTE LINES
// =====================================================

function drawRoutes() {
  const scrollLeft =
    $("routes")
      .scrollLeft;


  const focusedRoute =
    document.activeElement
      ?.dataset
      ?.routeId;


  routeLayer
    .clearLayers();


  $("routes")
    .replaceChildren();


  const scored =
    rawRoutes
      .map(
        route =>
          scoreRoute(
            route,
            havens,
            reports,
            route.evidence
          )
      )
      .sort(
        (
          a,
          b
        ) =>
          b.score -
            a.score ||

          a.duration -
            b.duration
      );


  if (
    !scored.some(
      route =>
        route.id ===
        selected
    )
  ) {
    selected =
      scored[0]
        ?.id;
  }


  $("route-count")
    .textContent =
      `${scored.length} ROUTE${scored.length === 1 ? "" : "S"}`;


  for (
    const [
      index,
      route
    ] of
      scored.entries()
  ) {
    const active =
      route.id ===
      selected;


    const line =
      L.polyline(
        route.points,
        {
          color:
            active
              ? "#217a59"
              : "#83978d",

          weight:
            active
              ? 7
              : 5,

          opacity:
            active
              ? 0.95
              : 0.6
        }
      )
        .addTo(
          routeLayer
        );


    line.on(
      "click",
      () => {
        selected =
          route.id;


        drawRoutes();
      }
    );


    const card =
      element(
        "button",
        "",
        `route${active ? " selected" : ""}`
      );


    card.dataset.routeId =
      route.id;


    card.setAttribute(
      "aria-pressed",
      String(
        active
      )
    );


    if (
      index === 0
    ) {
      card.append(
        element(
          "div",
          `↗ TOP SCORE${havenKnown ? "" : " · LIMITED PLACE DATA"}`,
          "recommend"
        )
      );
    }


    const top =
      element(
        "div",
        "",
        "route-top"
      );


    top.append(
      element(
        "span",
        route.name,
        "route-title"
      )
    );


    const score =
      element(
        "span",
        String(
          route.score
        ),
        "route-score"
      );


    score.append(
      element(
        "small",
        " /100"
      )
    );


    top.append(
      score
    );


    card.append(
      top
    );


    card.append(
      element(
        "div",
        route.category,
        "recommend"
      )
    );


    const breakdown =
      route.breakdown;


    card.append(
      element(
        "div",
        `Base 50 | Places +${breakdown.safePlaces} | Reports ${breakdown.community.toFixed(1)} | Lighting ${breakdown.lighting} | Crime ${breakdown.crime} | Connectivity ${breakdown.connectivity > 0 ? "+" : ""}${breakdown.connectivity}`,
        "small"
      )
    );


    for (
      const note of
        route.dataNotes ||
        []
    ) {
      card.append(
        element(
          "div",
          note,
          "small"
        )
      );
    }


    if (
      route.unknown.length
    ) {
      card.append(
        element(
          "div",
          `Unknown: ${route.unknown.join(", ")}`,
          "small"
        )
      );
    }


    card.append(
      element(
        "div",
        `${Math.round(route.duration / 60)} min · ${(route.distance / 1000).toFixed(1)} km`,
        "route-meta"
      )
    );


    const metrics =
      element(
        "div",
        "",
        "metrics"
      );


    metrics.append(
      element(
        "span",
        `Safety ${route.safety}`
      ),


      element(
        "span",
        route.connectivity ===
          null
          ? "Connectivity N/A"
          : `Connectivity ${route.connectivity > 0 ? "+" : ""}${route.connectivity}`
      )
    );


    card.append(
      metrics
    );


    card.append(
      element(
        "div",
        `${route.nearby} nearby safe places · ${route.concerns} local concern${route.concerns === 1 ? "" : "s"}`,
        "small"
      )
    );


    card.onclick =
      () => {
        selected =
          route.id;


        drawRoutes();
      };


    $("routes")
      .append(
        card
      );
  }


  $("routes")
    .scrollLeft =
      scrollLeft;


  if (
    focusedRoute
  ) {
    [
      ...$("routes")
        .children
    ]
      .find(
        card =>
          card.dataset
            .routeId ===
          focusedRoute
      )
      ?.focus({
        preventScroll:
          true
      });
  }


  $("routes-prev")
    .disabled =
      scored.length <
      2;


  $("routes-next")
    .disabled =
      scored.length <
      2;
}


// =====================================================
// SAFE HAVEN DISPLAY
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
  havenLayer
    .clearLayers();


  $("havens")
    .replaceChildren();


  $("haven-note")
    .textContent =
      havenKnown
        ? `${havens.length} mapped Safe Haven candidates found. Unknown hours receive partial credit.`
        : "Live places have not been loaded yet.";


  if (
    !havens.length
  ) {
    $("havens")
      .append(
        element(
          "p",
          havenKnown
            ? "No mapped Safe Haven candidates found nearby."
            : "Find nearby public places to add context to your walk.",
          "small"
        )
      );


    return;
  }


  const sorted =
    [...havens]
      .sort(
        (
          a,
          b
        ) =>
          origin
            ? distance(
                origin,
                a.position
              ) -
              distance(
                origin,
                b.position
              )
            : 0
      );


  sorted.forEach(
    (
      place,
      index
    ) => {
      const current =
        havenStatus(
          place
        );


      L.circleMarker(
        place.position,
        {
          radius:
            8,

          color:
            "white",

          weight:
            2,

          fillColor:
            current.points >
            0
              ? "#217a59"
              : "#83978d",

          fillOpacity:
            1
        }
      )
        .addTo(
          havenLayer
        )
        .bindPopup(
          placePopup(
            place
          )
        );


      if (
        index < 8
      ) {
        const button =
          element(
            "button",
            place.name,
            "haven"
          );


        button.append(
          element(
            "span",
            `${pretty(place.type)} · +${current.points}`
          )
        );


        button.onclick =
          () => {
            map.setView(
              place.position,
              17
            );


            L.popup()
              .setLatLng(
                place.position
              )
              .setContent(
                placePopup(
                  place
                )
              )
              .openOn(
                map
              );
          };


        $("havens")
          .append(
            button
          );
      }
    }
  );
}


// =====================================================
// COMMUNITY REPORT DISPLAY
// =====================================================

function renderReports() {
  reportLayer
    .clearLayers();


  for (
    const report of
      reports
  ) {
    const box =
      element(
        "div"
      );


    box.append(
      element(
        "strong",
        pretty(
          report.type
        )
      ),

      element(
        "p",
        report.note ||
        ""
      )
    );


    L.circleMarker(
      report.position,
      {
        radius:
          7,

        color:
          "white",

        weight:
          2,

        fillColor:
          "#cf913d",

        fillOpacity:
          1
      }
    )
      .addTo(
        reportLayer
      )
      .bindPopup(
        box
      );
  }
}


// =====================================================
// SAFE HAVEN API
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
        "Trying Safe Haven server:",
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
          "Invalid Safe Haven response"
        );
      }


      return data;
    }

    catch (
      error
    ) {
      console.warn(
        "Safe Haven server failed:",
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
      "All Safe Haven services failed."
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
  center
) {
  const [
    lat,
    lng
  ] =
    center;


  const cacheKey =
    `${lat.toFixed(4)},${lng.toFixed(4)}`;


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
    2500;


  const query = `
[out:json][timeout:15];

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
      "Location ready. Search for a destination."
    );
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


        status(
          "Routes found. Loading Safe Havens..."
        );


        try {
          havens =
            await loadHavens(
              origin
            );


          havenKnown =
            true;
        }

        catch (
          error
        ) {
          console.error(
            "Safe Haven error:",
            error
          );


          havens =
            [];


          havenKnown =
            false;
        }


        renderHavens();


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
// REFRESH SAFE HAVENS
// =====================================================

$("refresh-havens")
  .onclick =
    async () => {
      if (
        !origin
      ) {
        status(
          "Current location is unavailable."
        );


        return;
      }


      $("refresh-havens")
        .disabled =
          true;


      status(
        "Searching for Safe Havens..."
      );


      try {
        havenCache
          .clear();


        havens =
          await loadHavens(
            origin
          );


        havenKnown =
          true;


        renderHavens();


        if (
          rawRoutes.length
        ) {
          drawRoutes();
        }


        status(
          `Found ${havens.length} mapped Safe Haven candidates.`
        );
      }

      catch (
        error
      ) {
        console.error(
          error
        );


        havenKnown =
          false;


        status(
          `Safe Haven lookup failed: ${error.message}`
        );
      }

      finally {
        $("refresh-havens")
          .disabled =
            false;
      }
    };


// =====================================================
// COMMUNITY REPORT FORM
// =====================================================

$("report-button")
  .onclick =
    () => {
      if (
        !reportPoint &&
        !origin
      ) {
        status(
          "Click the map or enable location first."
        );


        return;
      }


      $("report-position")
        .textContent =
          `Report location: ${(reportPoint || origin)
            .map(
              number =>
                number.toFixed(
                  5
                )
            )
            .join(", ")}`;


      $("report-dialog")
        .showModal();
    };


$("report-form")
  .onsubmit =
    event => {
      event
        .preventDefault();


      const next = [
        ...reports,

        {
          id:
            crypto.randomUUID(),

          position: [
            ...(
              reportPoint ||
              origin
            )
          ],

          type:
            $("report-type")
              .value,

          note:
            $("report-note")
              .value
              .trim(),

          created:
            Date.now()
        }
      ]
        .slice(
          -100
        );


      localStorage.setItem(
        "saferoute-reports",
        JSON.stringify(
          next
        )
      );


      reports =
        next;


      $("report-dialog")
        .close();


      $("report-note")
        .value =
          "";


      renderReports();


      if (
        rawRoutes.length
      ) {
        drawRoutes();
      }


      status(
        "Community report saved locally."
      );
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
// UNSAFE MENU
// =====================================================

$("unsafe-button")
  .onclick =
    () =>
      $("unsafe-dialog")
        .showModal();


if (
  $("phone-unsafe")
) {
  $("phone-unsafe")
    .onclick =
      () =>
        $("unsafe-dialog")
          .showModal();
}


$("nearest")
  .onclick =
    async () => {
      $("nearest")
        .disabled =
          true;


      try {
        const point =
          await locate();


        const places =
          await loadHavens(
            point
          );


        const eligible =
          places.filter(
            place =>
              havenStatus(
                place
              ).points >
              0
          );


        if (
          !eligible.length
        ) {
          throw new Error(
            "No Safe Haven found nearby."
          );
        }


        const nearest =
          [...eligible]
            .sort(
              (
                a,
                b
              ) =>
                distance(
                  point,
                  a.position
                ) -
                distance(
                  point,
                  b.position
                )
            )[0];


        setTarget(
          nearest.position,
          nearest.name
        );


        $("unsafe-dialog")
          .close();
      }

      catch (
        error
      ) {
        $("unsafe-status")
          .textContent =
            error.message;
      }

      finally {
        $("nearest")
          .disabled =
            false;
      }
    };


// =====================================================
// FAKE CALL
// =====================================================

$("fake-call")
  .onclick =
    () => {
      $("unsafe-dialog")
        .close();


      $("call-dialog")
        .showModal();


      let seconds =
        0;


      $("call-time")
        .textContent =
          "00:00";


      clearInterval(
        callTimer
      );


      callTimer =
        setInterval(
          () => {
            seconds++;


            $("call-time")
              .textContent =
                `${String(
                  Math.floor(
                    seconds /
                    60
                  )
                ).padStart(
                  2,
                  "0"
                )}:${String(
                  seconds %
                  60
                ).padStart(
                  2,
                  "0"
                )}`;
          },

          1000
        );
    };


$("end-call")
  .onclick =
    () => {
      clearInterval(
        callTimer
      );


      $("call-dialog")
        .close();
    };


// =====================================================
// RESPONSIVE MAP
// =====================================================

const phoneLayout =
  window.matchMedia(
    "(max-width: 700px)"
  );


const mapSlot =
  document.createComment(
    "Desktop map position"
  );


$("map-section")
  .before(
    mapSlot
  );


function arrangeMap() {
  if (
    phoneLayout.matches
  ) {
    $("route-options")
      .before(
        $("map-section")
      );
  }

  else {
    mapSlot.after(
      $("map-section")
    );
  }


  map.invalidateSize({
    pan:
      false
  });
}


phoneLayout
  .addEventListener(
    "change",
    arrangeMap
  );


arrangeMap();


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

renderReports();

drawRoutes();

setLive();

useCurrentLocation();