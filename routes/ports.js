const express = require('express');
const router = express.Router();
const Port = require('../models/Port');

// GET /api/ports/viewport - Get ports within geographic bounding box
router.get('/viewport', async (req, res) => {
  try {
    const { minLat, maxLat, minLon, maxLon, limit = 1000 } = req.query;

    // Validate required parameters
    if (!minLat || !maxLat || !minLon || !maxLon) {
      return res.status(400).json({
        error: 'Missing required parameters: minLat, maxLat, minLon, maxLon'
      });
    }

    // Parse coordinates
    const minLatNum = parseFloat(minLat);
    const maxLatNum = parseFloat(maxLat);
    const minLonNum = parseFloat(minLon);
    const maxLonNum = parseFloat(maxLon);

    // Validate coordinate ranges
    if (isNaN(minLatNum) || isNaN(maxLatNum) || isNaN(minLonNum) || isNaN(maxLonNum)) {
      return res.status(400).json({
        error: 'Invalid coordinate values'
      });
    }

    const ports = await Port.find({
      coordinates: {
        $geoWithin: {
          $box: [
            [minLonNum, minLatNum], // bottom left
            [maxLonNum, maxLatNum]  // top right
          ]
        }
      }
    }).limit(parseInt(limit));

    res.json({
      success: true,
      count: ports.length,
      data: ports
    });

  } catch (error) {
    console.error('Error fetching ports by viewport:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// GET /api/ports/country/:countryCode - Get ports by country
router.get('/country/:countryCode', async (req, res) => {
  try {
    const { countryCode } = req.params;
    const { limit = 1000 } = req.query;

    const ports = await Port.find({
      country: { $regex: new RegExp(countryCode, 'i') }
    }).limit(parseInt(limit));

    res.json({
      success: true,
      count: ports.length,
      country: countryCode,
      data: ports
    });

  } catch (error) {
    console.error('Error fetching ports by country:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// GET /api/ports/search - Search ports by name
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 50 } = req.query;

    if (!q) {
      return res.status(400).json({
        error: 'Missing search query parameter: q'
      });
    }

    const ports = await Port.find({
      name: { $regex: new RegExp(q, 'i') }
    }).limit(parseInt(limit));

    res.json({
      success: true,
      count: ports.length,
      query: q,
      data: ports
    });

  } catch (error) {
    console.error('Error searching ports:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// GET /api/ports/oil-facilities - Get ports with oil facilities
router.get('/oil-facilities', async (req, res) => {
  try {
    const { limit = 1000 } = req.query;

    const ports = await Port.find({
      $or: [
        { oilDepth: { $exists: true, $ne: '' } },
        { fuelOil: 'Y' },
        { diesel: 'Y' },
        { harborType: { $in: ['LC', 'LT'] } }
      ]
    }).limit(parseInt(limit));

    res.json({
      success: true,
      count: ports.length,
      data: ports
    });

  } catch (error) {
    console.error('Error fetching oil facilities ports:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// GET /api/ports/:id - Get specific port by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const port = await Port.findById(id);

    if (!port) {
      return res.status(404).json({
        error: 'Port not found'
      });
    }

    res.json({
      success: true,
      data: port
    });

  } catch (error) {
    console.error('Error fetching port by ID:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router; 