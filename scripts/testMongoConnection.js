const mongoose = require('mongoose');
const Port = require('../models/Port');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bedrock-terminal';

async function testMongoConnection() {
  try {
    console.log('🔌 Testing MongoDB connection...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB successfully');

    // Test basic operations
    console.log('📊 Testing basic operations...');
    
    // Count documents
    const count = await Port.countDocuments();
    console.log(`📈 Total ports in database: ${count}`);

    // Test a simple query
    const samplePort = await Port.findOne();
    if (samplePort) {
      console.log(`📍 Sample port: ${samplePort.name} in ${samplePort.country}`);
    } else {
      console.log('⚠️  No ports found in database');
    }

    // Test geospatial query
    const nearbyPorts = await Port.find({
      coordinates: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [0, 0] // Prime meridian and equator
          },
          $maxDistance: 1000000 // 1000km
        }
      }
    }).limit(5);

    console.log(`🌍 Found ${nearbyPorts.length} ports near coordinates [0, 0]`);

    console.log('✅ All tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    // Close the MongoDB connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('🔌 MongoDB connection closed');
    }
  }
}

// Run the test
testMongoConnection(); 