const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Port = require('../models/Port');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bedrock-terminal';

async function analyzeMigration() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB successfully');

    // Read original data
    const portsDataPath = path.join(__dirname, '../src/data/portsData.json');
    const originalData = JSON.parse(fs.readFileSync(portsDataPath, 'utf8'));
    console.log(`📊 Original data: ${originalData.length} ports`);

    // Get migrated data
    const migratedCount = await Port.countDocuments();
    console.log(`📊 Migrated data: ${migratedCount} ports`);

    // Analyze coordinate issues
    console.log('\n🔍 Analyzing coordinate issues...');
    let validCoords = 0;
    let invalidCoords = 0;
    let missingCoords = 0;
    let swappedCoords = 0;

    for (const port of originalData) {
      if (!port.coordinates) {
        missingCoords++;
      } else if (Array.isArray(port.coordinates) && port.coordinates.length === 2) {
        const [first, second] = port.coordinates;
        if (typeof first === 'number' && typeof second === 'number') {
          // Check if coordinates are in correct format [lon, lat]
          if (first >= -180 && first <= 180 && second >= -90 && second <= 90) {
            validCoords++;
          } else {
            // Check if they're swapped [lat, lon]
            if (second >= -180 && second <= 180 && first >= -90 && first <= 90) {
              swappedCoords++;
            } else {
              invalidCoords++;
            }
          }
        } else {
          invalidCoords++;
        }
      } else {
        invalidCoords++;
      }
    }

    console.log(`✅ Valid coordinates: ${validCoords}`);
    console.log(`🔄 Swapped coordinates (lat/lon): ${swappedCoords}`);
    console.log(`❌ Invalid coordinates: ${invalidCoords}`);
    console.log(`❓ Missing coordinates: ${missingCoords}`);

    // Check important ports
    console.log('\n🔍 Checking important ports...');
    const importantPorts = [
      'ROTTERDAM', 'SINGAPORE', 'HOUSTON', 'SHANGHAI', 'DUBAI',
      'LOS ANGELES', 'NEW YORK', 'TOKYO', 'LONDON', 'HAMBURG'
    ];

    for (const portName of importantPorts) {
      const port = await Port.findOne({ name: { $regex: new RegExp(portName, 'i') } });
      if (port) {
        console.log(`✅ ${portName}: FOUND (${port.country})`);
      } else {
        console.log(`❌ ${portName}: NOT FOUND`);
      }
    }

    // Check oil facilities
    console.log('\n🔍 Checking oil facilities...');
    const oilPorts = await Port.find({
      $or: [
        { oilDepth: { $exists: true, $ne: '' } },
        { fuelOil: 'Y' },
        { diesel: 'Y' },
        { harborType: { $in: ['LC', 'LT'] } }
      ]
    });
    console.log(`🛢️  Oil facilities ports: ${oilPorts.length}`);

    // Sample of oil ports
    console.log('\n📋 Sample oil facilities ports:');
    oilPorts.slice(0, 10).forEach(port => {
      console.log(`  - ${port.name} (${port.country})`);
    });

    // Check by country
    console.log('\n🌍 Top countries by port count:');
    const countryStats = await Port.aggregate([
      { $group: { _id: '$country', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    countryStats.forEach(stat => {
      console.log(`  - ${stat._id}: ${stat.count} ports`);
    });

    console.log('\n✅ Analysis completed!');

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('🔌 MongoDB connection closed');
    }
  }
}

// Run the analysis
analyzeMigration(); 