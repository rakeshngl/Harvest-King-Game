export const COLORS = {
  saffron: '#FF9933',
  saffronDeep: '#E07812',
  white: '#FFF8F0',
  green: '#138808',
  greenDeep: '#0B5E05',
  navy: '#000080',
  navySoft: '#1A237E',
  gold: '#C9A227',
  earth: '#5C3A1E',
  soil: '#8B5A2B'
}

export const PLAYER_PALETTE = [
  { id: 'kesari', name: 'Saffron', color: '#FF9933', ink: '#5C2E00' },
  { id: 'harit', name: 'Green', color: '#138808', ink: '#062E03' },
  { id: 'neel', name: 'Navy', color: '#000080', ink: '#E8ECFF' },
  { id: 'suvarna', name: 'Gold', color: '#C9A227', ink: '#3A2A00' }
]

export const SEASONS = [
  { id: 'kharif', name: 'Monsoon', hint: 'Rainy-season sowing', color: '#138808' },
  { id: 'rabi', name: 'Winter', hint: 'Winter sowing', color: '#FF9933' },
  { id: 'zaid', name: 'Summer', hint: 'Summer catch crop', color: '#C9A227' }
]

export const CROPS = {
  bajra: { id: 'bajra', name: 'Pearl Millet', season: 'kharif', seed: 400, grow: 1, yield: 18, price: 55, vol: 0.22, drought: 0.85, water: 0.4, icon: 'millet' },
  jowar: { id: 'jowar', name: 'Sorghum', season: 'kharif', seed: 450, grow: 1, yield: 20, price: 52, vol: 0.2, drought: 0.8, water: 0.45, icon: 'millet' },
  groundnut: { id: 'groundnut', name: 'Groundnut', season: 'kharif', seed: 800, grow: 1, yield: 16, price: 90, vol: 0.28, drought: 0.55, water: 0.55, icon: 'nut' },
  cotton: { id: 'cotton', name: 'Cotton', season: 'kharif', seed: 1200, grow: 2, yield: 14, price: 140, vol: 0.35, drought: 0.4, water: 0.65, icon: 'cotton' },
  sugarcane: { id: 'sugarcane', name: 'Sugarcane', season: 'zaid', seed: 1600, grow: 2, yield: 28, price: 48, vol: 0.18, drought: 0.25, water: 0.9, icon: 'cane' },
  rice: { id: 'rice', name: 'Paddy', season: 'kharif', seed: 900, grow: 1, yield: 24, price: 62, vol: 0.2, drought: 0.15, water: 0.95, icon: 'rice' },
  jute: { id: 'jute', name: 'Jute', season: 'kharif', seed: 700, grow: 1, yield: 15, price: 85, vol: 0.3, drought: 0.2, water: 0.8, icon: 'fiber' },
  wheat: { id: 'wheat', name: 'Wheat', season: 'rabi', seed: 1000, grow: 1, yield: 26, price: 70, vol: 0.16, drought: 0.45, water: 0.7, icon: 'wheat' },
  mustard: { id: 'mustard', name: 'Mustard', season: 'rabi', seed: 650, grow: 1, yield: 12, price: 110, vol: 0.24, drought: 0.6, water: 0.5, icon: 'oilseed' },
  apple: { id: 'apple', name: 'Apple', season: 'rabi', seed: 2200, grow: 2, yield: 10, price: 260, vol: 0.32, drought: 0.35, water: 0.6, icon: 'apple' },
  spices: { id: 'spices', name: 'Spices', season: 'kharif', seed: 1800, grow: 2, yield: 8, price: 340, vol: 0.4, drought: 0.5, water: 0.55, icon: 'spice' },
  coffee: { id: 'coffee', name: 'Coffee', season: 'kharif', seed: 2000, grow: 2, yield: 9, price: 300, vol: 0.36, drought: 0.3, water: 0.7, icon: 'coffee' },
  tea: { id: 'tea', name: 'Tea', season: 'kharif', seed: 2100, grow: 2, yield: 11, price: 280, vol: 0.28, drought: 0.25, water: 0.75, icon: 'tea' },
  mango: { id: 'mango', name: 'Mango', season: 'zaid', seed: 2400, grow: 2, yield: 12, price: 250, vol: 0.34, drought: 0.4, water: 0.6, icon: 'mango' },
  grape: { id: 'grape', name: 'Grapes', season: 'rabi', seed: 2300, grow: 2, yield: 13, price: 240, vol: 0.33, drought: 0.35, water: 0.65, icon: 'grape' },
  cumin: { id: 'cumin', name: 'Cumin', season: 'rabi', seed: 1400, grow: 1, yield: 7, price: 380, vol: 0.42, drought: 0.7, water: 0.35, icon: 'spice' },
  saffron: { id: 'saffron', name: 'Saffron', season: 'rabi', seed: 3200, grow: 2, yield: 4, price: 900, vol: 0.5, drought: 0.45, water: 0.5, icon: 'saffron' },
  moong: { id: 'moong', name: 'Mung Bean', season: 'zaid', seed: 500, grow: 1, yield: 10, price: 120, vol: 0.26, drought: 0.65, water: 0.45, icon: 'pulse' }
}

