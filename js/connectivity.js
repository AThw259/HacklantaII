// ======================================================
// SafeRoute Synthetic Connectivity Database
// ======================================================
//
// HACKATHON DEMO DATA ONLY.
//
// This is NOT official Cox coverage.
//
// Each geographic cell has an integer connectivity score:
//
//  +10 = Excellent
//    0 = Average
//  -10 = Very Poor
//
// ======================================================


// ------------------------------------------------------
// APPROXIMATE GEORGIA BORDER
// ------------------------------------------------------

const GEORGIA_POLYGON = [
  [35.000, -85.605],
  [35.000, -83.108],

  [34.990, -83.000],
  [34.800, -82.900],
  [34.500, -82.700],
  [34.100, -82.500],

  [33.700, -82.200],
  [33.300, -81.900],
  [32.800, -81.500],
  [32.300, -81.200],

  [31.700, -81.100],
  [31.100, -81.500],

  [30.700, -82.000],
  [30.360, -82.200],

  [30.360, -84.900],

  [31.000, -85.000],
  [32.000, -85.000],
  [33.000, -85.200],
  [34.000, -85.400],

  [35.000, -85.605]
];


// ------------------------------------------------------
// CITY INFLUENCES
// ------------------------------------------------------
//
// These do NOT force the whole city to be green.
// They only increase the probability of stronger cells.
//

const hubs = [
  {
    name: "Downtown Atlanta",
    lat: 33.7490,
    lng: -84.3880,
    strength: 6.5,
    radius: 22000
  },

  {
    name: "Midtown",
    lat: 33.7810,
    lng: -84.3874,
    strength: 6,
    radius: 12000
  },

  {
    name: "Buckhead",
    lat: 33.8484,
    lng: -84.3733,
    strength: 5,
    radius: 12000
  },

  {
    name: "Decatur",
    lat: 33.7748,
    lng: -84.2963,
    strength: 4,
    radius: 11000
  },

  {
    name: "Sandy Springs",
    lat: 33.9304,
    lng: -84.3733,
    strength: 4,
    radius: 12000
  },

  {
    name: "Marietta",
    lat: 33.9526,
    lng: -84.5499,
    strength: 3.5,
    radius: 11000
  },

  {
    name: "Alpharetta",
    lat: 34.0754,
    lng: -84.2941,
    strength: 4,
    radius: 11000
  },

  {
    name: "Athens",
    lat: 33.9519,
    lng: -83.3576,
    strength: 5,
    radius: 15000
  },

  {
    name: "Augusta",
    lat: 33.4735,
    lng: -82.0105,
    strength: 4.5,
    radius: 16000
  },

  {
    name: "Savannah",
    lat: 32.0809,
    lng: -81.0912,
    strength: 5,
    radius: 17000
  },

  {
    name: "Macon",
    lat: 32.8407,
    lng: -83.6324,
    strength: 4,
    radius: 15000
  },

  {
    name: "Columbus",
    lat: 32.4609,
    lng: -84.9877,
    strength: 4,
    radius: 15000
  },

  {
    name: "Albany",
    lat: 31.5785,
    lng: -84.1557,
    strength: 2.5,
    radius: 13000
  },

  {
    name: "Valdosta",
    lat: 30.8327,
    lng: -83.2785,
    strength: 3,
    radius: 13000
  },

  {
    name: "Rome",
    lat: 34.2570,
    lng: -85.1647,
    strength: 2.5,
    radius: 12000
  },

  {
    name: "Gainesville",
    lat: 34.2979,
    lng: -83.8241,
    strength: 3,
    radius: 13000
  }
];


// ------------------------------------------------------
// DISTANCE
// ------------------------------------------------------

