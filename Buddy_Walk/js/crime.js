// Crime risk is intentionally kept on a simple 1-5 scale for the hackathon.
// Higher levels are more severe and stay relevant for longer.
export const crimeLevels = {
  drug: 1,
  vandalism: 1,
  shoplifting: 2,
  theft: 2,
  vehicle_theft: 3,
  burglary: 3,
  simple_assault: 3,
  robbery: 4,
  aggravated_assault: 4,
  weapons: 4,
  shooting: 5,
  sexual: 5,
  kidnapping: 5,
  homicide: 5
};

// The route score subtracts the level: level 1 => -1, level 5 => -5.
export const crimePenalties = Object.fromEntries(
  Object.entries(crimeLevels).map(([type, level]) => [type, -level])
);

// Level 1-2: one week; level 3: two weeks; level 4-5: one month.
export function crimeLookbackDays(level) {
  if (level <= 2) return 7;
  if (level === 3) return 14;
  return 30;
}

const codes = {
  '35A': 'drug',
  '35B': 'drug',
  '290': 'vandalism',
  '23C': 'shoplifting',
  '240': 'vehicle_theft',
  '220': 'burglary',
  '120': 'robbery',
  '13B': 'simple_assault',
  '13A': 'aggravated_assault',
  '520': 'weapons',
  '100': 'kidnapping',
  '09A': 'homicide',
  '09B': 'homicide',
  '09C': 'homicide',
  '11A': 'sexual',
  '11B': 'sexual',
  '11C': 'sexual',
  '11D': 'sexual',
  '36A': 'sexual',
  '36B': 'sexual'
};

export function classifyCrime(attributes) {
  const code = String(attributes.NibrsUcrCode || '').trim().toUpperCase();
  const label = String(attributes.NIBRS_Offense || '').toLowerCase();

  let type = codes[code] || (/^23[A-H]$/.test(code) ? 'theft' : undefined);

  if (!type) {
    const rules = [
      ['homicide', /homicide|murder|manslaughter/],
      ['kidnapping', /kidnap|abduction/],
      ['sexual', /sexual|rape|sodomy|incest/],
      ['aggravated_assault', /aggravated assault/],
      ['simple_assault', /simple assault/],
      ['weapons', /weapon/],
      ['robbery', /robbery/],
      ['burglary', /burglary|breaking.*entering/],
      ['vehicle_theft', /motor vehicle theft|vehicle theft/],
      ['shoplifting', /shoplift|retail theft/],
      ['theft', /theft|larceny/],
      ['drug', /drug|narcotic/],
      ['vandalism', /vandalism|property damage|damage.*property/]
    ];
    type = rules.find(([, pattern]) => pattern.test(label))?.[0];
  }

  // An explicit shooting description is treated as level 5. A generic
  // firearm flag alone is not enough to classify an incident as a shooting.
  if (/\bshooting\b|\bshot fired\b|\bshots fired\b/.test(label)) {
    const existingLevel = type ? crimeLevels[type] : 0;
    if (existingLevel < 5) type = 'shooting';
  }

  if (!type) return null;

  const level = crimeLevels[type];
  return {
    type,
    level,
    points: -level,
    lookbackDays: crimeLookbackDays(level)
  };
}
