const mongoose = require('mongoose');

const CafeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    location: {
        type: { type: String, default: "Point" },
        coordinates: [Number],
        address: { type: String, required: true }
    },
    type: { type: String, required: true }
}, { versionKey: false });

CafeSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Cafe', CafeSchema, 'cafes');