export const GROUPS = {
  arid: { name: 'Arid Belt', color: '#E8A54B', rentMult: 1 },
  oil: { name: 'Oilseed Belt', color: '#D98E2B', rentMult: 1.1 },
  cotton: { name: 'Cotton Belt', color: '#F2D6A6', rentMult: 1.15 },
  gangetic: { name: 'Gangetic Plains', color: '#7CB342', rentMult: 1.2 },
  wheat: { name: 'Wheat Belt', color: '#F4C430', rentMult: 1.3 },
  spice: { name: 'Spice Coast', color: '#138808', rentMult: 1.4 },
  hill: { name: 'Hill Gardens', color: '#2E7D32', rentMult: 1.5 },
  orchard: { name: 'Orchard Belt', color: '#000080', rentMult: 1.7 }
}

export const TILES = [
  { id: 0, type: 'start', name: 'Village Hall', sub: 'Collect harvest dues', icon: 'chakra' },
  { id: 1, type: 'farm', name: 'Barmer Millet', region: 'Rajasthan', group: 'arid', price: 1200, lease: 400, prepare: 300, rent: 80, soil: 'arid', crops: ['bajra', 'jowar', 'moong'], icon: 'millet' },
  { id: 2, type: 'kisan', name: 'Farmer Card', sub: 'Fate of the fields', icon: 'card' },
  { id: 3, type: 'farm', name: 'Malwa Sorghum', region: 'Madhya Pradesh', group: 'arid', price: 1400, lease: 450, prepare: 320, rent: 90, soil: 'black', crops: ['jowar', 'bajra', 'moong'], icon: 'millet' },
  { id: 4, type: 'tax', name: 'Land Revenue', sub: 'Pay 8% cash or Rs 800', icon: 'tax', amount: 800, pct: 0.08 },
  { id: 5, type: 'infra', name: 'Tractor Stand', sub: 'Farm machinery', icon: 'tractor', price: 2000, rent: [250, 500, 1000, 2000] },
  { id: 6, type: 'farm', name: 'Junagadh Groundnut', region: 'Gujarat', group: 'oil', price: 1800, lease: 550, prepare: 400, rent: 120, soil: 'black', crops: ['groundnut', 'cotton', 'cumin'], icon: 'nut' },
  { id: 7, type: 'mandi', name: 'Market Prices', sub: 'Market swings', icon: 'mandi' },
  { id: 8, type: 'farm', name: 'Vidarbha Cotton', region: 'Maharashtra', group: 'oil', price: 2000, lease: 600, prepare: 450, rent: 140, soil: 'black', crops: ['cotton', 'groundnut', 'moong'], icon: 'cotton' },
  { id: 9, type: 'farm', name: 'Warangal Cotton', region: 'Telangana', group: 'cotton', price: 2200, lease: 650, prepare: 480, rent: 160, soil: 'red', crops: ['cotton', 'rice', 'moong'], icon: 'cotton' },
  { id: 10, type: 'mela', name: 'Farm Fair', sub: 'Fair bonuses & trials', icon: 'mela' },
  { id: 11, type: 'farm', name: 'Baghpat Cane', region: 'Uttar Pradesh', group: 'cotton', price: 2400, lease: 700, prepare: 520, rent: 180, soil: 'alluvial', crops: ['sugarcane', 'wheat', 'mustard'], icon: 'cane' },
  { id: 12, type: 'utility', name: 'Irrigation Canal', sub: 'Water rights', icon: 'canal', price: 1500 },
  { id: 13, type: 'farm', name: 'Mithila Paddy', region: 'Bihar', group: 'gangetic', price: 2600, lease: 750, prepare: 560, rent: 200, soil: 'alluvial', crops: ['rice', 'wheat', 'moong'], icon: 'rice' },
  { id: 14, type: 'farm', name: 'Hooghly Jute', region: 'West Bengal', group: 'gangetic', price: 2800, lease: 800, prepare: 580, rent: 220, soil: 'alluvial', crops: ['jute', 'rice', 'mustard'], icon: 'fiber' },
  { id: 15, type: 'infra', name: 'Cold Storage', sub: 'Post-harvest chain', icon: 'cold', price: 2000, rent: [250, 500, 1000, 2000] },
  { id: 16, type: 'farm', name: 'Ludhiana Wheat', region: 'Punjab', group: 'wheat', price: 3200, lease: 900, prepare: 640, rent: 260, soil: 'alluvial', crops: ['wheat', 'rice', 'mustard'], icon: 'wheat' },
  { id: 17, type: 'kisan', name: 'Farmer Card', sub: 'Fate of the fields', icon: 'card' },
  { id: 18, type: 'farm', name: 'Sirsa Mustard', region: 'Haryana', group: 'wheat', price: 3400, lease: 950, prepare: 660, rent: 280, soil: 'alluvial', crops: ['mustard', 'wheat', 'moong'], icon: 'oilseed' },
  { id: 19, type: 'farm', name: 'Shimla Orchards', region: 'Himachal', group: 'wheat', price: 3600, lease: 1000, prepare: 720, rent: 300, soil: 'hill', crops: ['apple', 'mustard', 'moong'], icon: 'apple' },
  { id: 20, type: 'fci', name: 'Food Warehouse', sub: 'Sell ripe harvest at support price', icon: 'godown' },
  { id: 21, type: 'farm', name: 'Idukki Spices', region: 'Kerala', group: 'spice', price: 3800, lease: 1100, prepare: 760, rent: 340, soil: 'laterite', crops: ['spices', 'coffee', 'tea'], icon: 'spice' },
  { id: 22, type: 'mandi', name: 'Market Prices', sub: 'Market swings', icon: 'mandi' },
  { id: 23, type: 'farm', name: 'Thanjavur Paddy', region: 'Tamil Nadu', group: 'spice', price: 4000, lease: 1150, prepare: 780, rent: 360, soil: 'alluvial', crops: ['rice', 'sugarcane', 'moong'], icon: 'rice' },
  { id: 24, type: 'farm', name: 'Coorg Coffee', region: 'Karnataka', group: 'spice', price: 4200, lease: 1200, prepare: 820, rent: 380, soil: 'laterite', crops: ['coffee', 'spices', 'rice'], icon: 'coffee' },
  { id: 25, type: 'infra', name: 'Seed Bank', sub: 'Certified seed chain', icon: 'seed', price: 2000, rent: [250, 500, 1000, 2000] },
  { id: 26, type: 'farm', name: 'Dibrugarh Tea', region: 'Assam', group: 'hill', price: 4400, lease: 1250, prepare: 860, rent: 420, soil: 'hill', crops: ['tea', 'rice', 'spices'], icon: 'tea' },
  { id: 27, type: 'farm', name: 'Bargarh Paddy', region: 'Odisha', group: 'hill', price: 3600, lease: 1000, prepare: 700, rent: 300, soil: 'alluvial', crops: ['rice', 'jute', 'moong'], icon: 'rice' },
  { id: 28, type: 'utility', name: 'Borewell Grid', sub: 'Groundwater rights', icon: 'well', price: 1500 },
  { id: 29, type: 'farm', name: 'Bastar Rice', region: 'Chhattisgarh', group: 'hill', price: 3000, lease: 850, prepare: 620, rent: 240, soil: 'red', crops: ['rice', 'moong', 'jowar'], icon: 'rice' },
  { id: 30, type: 'nabard', name: 'Rural Bank', sub: 'Crop loans & interest', icon: 'bank' },
  { id: 31, type: 'farm', name: 'Krishna Mango', region: 'Andhra Pradesh', group: 'orchard', price: 4600, lease: 1350, prepare: 900, rent: 460, soil: 'red', crops: ['mango', 'rice', 'cotton'], icon: 'mango' },
  { id: 32, type: 'farm', name: 'Nashik Grapes', region: 'Maharashtra', group: 'orchard', price: 4800, lease: 1400, prepare: 920, rent: 480, soil: 'black', crops: ['grape', 'sugarcane', 'moong'], icon: 'grape' },
  { id: 33, type: 'kisan', name: 'Farmer Card', sub: 'Fate of the fields', icon: 'card' },
  { id: 34, type: 'farm', name: 'Pampore Saffron', region: 'Kashmir', group: 'orchard', price: 5200, lease: 1600, prepare: 1100, rent: 560, soil: 'hill', crops: ['saffron', 'apple', 'mustard'], icon: 'saffron' },
  { id: 35, type: 'infra', name: 'Market Yard', sub: 'Wholesale market', icon: 'yard', price: 2000, rent: [250, 500, 1000, 2000] },
  { id: 36, type: 'mandi', name: 'Market Prices', sub: 'Market swings', icon: 'mandi' },
  { id: 37, type: 'farm', name: 'Unjha Cumin', region: 'Gujarat', group: 'orchard', price: 5000, lease: 1500, prepare: 980, rent: 520, soil: 'arid', crops: ['cumin', 'mustard', 'bajra'], icon: 'spice' },
  { id: 38, type: 'tax', name: 'Market Tax', sub: 'Pay 10% cash or Rs 1200', icon: 'tax', amount: 1200, pct: 0.1 },
  { id: 39, type: 'farm', name: 'Sikkim Organic', region: 'Sikkim', group: 'orchard', price: 5600, lease: 1700, prepare: 1200, rent: 600, soil: 'hill', crops: ['spices', 'tea', 'moong'], icon: 'organic' }
]

