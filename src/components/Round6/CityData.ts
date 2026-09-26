// 25-City NPC Hunt Data for Round 6
// Each city provides 2 digits when the NPC is tapped 10 times
// The first letters of cities in order form a 25-character word

export type CityData = {
  id: number;
  city: string;
  country: string;
  digits: string; // 2-digit value
  coordinates: {
    latitude: number;
    longitude: number;
  };
  npcOffset: {
    // Offset from city center to place NPC sprite (in degrees)
    latitude: number;
    longitude: number;
  };
  nextCity: string | null; // Name of the next city in sequence (null for final city)
};

export const CITIES_25: CityData[] = [
  {
    id: 1,
    city: "London",
    country: "UK",
    digits: "73",
    coordinates: {
      latitude: 51.5074,
      longitude: -0.1278,
    },
    npcOffset: {
      latitude: 0.001,
      longitude: 0.001,
    },
    nextCity: "Paris",
  },
  {
    id: 2,
    city: "Paris",
    country: "France",
    digits: "18",
    coordinates: {
      latitude: 48.8566,
      longitude: 2.3522,
    },
    npcOffset: {
      latitude: 0.001,
      longitude: -0.001,
    },
    nextCity: "Tokyo",
  },
  {
    id: 3,
    city: "Tokyo",
    country: "Japan",
    digits: "46",
    coordinates: {
      latitude: 35.6762,
      longitude: 139.6503,
    },
    npcOffset: {
      latitude: -0.001,
      longitude: 0.001,
    },
    nextCity: "Cairo",
  },
  {
    id: 4,
    city: "Cairo",
    country: "Egypt",
    digits: "92",
    coordinates: {
      latitude: 30.0444,
      longitude: 31.2357,
    },
    npcOffset: {
      latitude: 0.001,
      longitude: 0.001,
    },
    nextCity: "New York City",
  },
  {
    id: 5,
    city: "New York City",
    country: "USA",
    digits: "05",
    coordinates: {
      latitude: 40.7128,
      longitude: -74.006,
    },
    npcOffset: {
      latitude: -0.001,
      longitude: -0.001,
    },
    nextCity: "Rome",
  },
  {
    id: 6,
    city: "Rome",
    country: "Italy",
    digits: "61",
    coordinates: {
      latitude: 41.9028,
      longitude: 12.4964,
    },
    npcOffset: {
      latitude: 0.001,
      longitude: -0.001,
    },
    nextCity: "Dubai",
  },
  {
    id: 7,
    city: "Dubai",
    country: "UAE",
    digits: "37",
    coordinates: {
      latitude: 25.2048,
      longitude: 55.2708,
    },
    npcOffset: {
      latitude: -0.001,
      longitude: 0.001,
    },
    nextCity: "Singapore",
  },
  {
    id: 8,
    city: "Singapore",
    country: "Singapore",
    digits: "84",
    coordinates: {
      latitude: 1.3521,
      longitude: 103.8198,
    },
    npcOffset: {
      latitude: 0.001,
      longitude: 0.001,
    },
    nextCity: "Istanbul",
  },
  {
    id: 9,
    city: "Istanbul",
    country: "Türkiye",
    digits: "29",
    coordinates: {
      latitude: 41.0082,
      longitude: 28.9684,
    },
    npcOffset: {
      latitude: -0.001,
      longitude: -0.001,
    },
    nextCity: "Sydney",
  },
  {
    id: 10,
    city: "Sydney",
    country: "Australia",
    digits: "50",
    coordinates: {
      latitude: -33.8688,
      longitude: 151.2093,
    },
    npcOffset: {
      latitude: 0.001,
      longitude: -0.001,
    },
    nextCity: "Mumbai",
  },
  {
    id: 11,
    city: "Mumbai",
    country: "India",
    digits: "16",
    coordinates: {
      latitude: 19.076,
      longitude: 72.8777,
    },
    npcOffset: {
      latitude: -0.001,
      longitude: 0.001,
    },
    nextCity: "Rio de Janeiro",
  },
  {
    id: 12,
    city: "Rio de Janeiro",
    country: "Brazil",
    digits: "78",
    coordinates: {
      latitude: -22.9068,
      longitude: -43.1729,
    },
    npcOffset: {
      latitude: 0.001,
      longitude: 0.001,
    },
    nextCity: "Toronto",
  },
  {
    id: 13,
    city: "Toronto",
    country: "Canada",
    digits: "43",
    coordinates: {
      latitude: 43.6532,
      longitude: -79.3832,
    },
    npcOffset: {
      latitude: -0.001,
      longitude: -0.001,
    },
    nextCity: "Seoul",
  },
  {
    id: 14,
    city: "Seoul",
    country: "South Korea",
    digits: "90",
    coordinates: {
      latitude: 37.5665,
      longitude: 126.978,
    },
    npcOffset: {
      latitude: 0.001,
      longitude: 0.001,
    },
    nextCity: "Amsterdam",
  },
  {
    id: 15,
    city: "Amsterdam",
    country: "Netherlands",
    digits: "24",
    coordinates: {
      latitude: 52.3676,
      longitude: 4.9041,
    },
    npcOffset: {
      latitude: -0.001,
      longitude: -0.001,
    },
    nextCity: "Bangkok",
  },
  {
    id: 16,
    city: "Bangkok",
    country: "Thailand",
    digits: "67",
    coordinates: {
      latitude: 13.7563,
      longitude: 100.5018,
    },
    npcOffset: {
      latitude: 0.001,
      longitude: 0.001,
    },
    nextCity: "Mexico City",
  },
  {
    id: 17,
    city: "Mexico City",
    country: "Mexico",
    digits: "31",
    coordinates: {
      latitude: 19.4326,
      longitude: -99.1332,
    },
    npcOffset: {
      latitude: -0.001,
      longitude: 0.001,
    },
    nextCity: "Cape Town",
  },
  {
    id: 18,
    city: "Cape Town",
    country: "South Africa",
    digits: "82",
    coordinates: {
      latitude: -33.9249,
      longitude: 18.4241,
    },
    npcOffset: {
      latitude: 0.001,
      longitude: -0.001,
    },
    nextCity: "Athens",
  },
  {
    id: 19,
    city: "Athens",
    country: "Greece",
    digits: "56",
    coordinates: {
      latitude: 37.9838,
      longitude: 23.7275,
    },
    npcOffset: {
      latitude: -0.001,
      longitude: -0.001,
    },
    nextCity: "Moscow",
  },
  {
    id: 20,
    city: "Moscow",
    country: "Russia",
    digits: "09",
    coordinates: {
      latitude: 55.7558,
      longitude: 37.6176,
    },
    npcOffset: {
      latitude: 0.001,
      longitude: 0.001,
    },
    nextCity: "Prague",
  },
  {
    id: 21,
    city: "Prague",
    country: "Czech Republic",
    digits: "64",
    coordinates: {
      latitude: 50.0755,
      longitude: 14.4378,
    },
    npcOffset: {
      latitude: -0.001,
      longitude: -0.001,
    },
    nextCity: "Buenos Aires",
  },
  {
    id: 22,
    city: "Buenos Aires",
    country: "Argentina",
    digits: "27",
    coordinates: {
      latitude: -34.6037,
      longitude: -58.3816,
    },
    npcOffset: {
      latitude: 0.001,
      longitude: 0.001,
    },
    nextCity: "Lisbon",
  },
  {
    id: 23,
    city: "Lisbon",
    country: "Portugal",
    digits: "41",
    coordinates: {
      latitude: 38.7223,
      longitude: -9.1393,
    },
    npcOffset: {
      latitude: -0.001,
      longitude: -0.001,
    },
    nextCity: "Kathmandu",
  },
  {
    id: 24,
    city: "Kathmandu",
    country: "Nepal",
    digits: "88",
    coordinates: {
      latitude: 27.7172,
      longitude: 85.324,
    },
    npcOffset: {
      latitude: 0.001,
      longitude: 0.001,
    },
    nextCity: "Reykjavík",
  },
  {
    id: 25,
    city: "Reykjavík",
    country: "Iceland",
    digits: "35",
    coordinates: {
      latitude: 64.1466,
      longitude: -21.9426,
    },
    npcOffset: {
      latitude: -0.001,
      longitude: 0.001,
    },
    nextCity: null, // Final city
  },
];

