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

// Check first 10 ports
console.log('\n🔍 Checking first 10 ports:');
for (let i = 0; i < Math.min(10, portsData.length); i++) {
  const port = portsData[i];
  console.log(`${i + 1}. ${port.name} (${port.country}):`);
  console.log(`   Coordinates: ${JSON.stringify(port.coordinates)}`);
  console.log(`   Type: ${typeof port.coordinates}`);
  console.log(`   Is Array: ${Array.isArray(port.coordinates)}`);
  console.log(`   Length: ${port.coordinates ? port.coordinates.length : 'N/A'}`);
  
  if (port.coordinates && Array.isArray(port.coordinates) && port.coordinates.length === 2) {
    const [first, second] = port.coordinates;
    console.log(`   First: ${first} (${typeof first})`);
    console.log(`   Second: ${second} (${typeof second})`);
    
    // Check if they're valid numbers
    const isValid = typeof first === 'number' && typeof second === 'number' &&
                   first >= -180 && first <= 180 && second >= -90 && second <= 90;
    console.log(`   Valid: ${isValid}`);
  }
  console.log('');
}

// Check for any ports with valid coordinates
console.log('🔍 Checking all ports for valid coordinates...');
let validCount = 0;
let invalidCount = 0;

for (const port of portsData) {
  if (port.coordinates && Array.isArray(port.coordinates) && port.coordinates.length === 2) {
    const [first, second] = port.coordinates;
    if (typeof first === 'number' && typeof second === 'number' &&
        first >= -180 && first <= 180 && second >= -90 && second <= 90) {
      validCount++;
    } else {
      invalidCount++;
    }
  } else {
    invalidCount++;
  }
}

console.log(`✅ Valid coordinates: ${validCount}`);
console.log(`❌ Invalid coordinates: ${invalidCount}`);
console.log(`📊 Total ports: ${portsData.length}`); 