export const KISAN_CARDS = [
  { id: 'pmkisan', title: 'Farm Support Payment', text: 'Direct benefit transfer credited.', fn: 'gain', amount: 2000 },
  { id: 'monsoon', title: 'Timely Monsoon', text: 'All your seeded fields gain +1 fertility.', fn: 'fertility', delta: 1 },
  { id: 'drought', title: 'Dry Spell Warning', text: 'Unirrigated seeded fields lose fertility.', fn: 'drought' },
  { id: 'pest', title: 'Fall Armyworm', text: 'Pay Rs 700 per seeded field or lose the crop.', fn: 'pest', fee: 700 },
  { id: 'diesel', title: 'Diesel Hike', text: 'Pay Rs 400 per owned or leased farm.', fn: 'perFarm', amount: 400 },
  { id: 'subsidy', title: 'Seed Subsidy', text: 'Collect Rs 1500 from the treasury.', fn: 'gain', amount: 1500 },
  { id: 'soil', title: 'Soil Health Card', text: 'Your next land preparation is free.', fn: 'freePrep' },
  { id: 'hail', title: 'Hailstorm', text: 'One ripe or seeded crop is damaged. Lose 50% of its expected yield value.', fn: 'hail' },
  { id: 'export', title: 'Export Quota Opened', text: 'Orchard and spice prices jump 25% this season.', fn: 'priceBoost', groups: ['orchard', 'spice'], pct: 0.25 },
  { id: 'ban', title: 'Export Ban', text: 'Onion/spice panic. Spice prices fall 20%.', fn: 'priceDrop', crops: ['spices', 'cumin'], pct: 0.2 },
  { id: 'canal', title: 'Canal Rotation', text: 'If you own Irrigation Canal, collect Rs 1200.', fn: 'ifOwn', tile: 12, amount: 1200 },
  { id: 'coop', title: 'Cooperative Dividend', text: 'Collect Rs 200 from each rival farmer.', fn: 'fromEach', amount: 200 },
  { id: 'insurance', title: 'Crop Insurance Claim', text: 'If any field is insured, collect Rs 2500.', fn: 'insuranceClaim', amount: 2500 },
  { id: 'kvk', title: 'Farm School Training', text: 'All your farms gain irrigation know-how this season.', fn: 'knowHow' },
  { id: 'coldfail', title: 'Cold Storage Failure', text: 'If you do not own Cold Storage, pay Rs 900.', fn: 'unlessOwn', tile: 15, amount: 900 },
  { id: 'organic', title: 'Organic Certification', text: 'Sikkim Organic or spice farms you own earn +Rs 800 now.', fn: 'organicBonus', amount: 800 },
  { id: 'msp', title: 'Support Price Hike', text: 'Wheat, paddy and cotton support price rises 15%.', fn: 'mspHike', crops: ['wheat', 'rice', 'cotton'], pct: 0.15 },
  { id: 'labour', title: 'Labour Shortage', text: 'Pay Rs 600 or skip your next harvest bonus.', fn: 'labour', amount: 600 }
]

