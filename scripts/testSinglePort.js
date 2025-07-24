const mongoose = require('mongoose');
const Port = require('../models/Port');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bedrock-terminal';

async function testSinglePort() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB successfully');

    // Test with San Diego coordinates
    const testPort = {
      name: "SAN DIEGO TEST",
      country: "US",
      coordinates: [32.716667, -117.183333], // [lat, lon] format
      harborSize: "M",
      harborType: "CN"
    };

    console.log('🧪 Testing port insertion...');
    console.log(`Port: ${testPort.name}`);
    console.log(`Coordinates: [${testPort.coordinates}]`);
    console.log(`Format: [latitude, longitude]`);

    // Try to create the port
    const newPort = new Port(testPort);
    await newPort.save();
    console.log('✅ Port inserted successfully!');

    // Now test with swapped coordinates
    console.log('\n🧪 Testing with swapped coordinates...');
    const testPortSwapped = {
      name: "SAN DIEGO TEST SWAPPED",
      country: "US",
      coordinates: [-117.183333, 32.716667], // [lon, lat] format
      harborSize: "M",
      harborType: "CN"
    };

    console.log(`Port: ${testPortSwapped.name}`);
    console.log(`Coordinates: [${testPortSwapped.coordinates}]`);
    console.log(`Format: [longitude, latitude]`);

    const newPortSwapped = new Port(testPortSwapped);
    await newPortSwapped.save();
    console.log('✅ Swapped port inserted successfully!');

    // Check which one works better
    console.log('\n🔍 Testing geospatial queries...');
    
    // Test query with original format
    const nearbyOriginal = await Port.find({
      coordinates: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [32.716667, -117.183333] // [lat, lon]
          },
          $maxDistance: 1000
        }
      }
    });
    console.log(`📍 Found ${nearbyOriginal.length} ports near original coordinates`);

    // Test query with swapped format
    const nearbySwapped = await Port.find({
      coordinates: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [-117.183333, 32.716667] // [lon, lat]
          },
          $maxDistance: 1000
        }
      }
    });
    console.log(`📍 Found ${nearbySwapped.length} ports near swapped coordinates`);

    console.log('\n✅ Test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('🔌 MongoDB connection closed');
    }
  }
}

// Run the test
testSinglePort(); 