export const CITY_CLUES: string[] = [
  '🕰️ Find the city where a famous clock tower keeps watch beside a river, and red double-decker buses rule the streets.',
  '🗼 Cross the English Channel and seek the city where an iron tower rises above the Seine.',
  '🌃 Find the city where neon lights meet ancient temples, and the world’s busiest pedestrian crossing comes alive.',
  '🐫 Follow the Nile toward a city guarded by enormous stone triangles built for pharaohs.',
  '🗽 Find the city with a green lady holding a torch at the gateway to a famous harbor.',
  '🏛️ Seek the ancient city where an enormous arena once echoed with gladiators.',
  '🏙️ Cross the desert to the city where the world’s famous skyscraper seems to touch the clouds.',
  '🌴 Find the island city where futuristic gardens glow beneath giant tree-like structures.',
  '🌉 Find the city that stands with one foot in Europe and the other in Asia, divided by a famous strait.',
  '⛵ Travel to the city where a giant sail-shaped building overlooks a famous harbour bridge.',
  '🚪 Find the Indian city whose waterfront gateway faces the Arabian Sea and once welcomed ships from afar.',
  '⛰️ Find the city watched over by a giant statue with outstretched arms above the bay.',
  '🗼 Head north to the city dominated by a tower that once stood as the world’s tallest free-standing structure.',
  '🎎 Find the city where ancient palaces stand beside a futuristic skyline and K-pop was born.',
  '🚲 Find the city where bicycles outnumber many things and canals wind through historic streets.',
  '🛕 Travel to the city where golden temples, floating markets and the Chao Phraya River meet.',
  '🌋 Find the enormous city built near ancient Aztec ruins, surrounded by volcanic mountains.',
  '⛰️ Travel to the southern tip of Africa, where a flat-topped mountain overlooks two oceans.',
  '🏛️ Find the ancient city crowned by a hill where the Parthenon still stands.',
  '🔴 Head east to the city where colorful onion domes rise beside a famous red square.',
  '⏰ Find the European city where an ancient astronomical clock watches over a historic square.',
  '💃 Travel south to the city of tango, wide avenues and colorful La Boca streets.',
  '🚋 Find the European capital of steep streets, yellow trams and views over the Tagus.',
  '🏔️ Travel toward the roof of the world, to the valley that serves as a gateway to Mount Everest.',
  '❄️ Your final destination lies near the Arctic Circle, where fire and ice shape the land and the Northern Lights dance overhead.',
];

