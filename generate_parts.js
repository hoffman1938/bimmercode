#!/usr/bin/env node

/**
 * COMPREHENSIVE Auto Parts Generator
 * Covers ALL BMW error code categories with real OEM parts
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 COMPREHENSIVE Parts Generator for ALL BMW Systems');
console.log('====================================================\n');

// Load codes from both sources
let allCodes = [];

// 1. Load from codes.json
try {
  const codesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/codes.json'), 'utf8'));
  allCodes = allCodes.concat(codesData.codes);
  console.log(`✅ Loaded ${codesData.codes.length} codes from codes.json`);
} catch (err) {
  console.log(`⚠️  Could not load codes.json: ${err.message}`);
}

// 2. Load from data.js
try {
  const dataJsContent = fs.readFileSync(path.join(__dirname, 'data/data.js'), 'utf8');
  const match = dataJsContent.match(/return\s+\[([\s\S]*?)\];/);
  if (match) {
    const arrayContent = '[' + match[1] + ']';
    const dataJsCodes = eval(arrayContent);
    const existingCodes = new Set(allCodes.map(c => c.code));
    const newCodes = dataJsCodes.filter(c => !existingCodes.has(c.code));
    allCodes = allCodes.concat(newCodes);
    console.log(`✅ Loaded ${dataJsCodes.length} codes from data.js (${newCodes.length} unique)`);
  }
} catch (err) {
  console.log(`⚠️  Could not load data.js: ${err.message}`);
}

console.log(`\n📊 Total unique codes: ${allCodes.length}\n`);

// COMPREHENSIVE PARTS DATABASE - 20+ Categories
const PARTS_DATABASE = {
  'Engine': {
    keywords: ['engine', 'motor', 'dme', 'ecu', 'air flow', 'maf', 'rpm', 'performance', 'power', 'hot film'],
    parts: [
      { name_en: 'Mass Air Flow Sensor', name_ru: 'Датчик массового расхода воздуха', name_ka: 'მასის საჰაერო ნაკადის სენსორი', oem: '13627566986', manufacturer: 'BMW', price_min: 150, price_max: 200, priority: 1, category: 'engine' },
      { name_en: 'Air Filter', name_ru: 'Воздушный фильтр', name_ka: 'ჰაერის ფილტრი', oem: '13717521033', manufacturer: 'BMW', price_min: 25, price_max: 35, priority: 2, category: 'engine' },
      { name_en: 'Engine Oil 5W-30', name_ru: 'Моторное масло 5W-30', name_ka: 'ძრავის ზეთი 5W-30', oem: '83212365950', manufacturer: 'BMW', price_min: 40, price_max: 60, priority: 3, category: 'engine' }
    ]
  },
  'Air Supply': {
    keywords: ['air supply', 'air mass', 'intake', 'charge air', 'boost', 'plausibility'],
    parts: [
      { name_en: 'Mass Air Flow Sensor', name_ru: 'Датчик массового расхода воздуха', name_ka: 'მასის საჰაერო ნაკადის სენსორი', oem: '13627566986', manufacturer: 'BMW', price_min: 150, price_max: 200, priority: 1, category: 'engine' },
      { name_en: 'Intake Boot', name_ru: 'Патрубок впускной', name_ka: 'შესასვლელი მილი', oem: '13717605334', manufacturer: 'BMW', price_min: 80, price_max: 120, priority: 2, category: 'engine' }
    ]
  },
  'Fuel System': {
    keywords: ['fuel', 'injector', 'pump', 'tank', 'lean', 'rich', 'mixture', 'pressure', 'rail'],
    parts: [
      { name_en: 'Fuel Injector', name_ru: 'Топливная форсунка', name_ka: 'საწვავის ინჟექტორი', oem: '13537585261', manufacturer: 'BMW', price_min: 180, price_max: 220, priority: 1, category: 'fuel' },
      { name_en: 'Fuel Filter', name_ru: 'Топливный фильтр', name_ka: 'საწვავის ფილტრი', oem: '16117222391', manufacturer: 'BMW', price_min: 25, price_max: 35, priority: 2, category: 'fuel' },
      { name_en: 'Fuel Pump', name_ru: 'Топливный насос', name_ka: 'საწვავის ტუმბო', oem: '16117373814', manufacturer: 'BMW', price_min: 300, price_max: 450, priority: 1, category: 'fuel' }
    ]
  },
  'Ignition': {
    keywords: ['ignition', 'coil', 'spark', 'misfire', 'cylinder', 'combustion', 'firing'],
    parts: [
      { name_en: 'Ignition Coil', name_ru: 'Катушка зажигания', name_ka: 'აალების ხვეული', oem: '12137594937', manufacturer: 'BMW', price_min: 55, price_max: 75, priority: 1, category: 'ignition' },
      { name_en: 'Spark Plugs (Set of 6)', name_ru: 'Свечи зажигания (комплект 6шт)', name_ka: 'სანთლები (6 ცალი)', oem: '12120037607', manufacturer: 'BMW', price_min: 60, price_max: 80, priority: 2, category: 'ignition' }
    ]
  },
  'Emissions': {
    keywords: ['oxygen', 'o2', 'lambda', 'exhaust', 'catalytic', 'cat', 'dpf', 'emission', 'nox', 'sensor bank', 'evap'],
    parts: [
      { name_en: 'Oxygen Sensor', name_ru: 'Датчик кислорода', name_ka: 'ჟანგბადის სენსორი', oem: '11787558055', manufacturer: 'BMW', price_min: 80, price_max: 120, priority: 1, category: 'emissions' },
      { name_en: 'Catalytic Converter', name_ru: 'Катализатор', name_ka: 'კატალიზატორი', oem: '18307812281', manufacturer: 'BMW', price_min: 900, price_max: 1200, priority: 1, category: 'emissions' }
    ]
  },
  'Cooling': {
    keywords: ['cooling', 'coolant', 'thermostat', 'radiator', 'temperature', 'overheat', 'fan', 'water pump'],
    parts: [
      { name_en: 'Thermostat', name_ru: 'Термостат', name_ka: 'თერმოსტატი', oem: '11537549476', manufacturer: 'BMW', price_min: 60, price_max: 90, priority: 1, category: 'cooling' },
      { name_en: 'Coolant', name_ru: 'Антифриз', name_ka: 'ანტიფრიზი', oem: '82141467704', manufacturer: 'BMW', price_min: 20, price_max: 30, priority: 2, category: 'cooling' },
      { name_en: 'Water Pump', name_ru: 'Водяной насос', name_ka: 'წყლის ტუმბო', oem: '11517586925', manufacturer: 'BMW', price_min: 200, price_max: 350, priority: 1, category: 'cooling' }
    ]
  },
  'Transmission': {
    keywords: ['transmission', 'gearbox', 'egs', 'shift', 'clutch', 'gear', 'mechatronic', 'torque converter'],
    parts: [
      { name_en: 'Transmission Fluid', name_ru: 'Трансмиссионное масло', name_ka: 'ტრანსმისიის ზეთი', oem: '83222339719', manufacturer: 'BMW', price_min: 25, price_max: 35, priority: 1, category: 'transmission' },
      { name_en: 'Transmission Filter', name_ru: 'Фильтр АКПП', name_ka: 'ტრანსმისიის ფილტრი', oem: '24117571227', manufacturer: 'BMW', price_min: 80, price_max: 120, priority: 2, category: 'transmission' }
    ]
  },
  'ABS/DSC': {
    keywords: ['brake', 'abs', 'dsc', 'pad', 'rotor', 'braking', 'stability', 'traction', 'wheel speed'],
    parts: [
      { name_en: 'Brake Pads Front', name_ru: 'Тормозные колодки передние', name_ka: 'წინა სამუხრუჭე კოლოფები', oem: '34116858047', manufacturer: 'BMW', price_min: 60, price_max: 90, priority: 1, category: 'brakes' },
      { name_en: 'Brake Fluid DOT4', name_ru: 'Тормозная жидкость DOT4', name_ka: 'სამუხრუჭე სითხე DOT4', oem: '83132405977', manufacturer: 'BMW', price_min: 15, price_max: 25, priority: 2, category: 'brakes' },
      { name_en: 'ABS Wheel Speed Sensor', name_ru: 'Датчик скорости колеса ABS', name_ka: 'ABS ბორბლის სიჩქარის სენსორი', oem: '34526756375', manufacturer: 'BMW', price_min: 50, price_max: 80, priority: 1, category: 'brakes' }
    ]
  },
  'Electrical': {
    keywords: ['battery', 'alternator', 'starter', 'electrical', 'voltage', 'charge', 'charging', 'current', 'power management', 'ibs', 'parasitic'],
    parts: [
      { name_en: 'Battery 90Ah AGM', name_ru: 'Аккумулятор 90Ah AGM', name_ka: 'ბატარეა 90Ah AGM', oem: '61217555719', manufacturer: 'BMW', price_min: 200, price_max: 300, priority: 1, category: 'electrical' },
      { name_en: 'Alternator', name_ru: 'Генератор', name_ka: 'გენერატორი', oem: '12317541266', manufacturer: 'BMW', price_min: 400, price_max: 600, priority: 1, category: 'electrical' },
      { name_en: 'Starter Motor', name_ru: 'Стартер', name_ka: 'სტარტერი', oem: '12417838596', manufacturer: 'BMW', price_min: 300, price_max: 500, priority: 1, category: 'electrical' }
    ]
  },
  'Lighting': {
    keywords: ['light', 'lighting', 'headlight', 'taillight', 'led', 'xenon', 'adaptive', 'cornering', 'bulb', 'ballast'],
    parts: [
      { name_en: 'Xenon Ballast', name_ru: 'Блок розжига ксенона', name_ka: 'ქსენონის ბალასტი', oem: '63117180050', manufacturer: 'BMW', price_min: 150, price_max: 250, priority: 1, category: 'lighting' },
      { name_en: 'LED Module', name_ru: 'LED модуль', name_ka: 'LED მოდული', oem: '63117214941', manufacturer: 'BMW', price_min: 200, price_max: 350, priority: 1, category: 'lighting' },
      { name_en: 'Headlight Bulb H7', name_ru: 'Лампа фары H7', name_ka: 'ფარის ნათურა H7', oem: '63217217509', manufacturer: 'BMW', price_min: 15, price_max: 30, priority: 2, category: 'lighting' }
    ]
  },
  'HVAC': {
    keywords: ['hvac', 'climate', 'air conditioning', 'ac', 'heater', 'blower', 'temperature', 'ihka', 'compressor'],
    parts: [
      { name_en: 'Blower Motor', name_ru: 'Мотор вентилятора', name_ka: 'ვენტილატორის ძრავა', oem: '64119227670', manufacturer: 'BMW', price_min: 150, price_max: 250, priority: 1, category: 'hvac' },
      { name_en: 'AC Compressor', name_ru: 'Компрессор кондиционера', name_ka: 'კონდიციონერის კომპრესორი', oem: '64529195974', manufacturer: 'BMW', price_min: 500, price_max: 800, priority: 1, category: 'hvac' },
      { name_en: 'Cabin Air Filter', name_ru: 'Салонный фильтр', name_ka: 'სალონის ფილტრი', oem: '64319313519', manufacturer: 'BMW', price_min: 20, price_max: 35, priority: 2, category: 'hvac' }
    ]
  },
  'Comfort': {
    keywords: ['seat', 'seats', 'interior', 'comfort', 'memory', 'adjustment', 'heating', 'ventilation', 'massage', 'eeprom'],
    parts: [
      { name_en: 'Seat Control Module', name_ru: 'Модуль управления сиденьем', name_ka: 'სავარძლის კონტროლის მოდული', oem: '61359313999', manufacturer: 'BMW', price_min: 300, price_max: 500, priority: 1, category: 'interior' },
      { name_en: 'Seat Heater Element', name_ru: 'Элемент подогрева сиденья', name_ka: 'სავარძლის გამათბობელი ელემენტი', oem: '52107068676', manufacturer: 'BMW', price_min: 80, price_max: 150, priority: 2, category: 'interior' }
    ]
  },
  'Security': {
    keywords: ['security', 'alarm', 'immobilizer', 'key', 'central locking', 'ews', 'cas', 'theft'],
    parts: [
      { name_en: 'Key Fob Battery CR2032', name_ru: 'Батарейка для ключа CR2032', name_ka: 'გასაღების ბატარეა CR2032', oem: '66126935736', manufacturer: 'BMW', price_min: 5, price_max: 10, priority: 3, category: 'security' },
      { name_en: 'Door Lock Actuator', name_ru: 'Актуатор замка двери', name_ka: 'კარის საკეტის აქტუატორი', oem: '51217202143', manufacturer: 'BMW', price_min: 80, price_max: 150, priority: 2, category: 'security' }
    ]
  },
  'Steering': {
    keywords: ['steering', 'rack', 'power steering', 'eps', 'servotronic', 'active steering', 'angle'],
    parts: [
      { name_en: 'Power Steering Fluid', name_ru: 'Жидкость ГУР', name_ka: 'საჭის ჰიდრავლიკური სითხე', oem: '83290429576', manufacturer: 'BMW', price_min: 15, price_max: 25, priority: 2, category: 'steering' },
      { name_en: 'Steering Rack', name_ru: 'Рулевая рейка', name_ka: 'საჭის რეიკა', oem: '32106793246', manufacturer: 'BMW', price_min: 800, price_max: 1200, priority: 1, category: 'steering' }
    ]
  },
  'Restraint System': {
    keywords: ['airbag', 'srs', 'restraint', 'crash', 'sensor', 'occupancy', 'belt tensioner', 'safety'],
    parts: [
      { name_en: 'Airbag Control Module', name_ru: 'Блок управления подушками безопасности', name_ka: 'ერბაგების კონტროლის მოდული', oem: '65779159888', manufacturer: 'BMW', price_min: 400, price_max: 600, priority: 1, category: 'safety' },
      { name_en: 'Seat Occupancy Sensor', name_ru: 'Датчик присутствия пассажира', name_ka: 'მგზავრის არსებობის სენსორი', oem: '65779153400', manufacturer: 'BMW', price_min: 150, price_max: 250, priority: 2, category: 'safety' }
    ]
  },
  'Suspension': {
    keywords: ['suspension', 'shock', 'strut', 'spring', 'damper', 'ride', 'adaptive', 'edc'],
    parts: [
      { name_en: 'Shock Absorber Front', name_ru: 'Амортизатор передний', name_ka: 'წინა ამორტიზატორი', oem: '31316786995', manufacturer: 'BMW', price_min: 150, price_max: 250, priority: 1, category: 'suspension' },
      { name_en: 'Control Arm Front Lower', name_ru: 'Рычаг передний нижний', name_ka: 'წინა ქვედა მკლავი', oem: '31126775310', manufacturer: 'BMW', price_min: 100, price_max: 180, priority: 2, category: 'suspension' }
    ]
  },
  'Body Electronics': {
    keywords: ['door', 'window', 'lock', 'trunk', 'tailgate', 'body', 'frm', 'cem', 'module'],
    parts: [
      { name_en: 'Door Lock Actuator', name_ru: 'Актуатор замка двери', name_ka: 'კარის საკეტის აქტუატორი', oem: '51217202143', manufacturer: 'BMW', price_min: 80, price_max: 150, priority: 1, category: 'body' },
      { name_en: 'Window Regulator', name_ru: 'Стеклоподъемник', name_ka: 'მინის ამწევი', oem: '51337020660', manufacturer: 'BMW', price_min: 120, price_max: 200, priority: 2, category: 'body' }
    ]
  },
  'Sensors': {
    keywords: ['sensor', 'pressure', 'position', 'speed', 'angle', 'level', 'tpms', 'tire'],
    parts: [
      { name_en: 'TPMS Sensor', name_ru: 'Датчик давления в шинах', name_ka: 'საბურავის წნევის სენსორი', oem: '36106798872', manufacturer: 'BMW', price_min: 50, price_max: 80, priority: 2, category: 'sensors' },
      { name_en: 'Crankshaft Position Sensor', name_ru: 'Датчик положения коленвала', name_ka: 'ამწევის მდებარეობის სენსორი', oem: '13627525015', manufacturer: 'BMW', price_min: 60, price_max: 100, priority: 1, category: 'sensors' }
    ]
  },
  'Turbo': {
    keywords: ['turbo', 'turbocharger', 'boost', 'wastegate', 'intercooler', 'charge', 'overboost'],
    parts: [
      { name_en: 'Turbocharger', name_ru: 'Турбокомпрессор', name_ka: 'ტურბოკომპრესორი', oem: '11657649290', manufacturer: 'BMW', price_min: 1200, price_max: 1800, priority: 1, category: 'turbo' },
      { name_en: 'Wastegate Actuator', name_ru: 'Актуатор вестгейта', name_ka: 'ვესტგეიტის აქტუატორი', oem: '11657649291', manufacturer: 'BMW', price_min: 200, price_max: 350, priority: 2, category: 'turbo' }
    ]
  },
  'Diagnostic': {
    keywords: ['diagnostic', 'scan', 'tool', 'reset', 'coding', 'programming', 'communication', 'network', 'can', 'module'],
    parts: [
      { name_en: 'BMW ISTA Diagnostic Scanner', name_ru: 'Диагностический сканер BMW ISTA', name_ka: 'BMW ISTA დიაგნოსტიკური სკანერი', oem: 'ISTA-TOOL', manufacturer: 'BMW', price_min: 100, price_max: 300, priority: 3, category: 'diagnostic' },
      { name_en: 'OBD2 K+DCAN Cable', name_ru: 'OBD2 K+DCAN кабель', name_ka: 'OBD2 K+DCAN კაბელი', oem: 'K-DCAN-USB', manufacturer: 'Generic', price_min: 30, price_max: 60, priority: 3, category: 'diagnostic' }
    ]
  }
};

// Default fallback parts
const DEFAULT_PARTS = [
  { name_en: 'OBD2 Diagnostic Scanner', name_ru: 'Диагностический сканер OBD2', name_ka: 'OBD2 დიაგნოსტიკური სკანერი', oem: 'OBD2-TOOL', manufacturer: 'Generic', price_min: 50, price_max: 150, priority: 3, category: 'diagnostic' }
];

function selectPartsForCode(code) {
  const codeStr = JSON.stringify(code).toLowerCase();
  const title = (code.title?.en || code.title || '').toLowerCase();
  const description = (code.description?.en || code.description || '').toLowerCase();
  const category = (code.category || '').toLowerCase();
  
  // Combine all text for keyword matching
  const searchText = `${codeStr} ${title} ${description}`;
  
  // First, try exact category match
  for (const [catName, config] of Object.entries(PARTS_DATABASE)) {
    if (category === catName.toLowerCase() || category.replace(/[\/\s]/g, '') === catName.toLowerCase().replace(/[\/\s]/g, '')) {
      return config.parts.slice(0, 2);
    }
  }
  
  // Then try keyword matching with scoring
  let bestMatch = null;
  let bestScore = 0;
  
  for (const [catName, config] of Object.entries(PARTS_DATABASE)) {
    let score = 0;
    for (const keyword of config.keywords) {
      if (searchText.includes(keyword)) {
        score++;
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = config.parts;
    }
  }
  
  // Return best match if found, otherwise default
  if (bestMatch && bestScore > 0) {
    return bestMatch.slice(0, 2);
  }
  
  // Fallback to default
  return DEFAULT_PARTS.slice(0, 1);
}

function generatePartId(code, index) {
  return `part_${code.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${String(index).padStart(3, '0')}`;
}

function escapeSQL(str) {
  if (!str) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

function generatePartsSQL() {
  const parts = [];
  const links = [];
  let processedCount = 0;
  
  allCodes.forEach((code, codeIndex) => {
    const selectedParts = selectPartsForCode(code);
    const models = (code.applicableModels || ['E90', 'F30', 'G20']).slice(0, 3).join(', ');
    
    selectedParts.forEach((part, partIndex) => {
      const partId = generatePartId(code.code, partIndex + 1);
      
      // Generate part entry
      parts.push(`('${partId}', ${escapeSQL(code.code)}, ${escapeSQL(part.name_en)}, ${escapeSQL(part.name_ru)}, ${escapeSQL(part.name_ka)}, ${escapeSQL(part.category)}, ${escapeSQL(part.oem)}, ${escapeSQL(part.manufacturer)}, 1, ${part.price_min}, ${part.price_max}, 'USD', ${part.priority}, ${escapeSQL(models)}, 'medium', 1.0, 24, 'Auto-generated', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
      
      // Generate affiliate links with proper search URLs
      const searchTerm = `${part.manufacturer} ${part.name_en} ${part.oem}`.replace(/\s+/g, '+');
      
      const marketplaces = [
        { 
          name: 'realoem', 
          url: `https://www.realoem.com/bmw/enUS/select`,
          mult: 1.1 
        },
        { 
          name: 'amazon', 
          url: `https://www.amazon.com/s?k=${searchTerm}`,
          mult: 0.95 
        },
        { 
          name: 'ebay', 
          url: `https://www.ebay.com/sch/i.html?_nkw=${searchTerm}`,
          mult: 0.9 
        }
      ];
      
      marketplaces.forEach(mp => {
        const linkId = `${partId}_${mp.name}`;
        const pMin = (part.price_min * mp.mult).toFixed(2);
        const pMax = (part.price_max * mp.mult).toFixed(2);
        links.push(`('${linkId}', '${partId}', '${mp.name}', 'global', '${mp.url}', '${part.manufacturer} ${part.name_en}', ${pMin}, ${pMax}, 'USD', 1, 4.5, 0, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP)`);
      });
    });
    
    processedCount++;
    if (processedCount % 50 === 0) {
      console.log(`⚙️  Processed ${processedCount}/${allCodes.length} codes...`);
    }
  });
  
  return { parts, links };
}

console.log('🚀 Generating parts and affiliate links...\n');
const { parts, links } = generatePartsSQL();

console.log(`\n✅ Generation complete!`);
console.log(`   📦 Parts: ${parts.length}`);
console.log(`   🔗 Links: ${links.length}`);
console.log(`   📊 Codes: ${allCodes.length}\n`);

// Write to SQL file in batches
const BATCH_SIZE = 50;
let sqlContent = '-- COMPREHENSIVE parts data for ALL BMW error codes\n';
sqlContent += `-- Generated: ${new Date().toISOString()}\n`;
sqlContent += `-- Total codes: ${allCodes.length}\n`;
sqlContent += `-- Total parts: ${parts.length}\n`;
sqlContent += `-- Total links: ${links.length}\n`;
sqlContent += `-- Categories: 20+\n\n`;

// Write parts in batches
console.log('📝 Writing parts to SQL file...');
for (let i = 0; i < parts.length; i += BATCH_SIZE) {
  const batch = parts.slice(i, i + BATCH_SIZE);
  sqlContent += `-- Parts batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(parts.length / BATCH_SIZE)}\n`;
  sqlContent += 'INSERT INTO error_code_parts VALUES\n';
  sqlContent += batch.join(',\n');
  sqlContent += ';\n\n';
}

// Write links in batches
console.log('📝 Writing affiliate links to SQL file...');
for (let i = 0; i < links.length; i += BATCH_SIZE) {
  const batch = links.slice(i, i + BATCH_SIZE);
  sqlContent += `-- Links batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(links.length / BATCH_SIZE)}\n`;
  sqlContent += 'INSERT INTO part_affiliate_links VALUES\n';
  sqlContent += batch.join(',\n');
  sqlContent += ';\n\n';
}

const outputFile = path.join(__dirname, 'seed_all_parts.sql');
fs.writeFileSync(outputFile, sqlContent);

console.log(`\n🎉 SUCCESS!`);
console.log(`   📄 File: seed_all_parts.sql`);
console.log(`   💾 Size: ${(sqlContent.length / 1024).toFixed(2)} KB`);
console.log(`   🎯 Categories: ${Object.keys(PARTS_DATABASE).length}`);
console.log('\n🚀 To load into database:');
console.log('   npx wrangler d1 execute DB --file=clear_parts.sql');
console.log('   npx wrangler d1 execute DB --file=seed_all_parts.sql\n');
