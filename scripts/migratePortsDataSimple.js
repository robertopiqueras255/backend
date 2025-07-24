const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Port = require('../models/Port');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bedrock-terminal';

async function migratePortsDataSimple() {
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

    // Insert all ports data (coordinates are already correct)
    console.log('📝 Inserting all ports data...');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const port of portsData) {
      try {
        // Basic validation - just check if coordinates exist and are numbers
        if (port.coordinates && Array.isArray(port.coordinates) && port.coordinates.length === 2) {
          const [first, second] = port.coordinates;
          if (typeof first === 'number' && typeof second === 'number') {
            await Port.create(port);
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
migratePortsDataSimple(); 