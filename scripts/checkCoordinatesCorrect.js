const fs = require('fs');
const path = require('path');

// Read the ports data JSON file
const portsDataPath = path.join(__dirname, '../src/data/portsData.json');
console.log(`📖 Reading ports data from: ${portsDataPath}`);

if (!fs.existsSync(portsDataPath)) {
  console.error('❌ Ports data file not found');
  process.exit(1);
}

const portsData = JSON.parse(fs.readFileSync(portsDataPath, 'utf8'));
console.log(`📊 Found ${portsData.length} ports in the data file`);

// Check first 10 ports with CORRECT validation
console.log('\n🔍 Checking first 10 ports (CORRECTED ANALYSIS):');
for (let i = 0; i < Math.min(10, portsData.length); i++) {
  const port = portsData[i];
  console.log(`${i + 1}. ${port.name} (${port.country}):`);
  console.log(`   Coordinates: ${JSON.stringify(port.coordinates)}`);
  
  if (port.coordinates && Array.isArray(port.coordinates) && port.coordinates.length === 2) {
    const [first, second] = port.coordinates;
    console.log(`   First: ${first} (${typeof first})`);
    console.log(`   Second: ${second} (${typeof second})`);
    
    // CORRECT validation for [latitude, longitude] format
    const isValidLatLon = typeof first === 'number' && typeof second === 'number' &&
                         first >= -90 && first <= 90 && second >= -180 && second <= 180;
    
    // Also check if it's in [longitude, latitude] format
    const isValidLonLat = typeof first === 'number' && typeof second === 'number' &&
                         first >= -180 && first <= 180 && second >= -90 && second <= 90;
    
    console.log(`   Valid as [lat, lon]: ${isValidLatLon}`);
    console.log(`   Valid as [lon, lat]: ${isValidLonLat}`);
    
    if (isValidLatLon && !isValidLonLat) {
      console.log(`   ✅ Format: [latitude, longitude]`);
    } else if (isValidLonLat && !isValidLatLon) {
      console.log(`   ✅ Format: [longitude, latitude]`);
    } else if (isValidLatLon && isValidLonLat) {
      console.log(`   ⚠️  Could be either format`);
    } else {
      console.log(`   ❌ Invalid coordinates`);
    }
  }
  console.log('');
}

// Check all ports with correct validation
console.log('🔍 Checking all ports for valid coordinates...');
let validLatLonCount = 0;
let validLonLatCount = 0;
let invalidCount = 0;
let ambiguousCount = 0;

for (const port of portsData) {
  if (port.coordinates && Array.isArray(port.coordinates) && port.coordinates.length === 2) {
    const [first, second] = port.coordinates;
    
    if (typeof first === 'number' && typeof second === 'number') {
      const isValidLatLon = first >= -90 && first <= 90 && second >= -180 && second <= 180;
      const isValidLonLat = first >= -180 && first <= 180 && second >= -90 && second <= 90;
      
      if (isValidLatLon && !isValidLonLat) {
        validLatLonCount++;
      } else if (isValidLonLat && !isValidLatLon) {
        validLonLatCount++;
      } else if (isValidLatLon && isValidLonLat) {
        ambiguousCount++;
      } else {
        invalidCount++;
      }
    } else {
      invalidCount++;
    }
  } else {
    invalidCount++;
  }
}

console.log(`✅ Valid [lat, lon] format: ${validLatLonCount}`);
console.log(`✅ Valid [lon, lat] format: ${validLonLatCount}`);
console.log(`⚠️  Ambiguous format: ${ambiguousCount}`);
console.log(`❌ Invalid coordinates: ${invalidCount}`);
console.log(`📊 Total ports: ${portsData.length}`);

// Show some examples of each type
console.log('\n📋 Examples of each format:');
let latLonExamples = 0;
let lonLatExamples = 0;

for (const port of portsData) {
  if (port.coordinates && Array.isArray(port.coordinates) && port.coordinates.length === 2) {
    const [first, second] = port.coordinates;
    
    if (typeof first === 'number' && typeof second === 'number') {
      const isValidLatLon = first >= -90 && first <= 90 && second >= -180 && second <= 180;
      const isValidLonLat = first >= -180 && first <= 180 && second >= -90 && second <= 90;
      
      if (isValidLatLon && !isValidLonLat && latLonExamples < 3) {
        console.log(`  [lat, lon]: ${port.name} - [${first}, ${second}]`);
        latLonExamples++;
      } else if (isValidLonLat && !isValidLatLon && lonLatExamples < 3) {
        console.log(`  [lon, lat]: ${port.name} - [${first}, ${second}]`);
        lonLatExamples++;
      }
    }
  }
} 