function distanceMeters(
  lat1,
  lng1,
  lat2,
  lng2
) {
  const R = 6371000;

  const rad =
    Math.PI / 180;

  const dLat =
    (lat2 - lat1) * rad;

  const dLng =
    (lng2 - lng1) * rad;

  const a =
    Math.sin(dLat / 2) ** 2 +

    Math.cos(lat1 * rad) *
    Math.cos(lat2 * rad) *

    Math.sin(dLng / 2) ** 2;

  return (
    2 *
    R *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
}


// ------------------------------------------------------
// POINT INSIDE GEORGIA
// ------------------------------------------------------

function pointInGeorgia(
  lat,
  lng
) {
  let inside =
    false;

  for (
    let i = 0,
      j =
        GEORGIA_POLYGON.length - 1;

    i < GEORGIA_POLYGON.length;

    j = i++
  ) {
    const yi =
      GEORGIA_POLYGON[i][0];

    const xi =
      GEORGIA_POLYGON[i][1];

    const yj =
      GEORGIA_POLYGON[j][0];

    const xj =
      GEORGIA_POLYGON[j][1];


    const intersect =
      (
        yi > lat
      ) !==
      (
        yj > lat
      ) &&

      lng <
        (
          (xj - xi) *
          (lat - yi)
        ) /
        (
          yj - yi ||
          0.000001
        ) +
        xi;


    if (intersect) {
      inside =
        !inside;
    }
  }

  return inside;
}


// ------------------------------------------------------
// DETERMINISTIC RANDOM NUMBER
// ------------------------------------------------------
//
// Unlike Math.random(), this gives the same map
// every time the browser refreshes.
//

function hashNoise(
  lat,
  lng,
  seed
) {
  const value =
    Math.sin(
      lat * 127.1 +
      lng * 311.7 +
      seed * 74.7
    ) *
    43758.5453123;

  return (
    value -
    Math.floor(value)
  );
}


// ------------------------------------------------------
// LOCAL VARIATION
// ------------------------------------------------------

function localVariation(
  lat,
  lng
) {
  const regional =
    hashNoise(
      lat * 0.8,
      lng * 0.8,
      13
    );

  const neighborhood =
    hashNoise(
      lat * 3.1,
      lng * 3.1,
      47
    );

  const streetLevel =
    hashNoise(
      lat * 9.2,
      lng * 9.2,
      91
    );


  return (
    (regional - 0.5) * 5 +

    (neighborhood - 0.5) * 5 +

    (streetLevel - 0.5) * 3
  );
}


// ------------------------------------------------------
// CITY INFLUENCE
// ------------------------------------------------------

function cityInfluence(
  lat,
  lng
) {
  let strongest =
    0;

  for (
    const hub of hubs
  ) {
    const d =
      distanceMeters(
        lat,
        lng,
        hub.lat,
        hub.lng
      );


    if (
      d >
      hub.radius
    ) {
      continue;
    }


    const ratio =
      1 -
      d /
      hub.radius;


    // Squared falloff avoids giant circular blobs.
    const influence =
      hub.strength *
      ratio *
      ratio;


    strongest =
      Math.max(
        strongest,
        influence
      );
  }

  return strongest;
}


// ------------------------------------------------------
// CALCULATE SCORE
// ------------------------------------------------------

function calculateConnectivity(
  lat,
  lng
) {
  // General Georgia baseline.
  let score =
    -1.5;


  // Urban areas generally improve connectivity,
  // but do not guarantee excellent coverage.
  score +=
    cityInfluence(
      lat,
      lng
    );


  // Neighborhood-level differences.
  score +=
    localVariation(
      lat,
      lng
    );


  // Random-looking dead / poor pockets.
  const weakPocket =
    hashNoise(
      lat * 17,
      lng * 17,
      133
    );


  if (
    weakPocket > 0.91
  ) {
    score -= 4;
  }

  else if (
    weakPocket > 0.82
  ) {
    score -= 2;
  }


  // Random-looking stronger areas.
  const hotspot =
    hashNoise(
      lat * 19,
      lng * 19,
      201
    );


  if (
    hotspot > 0.93
  ) {
    score += 4;
  }

  else if (
    hotspot > 0.84
  ) {
    score += 2;
  }


  // Make integer:
  // -10, -9, -8 ... 0 ... 8, 9, 10
  score =
    Math.round(
      score
    );


  return Math.max(
    -10,
    Math.min(
      10,
      score
    )
  );
}


// ------------------------------------------------------
// LABEL
// ------------------------------------------------------

export function connectionLabel(
  score
) {
  if (score >= 9) {
    return "Excellent";
  }

  if (score >= 7) {
    return "Very Strong";
  }

  if (score >= 5) {
    return "Strong";
  }

  if (score >= 3) {
    return "Good";
  }

  if (score >= 1) {
    return "Fair";
  }

  if (score >= -1) {
    return "Average";
  }

  if (score >= -3) {
    return "Fair-Poor";
  }

  if (score >= -5) {
    return "Weak";
  }

  if (score >= -7) {
    return "Very Weak";
  }

  if (score >= -9) {
    return "Poor";
  }

  return "Very Poor";
}


// ------------------------------------------------------
// COLOR
// ------------------------------------------------------
//
// Score:
// -10 = red
//   0 = yellow
// +10 = green
//

export function connectionColor(
  score
) {
  const normalized =
    (
      score +
      10
    ) /
    20;


  const hue =
    Math.round(
      normalized *
      125
    );


  return (
    `hsl(${hue}, 55%, 55%)`
  );
}


// ------------------------------------------------------
// GRID DATABASE
// ------------------------------------------------------
//
// 0.05 degrees is about 5 km vertically.
// This provides enough detail without producing
// too many Leaflet polygons.
//

const CELL_SIZE =
  0.05;


const SOUTH =
  30.35;

const NORTH =
  35.02;

const WEST =
  -85.61;

const EAST =
  -80.83;


export const connectivityCells =
  [];


for (
  let lat =
    SOUTH;

  lat <
    NORTH;

  lat +=
    CELL_SIZE
) {
  for (
    let lng =
      WEST;

    lng <
      EAST;

    lng +=
      CELL_SIZE
  ) {
    const centerLat =
      lat +
      CELL_SIZE / 2;

    const centerLng =
      lng +
      CELL_SIZE / 2;


    if (
      !pointInGeorgia(
        centerLat,
        centerLng
      )
    ) {
      continue;
    }


    const score =
      calculateConnectivity(
        centerLat,
        centerLng
      );


    connectivityCells.push({
      id:
        `${lat.toFixed(3)}-${lng.toFixed(3)}`,

      bounds: [
        [
          lat,
          lng
        ],

        [
          lat +
            CELL_SIZE,

          lng +
            CELL_SIZE
        ]
      ],

      center: [
        centerLat,
        centerLng
      ],

      score,

      status:
        connectionLabel(
          score
        )
    });
  }
}


// ------------------------------------------------------
// GET CONNECTIVITY FOR A POINT
// ------------------------------------------------------

export function connectivityAtPoint(
  point
) {
  if (
    !point ||
    point.length !== 2
  ) {
    return null;
  }


  const [
    lat,
    lng
  ] =
    point;


  for (
    const cell of
      connectivityCells
  ) {
    const [
      southwest,
      northeast
    ] =
      cell.bounds;


    if (
      lat >=
        southwest[0] &&

      lat <
        northeast[0] &&

      lng >=
        southwest[1] &&

      lng <
        northeast[1]
    ) {
      return cell;
    }
  }


  return null;
}


// ------------------------------------------------------
// ROUTE CONNECTIVITY
// ------------------------------------------------------

export function routeConnectivity(
  route
) {
  if (
    !route?.points?.length
  ) {
    return {
      score: 0,
      points: 0,
      level: "Average",
      average: 0,
      note:
        "No connectivity estimate available"
    };
  }


  const scores =
    [];


  // Sample up to roughly 35 places along the route.
  const step =
    Math.max(
      1,
      Math.floor(
        route.points.length /
        35
      )
    );


  for (
    let i = 0;

    i <
      route.points.length;

    i +=
      step
  ) {
    const cell =
      connectivityAtPoint(
        route.points[i]
      );


    if (cell) {
      scores.push(
        cell.score
      );
    }
  }


  if (
    !scores.length
  ) {
    return {
      score: -5,
      points: -5,
      level: "Weak",
      average: -5,
      note:
        "Outside demo Georgia connectivity area"
    };
  }


  const average =
    scores.reduce(
      (
        total,
        score
      ) =>
        total +
        score,
      0
    ) /
    scores.length;


  const rounded =
    Math.max(
      -10,
      Math.min(
        10,
        Math.round(
          average
        )
      )
    );


  return {
    score:
      rounded,

    points:
      rounded,

    level:
      connectionLabel(
        rounded
      ),

    average,

    note:
      `Demo connectivity: ${connectionLabel(rounded)} (${rounded > 0 ? "+" : ""}${rounded})`
  };
}