export const MANDI_CARDS = [
  { id: 'boom', title: 'Festival Demand', text: 'All market prices rise 12%.', fn: 'market', pct: 0.12 },
  { id: 'crash', title: 'Market Glut', text: 'All market prices fall 12%.', fn: 'market', pct: -0.12 },
  { id: 'fci', title: 'Government Procurement', text: 'Collect Rs 1800 if you hold wheat or paddy fields.', fn: 'ifCropField', crops: ['wheat', 'rice'], amount: 1800 },
  { id: 'trader', title: 'Middleman Fee', text: 'Pay Rs 1000 market commission.', fn: 'pay', amount: 1000 },
  { id: 'warehouse', title: 'Warehouse Receipt', text: 'Collect Rs 2200.', fn: 'gain', amount: 2200 },
  { id: 'transport', title: 'Highway Strike', text: 'Pay Rs 150 per farm you control.', fn: 'perFarm', amount: 150 },
  { id: 'futures', title: 'Commodity Spike', text: 'Cotton and cumin jump 30%.', fn: 'priceBoostCrops', crops: ['cotton', 'cumin'], pct: 0.3 },
  { id: 'rain', title: 'Unseasonal Rain', text: 'Ripe crops may rot. Each ripe field has 40% chance to lose harvest.', fn: 'rot' },
  { id: 'eNAM', title: 'Online Market Listing', text: 'Collect Rs 500 and unlock +5% sale price this season.', fn: 'enam' },
  { id: 'loanwaiver', title: 'Interest Relief', text: 'Rural bank interest waived once. Debt reduced by Rs 1500.', fn: 'debtCut', amount: 1500 },
  { id: 'fertilizer', title: 'Urea Shortage', text: 'Preparation costs rise. Pay Rs 500 now.', fn: 'pay', amount: 500 },
  { id: 'bonus', title: 'Cane Fructose Order', text: 'Sugarcane holders collect Rs 1600.', fn: 'ifCropField', crops: ['sugarcane'], amount: 1600 }
]

export const WEATHER = [
  { id: 'normal', name: 'Fair Skies', mod: 1, water: 1, text: 'Average growing weather.' },
  { id: 'monsoon', name: 'Good Monsoon', mod: 1.25, water: 1.3, text: 'Fields drink well. Water-loving crops thrive.' },
  { id: 'drought', name: 'Drought', mod: 0.65, water: 0.45, text: 'Yields fall unless irrigated or drought-hardy.' },
  { id: 'flood', name: 'Flooding', mod: 0.7, water: 1.6, text: 'Low-lying paddy mixed luck; orchards suffer.' },
  { id: 'hail', name: 'Hail Belt', mod: 0.75, water: 1, text: 'Hill and orchard crops take a beating.' }
]

export const START_CASH = 12000
export const PASS_GO = 1500
export const WIN_NET = 75000
export const MAX_SEASONS = 18
export const LOAN_STEP = 3000
export const LOAN_CAP = 9000
export const INTEREST = 0.12