export const NPC_INTERACTIONS = [
  { requiredTaps: 5, responses: ["Oi! What was that?", "You again?", "Are you planning to keep doing that?", "Alright, alright… one more and I might tell you something.", "Fine. You earned it. Here’s your clue: 73."] },
  { requiredTaps: 7, responses: ["Excusez-moi?", "Did you just tap me?", "Again? Really?", "You seem unusually persistent.", "Is this your strategy?", "One more. Then perhaps I’ll cooperate.", "Très bien. Your clue is 18."] },
  { requiredTaps: 4, responses: ["Hey!", "Again?", "You don't give up easily, do you?", "Alright. Take this and move along: 46."] },
  { requiredTaps: 6, responses: ["What are you doing?", "That was unnecessary.", "Again?", "You really want something from me.", "Fine… almost there.", "Enough! Your clue is 92."] },
  { requiredTaps: 3, responses: ["Hey! Watch it!", "Seriously?", "Okay, okay! You want a clue? 05."] },
  { requiredTaps: 7, responses: ["Mamma mia!", "Again?", "You tourists are strange.", "Still tapping?", "Persistent.", "Fine. Just one more.", "There. Your clue: 61."] },
  { requiredTaps: 5, responses: ["Excuse me?", "Was that necessary?", "You're persistent.", "I suppose you're not leaving without something.", "Alright. Take your clue: 37."] },
  { requiredTaps: 6, responses: ["Hey!", "Again?", "You're making this a habit.", "Still not giving up?", "Almost convinced…", "Fine. Your clue is 84."] },
  { requiredTaps: 4, responses: ["Hey, stranger!", "That again?", "You really want my attention, don't you?", "Alright, you have it. Your clue: 29."] },
  { requiredTaps: 7, responses: ["Whoa!", "Careful!", "Again?", "You're quite persistent.", "Still going?", "You know there's an easier way to ask.", "Fine! Your clue is 50."] },
  { requiredTaps: 3, responses: ["Aiyo! What was that?", "Again? Seriously?", "Okay! Here. Take your clue: 16."] },
  { requiredTaps: 6, responses: ["Hey!", "What do you want?", "Again?", "You're definitely not giving up.", "Alright… almost.", "There! Your clue is 78."] },
  { requiredTaps: 5, responses: ["Hey there!", "Was that a tap?", "Another one?", "You really want that clue.", "Fine. It's 43."] },
  { requiredTaps: 7, responses: ["Hey!", "Seriously?", "Again?", "You're persistent.", "Do you ever stop?", "One more…", "Alright. Your clue is 90."] },
  { requiredTaps: 4, responses: ["Hey!", "Again?", "You could have just asked.", "Fine. Your clue: 24."] },
  { requiredTaps: 6, responses: ["Sawadee… wait, what?", "Again?", "You are very determined.", "Still tapping?", "Almost there…", "Alright! Your clue is 67."] },
  { requiredTaps: 5, responses: ["Hey!", "What was that for?", "Again?", "You really want this, huh?", "Fine. Take this clue: 31."] },
  { requiredTaps: 3, responses: ["Hey!", "You're doing that again?", "Alright, alright. Your clue is 82."] },
  { requiredTaps: 7, responses: ["By Zeus!", "What are you doing?", "Again?", "You mortals are persistent.", "Still here?", "Very well… one final tap.", "Your clue is 56. Now go."] },
  { requiredTaps: 4, responses: ["Hey.", "Again?", "You don't give up.", "Fine. Your clue is 09."] },
  { requiredTaps: 6, responses: ["Excuse me?", "Again?", "You're persistent.", "Do you really need something from me?", "Almost…", "Alright. Your clue: 64."] },
  { requiredTaps: 5, responses: ["Che! What was that?", "Again?", "You're really committed to this.", "One more and I'll give you something.", "There. Your clue is 27."] },
  { requiredTaps: 3, responses: ["Olá! Again?", "You're not leaving, are you?", "Fine. Your clue is 41."] },
  { requiredTaps: 7, responses: ["Hey!", "Again?", "You have quite some patience.", "Still tapping?", "Almost there.", "One last effort…", "There. Your clue is 88. Your journey is almost over."] },
  {
    requiredTaps: 6,
    responses: [
      "You made it all the way here…",
      "And you're still tapping people?",
      "Persistent.",
      "You've collected quite a few numbers by now, haven't you?",
      "But perhaps you've been looking at the wrong thing…",
      "You've collected two digits from every city. But only the first digit matters. Now forget the order you visited them. Look at the city names. Arrange all 25 cities from A to Z, then take the first digit belonging to each city. That is your final 25-digit key.",
    ],
  },
] as const;

// First digit from each city pair, with city names sorted A to Z.
export const EXPECTED_NUMERIC_KEY = '2562983284730101637698544';

// Helper function to get city by name
export const getCityByName = (name: string): CityData | undefined => {
  return CITIES_25.find((city) => city.city.toLowerCase() === name.toLowerCase());
};

// Helper function to get city by ID
export const getCityById = (id: number): CityData | undefined => {
  return CITIES_25.find((city) => city.id === id);
};
