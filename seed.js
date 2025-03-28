require('dotenv').config();
const mongoose = require('mongoose');
const faker = require('@faker-js/faker').faker;
const Cafe = require('./models/Cafe');

const uri = process.env.MONGO_URI;
mongoose.connect(uri)
    .then(() => console.log("✅ MongoDB connected"))
    .catch(err => console.error("❌ Mongo error:", err));

// Türkiye için yaklaşık sınırlar (lat: enlem, lng: boylam)
const TURKEY_BOUNDS = {
    minLat: 36.0,
    maxLat: 42.1,
    minLng: 26.0,
    maxLng: 44.5,
};

const TYPES = ["Cafe", "Market", "Hairdresser"];

function generateRandomCoordinate(min, max) {
    return parseFloat((Math.random() * (max - min) + min).toFixed(6));
}

async function seedDB(count = 100000) {
    await Cafe.deleteMany({}); // Önce temizle
    console.log("🧹 Old cafes removed");

    const bulk = [];

    for (let i = 0; i < count; i++) {
        const lat = generateRandomCoordinate(TURKEY_BOUNDS.minLat, TURKEY_BOUNDS.maxLat);
        const lng = generateRandomCoordinate(TURKEY_BOUNDS.minLng, TURKEY_BOUNDS.maxLng);
        const type = TYPES[Math.floor(Math.random() * TYPES.length)];

        bulk.push({
            name: faker.company.name(),
            type,
            location: {
                type: "Point",
                coordinates: [lng, lat],
                address: faker.location.streetAddress()
            }
        });
    }

    await Cafe.insertMany(bulk);
    console.log(`✅ Seeded ${count} cafes across Turkey.`);
    mongoose.disconnect();
}

seedDB();