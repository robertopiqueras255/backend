const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Port = require('../models/Port');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bedrock-terminal';

async function migratePortsData() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
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

    // Insert all ports data
    console.log('📝 Inserting ports data...');
    const result = await Port.insertMany(portsData);
    console.log(`✅ Successfully migrated ${result.length} ports`);

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
migratePortsData(); 