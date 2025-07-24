const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Port = require('../models/Port');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bedrock-terminal';

async function migratePortsDataDebug() {
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

    // Insert all ports data with detailed error reporting
    console.log('📝 Inserting all ports data...');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < portsData.length; i++) {
      const port = portsData[i];
      
      try {
        // Basic validation
        if (!port.coordinates || !Array.isArray(port.coordinates) || port.coordinates.length !== 2) {
          console.log(`⚠️  Skipping port "${port.name}" - missing or invalid coordinates`);
          errorCount++;
          continue;
        }

        const [first, second] = port.coordinates;
        if (typeof first !== 'number' || typeof second !== 'number') {
          console.log(`⚠️  Skipping port "${port.name}" - non-numeric coordinates: [${first}, ${second}]`);
          errorCount++;
          continue;
        }

        // Try to create the port
        const newPort = new Port(port);
        await newPort.save();
        successCount++;
        
        // Log progress every 100 ports
        if (successCount % 100 === 0) {
          console.log(`📊 Progress: ${successCount} ports migrated...`);
        }
        
      } catch (error) {
        console.log(`❌ Error inserting port "${port.name}" (index ${i}):`);
        console.log(`   Error: ${error.message}`);
        console.log(`   Port data: ${JSON.stringify(port, null, 2)}`);
        console.log(`   Coordinates: ${JSON.stringify(port.coordinates)}`);
        console.log('');
        errorCount++;
        
        // Stop after 5 errors to avoid spam
        if (errorCount >= 5) {
          console.log('⚠️  Stopping after 5 errors to avoid spam. Check the data format.');
          break;
        }
      }
    }
    
    console.log(`✅ Successfully migrated ${successCount} ports`);
    console.log(`❌ Failed to migrate ${errorCount} ports`);
    console.log(`📊 Total processed: ${successCount + errorCount}`);

    // Create indexes for better performance
    console.log('🔍 Creating indexes...');
    await Port.collection.createIndex({ name: 1 });
    await Port.collection.createIndex({ country: 1 });
    await Port.collection.createIndex({ coordinates: '2dsphere' });
    console.log('✅ Indexes created successfully');

    console.log('🎉 Migration completed!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
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
migratePortsDataDebug(); 