const express = require('express');
const Cafe = require('../models/Cafe');
const router = express.Router();


router.get('/nearby', async (req, res) => {
    const { lat, lng, radius } = req.query;

    try {
        const cafes = await Cafe.find({
            location: {
                $geoWithin: {
                    $centerSphere: [[lng, lat], radius / 6378.1]
                }
            }
        });

        res.json(cafes);

    } catch (error) {
        res.status(500).json({ error: 'Server Error!' });
    }
});
router.get('/search', async (req, res) => {
    try {
        const q = req.query.q;
        const results = await Cafe.find({ name: { $regex: new RegExp(q, 'i') } }).limit(10);
        res.json(results);
    } catch (err) {
        res.status(500).json({ message: "Search failed" });
    }
});

module.exports = router;