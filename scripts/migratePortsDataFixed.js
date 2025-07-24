const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Port = require('../models/Port');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bedrock-terminal';

async function migratePortsDataFixed() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB successfully');

    // Read the ports data JSON file
    const portsDataPath = path.join(__dirname, '../src/data/portsData.json');
    console.log(`📖 Reading ports data from: ${portsDataPath}`);
    
    if (!fs.existsSync(portsDataPath)) {
      throw new Error(`Ports data file not found at: ${portsDataPath}`);
    }

    const portsData = JSON.parse(fs.readFileSync(portsDataPath, 'utf8'));
    console.log(`📊 Found ${portsData.length} ports in the data file`);

    // Clear all existing data
    console.log('🗑️  Clearing existing ports data...');
    await Port.deleteMany({});
    console.log('✅ Existing data cleared');

    // Insert all ports data with coordinate fixing
    console.log('📝 Inserting ports data with coordinate fixes...');
    
    let successCount = 0;
    let errorCount = 0;
    let fixedCount = 0;
    
    for (const port of portsData) {
      try {
        // Validate and fix coordinates
        if (port.coordinates && Array.isArray(port.coordinates) && port.coordinates.length === 2) {
          const [first, second] = port.coordinates;
          
          if (typeof first === 'number' && typeof second === 'number') {
            let fixedCoordinates = port.coordinates;
            
            // Check if coordinates are in wrong format [lat, lon] instead of [lon, lat]
            if (first >= -90 && first <= 90 && second >= -180 && second <= 180) {
              // This is [lat, lon] format, need to swap to [lon, lat]
              fixedCoordinates = [second, first];
              fixedCount++;
              console.log(`🔄 Fixed coordinates for ${port.name}: [${first}, ${second}] → [${second}, ${first}]`);
            } else if (first >= -180 && first <= 180 && second >= -90 && second <= 90) {
              // This is already correct [lon, lat] format
              fixedCoordinates = [first, second];
            } else {
              console.log(`⚠️  Skipping port "${port.name}" - invalid coordinates: [${first}, ${second}]`);
              errorCount++;
              continue;
            }
            
            // Create port with fixed coordinates
            const fixedPort = { ...port, coordinates: fixedCoordinates };
            await Port.create(fixedPort);
            successCount++;
          } else {
            console.log(`⚠️  Skipping port "${port.name}" - non-numeric coordinates`);
            errorCount++;
          }
        } else {
          console.log(`⚠️  Skipping port "${port.name}" - missing or invalid coordinates`);
          errorCount++;
        }
      } catch (error) {
        console.log(`❌ Error inserting port "${port.name}": ${error.message}`);
        errorCount++;
      }
    }
    
    console.log(`✅ Successfully migrated ${successCount} ports`);
    console.log(`🔄 Fixed coordinates for ${fixedCount} ports`);
    if (errorCount > 0) {
      console.log(`⚠️  Skipped ${errorCount} ports due to invalid data`);
    }

    // Create indexes for better performance
    console.log('🔍 Creating indexes...');
    await Port.collection.createIndex({ name: 1 });
    await Port.collection.createIndex({ country: 1 });
    await Port.collection.createIndex({ coordinates: '2dsphere' });
    console.log('✅ Indexes created successfully');

    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    // Close the MongoDB connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('🔌 MongoDB connection closed');
    }
  }
}

// Run the migration
migratePortsDataFixed(); 