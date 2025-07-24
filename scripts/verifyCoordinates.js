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

// Find ambiguous ports (could be either [lat,lon] or [lon,lat])
console.log('\n🔍 Finding ambiguous ports for verification...');
const ambiguousPorts = [];

for (const port of portsData) {
  if (port.coordinates && Array.isArray(port.coordinates) && port.coordinates.length === 2) {
    const [first, second] = port.coordinates;
    
    if (typeof first === 'number' && typeof second === 'number') {
      const isValidLatLon = first >= -90 && first <= 90 && second >= -180 && second <= 180;
      const isValidLonLat = first >= -180 && first <= 180 && second >= -90 && second <= 90;
      
      if (isValidLatLon && isValidLonLat) {
        ambiguousPorts.push(port);
      }
    }
  }
}

console.log(`📋 Found ${ambiguousPorts.length} ambiguous ports`);

// Show first 10 ambiguous ports for verification
console.log('\n🔍 First 10 ambiguous ports for verification:');
for (let i = 0; i < Math.min(10, ambiguousPorts.length); i++) {
  const port = ambiguousPorts[i];
  const [first, second] = port.coordinates;
  
  console.log(`${i + 1}. ${port.name} (${port.country})`);
  console.log(`   Current coordinates: [${first}, ${second}]`);
  console.log(`   If [lat, lon]: ${first}°N/S, ${second}°E/W`);
  console.log(`   If [lon, lat]: ${first}°E/W, ${second}°N/S`);
  console.log(`   Google Maps search: https://www.google.com/maps?q=${first},${second}`);
  console.log('');
}

// Also show some clearly [lat,lon] format ports for comparison
console.log('\n🔍 Some clearly [lat,lon] format ports for comparison:');
let latLonCount = 0;
for (const port of portsData) {
  if (port.coordinates && Array.isArray(port.coordinates) && port.coordinates.length === 2) {
    const [first, second] = port.coordinates;
    
    if (typeof first === 'number' && typeof second === 'number') {
      const isValidLatLon = first >= -90 && first <= 90 && second >= -180 && second <= 180;
      const isValidLonLat = first >= -180 && first <= 180 && second >= -90 && second <= 90;
      
      if (isValidLatLon && !isValidLonLat && latLonCount < 5) {
        console.log(`${latLonCount + 1}. ${port.name} (${port.country})`);
        console.log(`   Coordinates: [${first}, ${second}]`);
        console.log(`   Clearly [lat, lon]: ${first}°N/S, ${second}°E/W`);
        console.log(`   Google Maps search: https://www.google.com/maps?q=${first},${second}`);
        console.log('');
        latLonCount++;
      }
    }
  }
}

console.log('💡 Instructions:');
console.log('1. Copy any of the Google Maps URLs above');
console.log('2. Check if the location matches the port name');
console.log('3. If it matches, the format is correct');
console.log('4. If it\'s wrong, the coordinates need to be swapped'); 