const mongoose = require('mongoose');

const portSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    index: true
  },
  country: {
    type: String,
    required: true,
    index: true
  },
  coordinates: {
    type: [Number],
    required: true,
    index: '2dsphere'
  },
  harborSize: String,
  harborType: String,
  shelter: String,
  channelDepth: String,
  anchorageDepth: String,
  cargoDepth: String,
  oilDepth: String,
  maxVessel: String,
  medFacilities: String,
  garbage: String,
  cranesFixed: String,
  cranesMobile: String,
  cranesFloat: String,
  provisions: String,
  water: String,
  fuelOil: String,
  diesel: String,
  repairCode: String,
  drydock: String,
  railway: String,
  vhf: String,
  phone: String,
  radio: String,
  pilotRequired: String,
  tugAssist: String
}, {
  timestamps: true
});

// Create indexes for better query performance
portSchema.index({ name: 1 });
portSchema.index({ country: 1 });
portSchema.index({ coordinates: '2dsphere' });

module.exports = mongoose.model('Port', portSchema); 