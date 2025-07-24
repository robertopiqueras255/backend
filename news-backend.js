// news-backend.js
// Enhanced Express backend with MarineTraffic API integration, Redis caching, and Socket.IO

const express = require('express');
const cors = require('cors');
const Parser = require('rss-parser');
const http = require('http');
const mongoose = require('mongoose');
require('dotenv').config();

// Import new services
const { redisClient, cacheUtils } = require('./redisClient');
const marineTrafficService = require('./marineTrafficService');
const WebSocketHandler = require('./websocketHandler');
const portsRouter = require('./routes/ports');

// MongoDB Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bedrock-terminal';

// Log environment variables on startup
console.log('🔧 Environment Variables Check:');
console.log('- MARINETRAFFIC_API_KEY:', process.env.MARINETRAFFIC_API_KEY ? 'SET' : 'NOT SET');
console.log('- MAPBOX_TOKEN:', process.env.MAPBOX_TOKEN ? 'SET' : 'NOT SET');
console.log('- MONGODB_URI:', process.env.MONGODB_URI ? 'SET' : 'NOT SET');
console.log('- REDIS_HOST:', process.env.REDIS_HOST || 'localhost');
console.log('- PORT:', process.env.PORT || 4000);
console.log('- NODE_ENV:', process.env.NODE_ENV || 'development');

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 4000;
const parser = new Parser();

// Initialize WebSocket handler
const wsHandler = new WebSocketHandler(server);

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.log('⚠️  Continuing without MongoDB connection');
  }
}

// Initialize MongoDB connection
connectToMongoDB();

// Oil Price API Configuration
const OIL_PRICE_API_KEY = '50efc7a396586517babc8e62bc338e82bc3246f6fd9e92a1923a477ada10f02c';

// Mapbox Token Configuration
const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;

// Oil price cache with current and previous prices
let oilPriceCache = {
  current: null,
  previous: null,
  lastUpdated: null,
  isUpdating: false
};

// Coal price cache with current and previous prices
let coalPriceCache = {
  current: null,
  previous: null,
  lastUpdated: null,
  isUpdating: false
};

const FEEDS = {
  energy: 'https://rss.app/feeds/_iP3HVWTdd0BxHjSn.xml', // rss.app energy feed
  commodities: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', // fallback example
  bloomberg: 'https://www.bloomberg.com/feed/podcast/energy.xml',
  'minerals and metals': 'https://rss.app/feeds/_Ky0tiLYZBarIjRMC.xml', // rss.app minerals and metals feed
};

app.use(cors());
app.use(express.json());

// Mount ports router
app.use('/api/ports', portsRouter);

// Function to fetch oil prices from OilPriceAPI
async function fetchOilPrices() {
  try {
    const [brent, wti, dubai] = await Promise.all([
      fetchWithChangeFromOilPriceAPI('BRENT_CRUDE_USD'),
      fetchWithChangeFromOilPriceAPI('WTI_USD'),
      fetchWithChangeFromOilPriceAPI('DUBAI_CRUDE_USD')
    ]);

    return {
      brent: {
        title: 'Brent Crude',
        subtitle: 'North Sea • ICE',
        ...brent
      },
      wti: {
        title: 'WTI Crude',
        subtitle: 'Texas • NYMEX',
        ...wti
      },
      dubai: {
        title: 'Dubai Crude',
        subtitle: 'Dubai • OilPriceAPI',
        ...dubai
      }
    };
  } catch (error) {
    console.error('Error fetching oil prices:', error);
    return null;
  }
}

// Function to fetch historical prices and calculate change
async function fetchWithChangeFromOilPriceAPI(code) {
  try {
    const response = await fetch(`https://api.oilpriceapi.com/v1/prices/past_day?by_code=${code}&period=2`, {
      headers: {
        Authorization: `Token ${OIL_PRICE_API_KEY}`
      }
    });

    if (response.status === 429) {
      console.warn(`Rate limit exceeded for ${code}. Using fallback data.`);
      return getFallbackData(code);
    }

    if (!response.ok) {
      console.warn(`API error ${response.status} for ${code}. Using fallback data.`);
      return getFallbackData(code);
    }

    const data = await response.json();
    console.log(`API response for ${code}:`, data);
    if (data && data.data && Array.isArray(data.data) && data.data.length >= 2) {
      const latest = data.data[0];
      const previous = data.data[1];
      console.log('Raw API price (latest):', latest.price, 'Raw API price (previous):', previous.price);
      const price = latest.price !== undefined ? parseFloat(latest.price).toFixed(2) : null;
      const prevPrice = previous.price !== undefined ? parseFloat(previous.price) : null;
      if (!isNaN(price) && !isNaN(prevPrice)) {
        const change = (parseFloat(price) - prevPrice).toFixed(2);
        const changePercent = ((parseFloat(price) - prevPrice) / prevPrice * 100).toFixed(2);
        let lastUpdated;
        if (latest.created_at && !isNaN(Date.parse(latest.created_at))) {
          lastUpdated = new Date(latest.created_at).toISOString();
        } else {
          lastUpdated = new Date().toISOString();
        }
        return {
          price,
          change,
          changePercent,
          lastUpdated,
          isPositive: parseFloat(change) >= 0
        };
      }
    }
    // Fallback to latest price only
    const fallback = await fetchFromOilPriceAPI(code);
    return {
      ...fallback,
      change: null,
      changePercent: null,
      lastUpdated: fallback && fallback.lastUpdated ? fallback.lastUpdated : new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching historical prices from OilPriceAPI:', error);
    const fallback = await fetchFromOilPriceAPI(code);
    return {
      ...fallback,
      change: null,
      changePercent: null,
      lastUpdated: fallback && fallback.lastUpdated ? fallback.lastUpdated : new Date().toISOString()
    };
  }
}

// Function to fetch latest price only
async function fetchFromOilPriceAPI(code) {
  try {
    const response = await fetch(`https://api.oilpriceapi.com/v1/prices/latest?by_code=${code}`, {
      headers: {
        Authorization: `Token ${OIL_PRICE_API_KEY}`
      }
    });

    if (response.status === 429) {
      console.warn(`Rate limit exceeded for ${code}. Using fallback data.`);
      return getFallbackData(code);
    }

    if (!response.ok) {
      console.warn(`API error ${response.status} for ${code}. Using fallback data.`);
      return getFallbackData(code);
    }

    const data = await response.json();
    console.log(`Latest API response for ${code}:`, data);
    if (data && data.data) {
      console.log('Raw API price (latest):', data.data.price);
      let lastUpdated;
      if (data.data.created_at && !isNaN(Date.parse(data.data.created_at))) {
        lastUpdated = new Date(data.data.created_at).toISOString();
      } else if (data.data.date && !isNaN(Date.parse(data.data.date))) {
        lastUpdated = new Date(data.data.date).toISOString();
      } else {
        lastUpdated = new Date().toISOString();
      }
      return {
        price: data.data.price !== undefined ? parseFloat(data.data.price).toFixed(2) : null,
        change: data.data.change ? parseFloat(data.data.change).toFixed(2) : null,
        changePercent: data.data.change_percent ? parseFloat(data.data.change_percent).toFixed(2) : null,
        lastUpdated,
        isPositive: data.data.change ? parseFloat(data.data.change) >= 0 : null
      };
    }
    throw new Error('No data');
  } catch (error) {
    console.error('Error fetching from OilPriceAPI:', error);
    return getFallbackData(code);
  }
}

// Function to fetch coal prices from OilPriceAPI
async function fetchCoalPrice() {
  try {
    const coal = await fetchWithChangeFromOilPriceAPI('COAL_USD');
    return {
      coal: {
        title: 'Coal',
        subtitle: 'API2 CIF ARA',
        ...coal
      }
    };
  } catch (error) {
    console.error('Error fetching coal price:', error);
    return null;
  }
}

// Fallback data when API is unavailable
function getFallbackData(code) {
  const now = new Date();
  const timeString = now.toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  const fallbackPrices = {
    'BRENT_CRUDE_USD': { price: '68.21', change: '0.55', changePercent: '0.81' },
    'WTI_USD': { price: '66.52', change: '1.07', changePercent: '1.63' },
    'DUBAI_CRUDE_USD': { price: '67.89', change: '0.32', changePercent: '0.47' },
    'COAL_USD': { price: '120.50', change: '-1.20', changePercent: '-0.99' } // fallback for coal
  };
  
  const data = fallbackPrices[code] || { price: '65.00', change: '0.00', changePercent: '0.00' };
  
  return {
    price: data.price,
    change: data.change,
    changePercent: data.changePercent,
    lastUpdated: timeString,
    isPositive: parseFloat(data.change) >= 0
  };
}

// Function to update oil prices cache
async function updateOilPriceCache() {
  if (oilPriceCache.isUpdating) {
    console.log('Oil price update already in progress, skipping...');
    return;
  }

  oilPriceCache.isUpdating = true;
  console.log('Updating oil price cache...');
  
  try {
    const prices = await fetchOilPrices();
    if (prices) {
      oilPriceCache.current = prices;
      oilPriceCache.previous = oilPriceCache.current;
      oilPriceCache.lastUpdated = new Date();
      console.log('Oil price cache updated successfully');
    }
  } catch (error) {
    console.error('Error updating oil price cache:', error);
  } finally {
    oilPriceCache.isUpdating = false;
  }
}

// Check if cache needs updating (hourly)
function shouldUpdateCache() {
  if (!oilPriceCache.lastUpdated) {
    console.log('No cache exists, will update...');
    return true;
  }
  
  const now = new Date();
  const lastUpdate = new Date(oilPriceCache.lastUpdated);
  const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);
  
  console.log(`Hours since last update: ${hoursSinceUpdate.toFixed(2)}`);
  
  if (hoursSinceUpdate >= 1) {
    console.log('Cache is older than 1 hour, will update...');
    return true;
  } else {
    console.log('Cache is still fresh, using cached data...');
    return false;
  }
}

// Function to update coal prices cache
async function updateCoalPriceCache() {
  if (coalPriceCache.isUpdating) {
    console.log('Coal price update already in progress, skipping...');
    return;
  }

  coalPriceCache.isUpdating = true;
  console.log('Updating coal price cache...');
  
  try {
    const prices = await fetchCoalPrice();
    if (prices) {
      coalPriceCache.current = prices;
      coalPriceCache.previous = coalPriceCache.current;
      coalPriceCache.lastUpdated = new Date();
      console.log('Coal price cache updated successfully');
    }
  } catch (error) {
    console.error('Error updating coal price cache:', error);
  } finally {
    coalPriceCache.isUpdating = false;
  }
}

// Check if coal cache needs updating (hourly)
function shouldUpdateCoalCache() {
  if (!coalPriceCache.lastUpdated) {
    console.log('No coal cache exists, will update...');
    return true;
  }
  
  const now = new Date();
  const lastUpdate = new Date(coalPriceCache.lastUpdated);
  const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);
  
  console.log(`Hours since last coal update: ${hoursSinceUpdate.toFixed(2)}`);
  
  if (hoursSinceUpdate >= 1) {
    console.log('Coal cache is older than 1 hour, will update...');
    return true;
  } else {
    console.log('Coal cache is still fresh, using cached data...');
    return false;
  }
}

// News endpoint
app.get('/api/news', async (req, res) => {
  const feedKey = req.query.feed;
  const feedUrl = FEEDS[feedKey];
  console.log(`News endpoint called for feed: ${feedKey}, URL: ${feedUrl}`);
  
  if (!feedUrl) {
    console.log('Invalid feed parameter:', feedKey);
    return res.status(400).json({ error: 'Invalid feed parameter' });
  }
  
  try {
    console.log('Parsing RSS feed...');
    const feed = await parser.parseURL(feedUrl);
    console.log(`Feed parsed successfully. Found ${feed.items.length} items.`);
    
    // Enhance items with image extraction
    const items = feed.items.map(item => {
      let image = null;
      // Try enclosure.url
      if (item.enclosure && item.enclosure.url) {
        image = item.enclosure.url;
      }
      // Try media:content
      if (!image && item['media:content'] && item['media:content'].url) {
        image = item['media:content'].url;
      }
      // Try media:thumbnail
      if (!image && item['media:thumbnail'] && item['media:thumbnail'].url) {
        image = item['media:thumbnail'].url;
      }
      // Try image field
      if (!image && item.image && item.image.url) {
        image = item.image.url;
      }
      // Try to extract from <img> in content or description
      if (!image && (item.content || item.description)) {
        const html = item.content || item.description;
        const match = html.match(/<img[^>]+src=["']([^"'>]+)["']/i);
        if (match && match[1]) {
          image = match[1];
        }
      }
      return { ...item, image };
    });
    
    console.log(`Processed ${items.length} items with images.`);
    res.json({ items });
  } catch (error) {
    console.error('Error parsing RSS feed:', error);
    res.status(500).json({ error: 'Failed to fetch or parse RSS feed' });
  }
});

// Oil prices endpoint with caching
app.get('/api/oil-prices', async (req, res) => {
  try {
    console.log('Oil prices endpoint called');
    
    // Check if we need to update the cache
    if (shouldUpdateCache()) {
      console.log('Updating cache...');
      await updateOilPriceCache();
    } else {
      console.log('Using existing cache...');
    }

    // Return cached data with both current and previous prices
    if (oilPriceCache.current) {
      const response = {
        current: oilPriceCache.current,
        previous: oilPriceCache.previous,
        lastUpdated: oilPriceCache.lastUpdated
      };
      console.log('Returning cached data');
      res.json(response);
    } else {
      // If no cache, fetch fresh data
      console.log('No cache exists, fetching fresh data...');
      const prices = await fetchOilPrices();
      if (prices) {
        oilPriceCache.current = prices;
        oilPriceCache.previous = prices;
        oilPriceCache.lastUpdated = new Date();
        const response = {
          current: prices,
          previous: prices,
          lastUpdated: oilPriceCache.lastUpdated
        };
        console.log('Returning fresh data');
        res.json(response);
      } else {
        console.log('Failed to fetch prices');
        res.status(500).json({ error: 'Failed to fetch oil prices' });
      }
    }
  } catch (error) {
    console.error('Error in oil prices endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch oil prices' });
  }
});

// Minerals prices endpoint with fallback data
app.get('/api/minerals-prices', async (req, res) => {
  try {
    console.log('Minerals prices endpoint called');
    
    // For now, return fallback data since we don't have a minerals price API
    const now = new Date();
    const timeString = now.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    const mineralsPrices = {
      copper: {
        title: 'Copper',
        subtitle: 'London Metal Exchange (LME)',
        price: '4.25',
        lastUpdated: timeString,
        change: '0.08',
        changePercent: '1.92',
        isPositive: true
      },
      gold: {
        title: 'Gold',
        subtitle: 'London Bullion Market (LBMA)',
        price: '2150.50',
        lastUpdated: timeString,
        change: '12.30',
        changePercent: '0.57',
        isPositive: true
      },
      silver: {
        title: 'Silver',
        subtitle: 'London Bullion Market (LBMA)',
        price: '24.80',
        lastUpdated: timeString,
        change: '-0.15',
        changePercent: '-0.60',
        isPositive: false
      },
      lithium: {
        title: 'Lithium',
        subtitle: 'Shanghai Metals Market',
        price: '15.20',
        lastUpdated: timeString,
        change: '0.45',
        changePercent: '3.05',
        isPositive: true
      },
      nickel: {
        title: 'Nickel',
        subtitle: 'London Metal Exchange (LME)',
        price: '18.50',
        lastUpdated: timeString,
        change: '-0.25',
        changePercent: '-1.33',
        isPositive: false
      },
      aluminum: {
        title: 'Aluminum',
        subtitle: 'London Metal Exchange (LME)',
        price: '2.45',
        lastUpdated: timeString,
        change: '0.03',
        changePercent: '1.24',
        isPositive: true
      }
    };
    
    console.log('Returning minerals prices data');
    res.json({ current: mineralsPrices });
  } catch (error) {
    console.error('Error in minerals prices endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch minerals prices' });
  }
});

// Coal prices endpoint with caching
app.get('/api/coal-prices', async (req, res) => {
  try {
    console.log('Coal prices endpoint called');
    
    // Check if we need to update the cache
    if (shouldUpdateCoalCache()) {
      console.log('Updating coal cache...');
      await updateCoalPriceCache();
    } else {
      console.log('Using existing coal cache...');
    }

    let response;
    if (coalPriceCache.current && coalPriceCache.current.coal) {
      // Extract the ISO date string from the latest API response
      let lastUpdate = coalPriceCache.current.coal.created_at || coalPriceCache.current.coal.lastUpdate || coalPriceCache.current.coal.lastUpdated || null;
      if (!lastUpdate) {
        lastUpdate = new Date().toISOString();
      }
      // Ensure price is a string with two decimals, or 'N/A' if missing
      let price = coalPriceCache.current.coal.price;
      if (price === undefined || price === null || isNaN(price)) {
        price = 'N/A';
      } else {
        price = parseFloat(price).toFixed(2);
      }
      response = {
        thermal: {
          price,
          change: coalPriceCache.current.coal.change ?? null,
          changePercent: coalPriceCache.current.coal.changePercent ?? null,
          lastUpdate,
          unit: 'USD/ton'
        },
        coking: null,
        anthracite: null
      };
    } else {
      // If no cache, fetch fresh data
      console.log('No coal cache exists, fetching fresh data...');
      const priceObj = await fetchCoalPrice();
      if (priceObj && priceObj.coal) {
        // Extract the ISO date string from the latest API response
        let lastUpdate = priceObj.coal.created_at || priceObj.coal.lastUpdate || priceObj.coal.lastUpdated || null;
        if (!lastUpdate) {
          lastUpdate = new Date().toISOString();
        }
        // Ensure price is a string with two decimals, or 'N/A' if missing
        let price = priceObj.coal.price;
        if (price === undefined || price === null || isNaN(price)) {
          price = 'N/A';
        } else {
          price = parseFloat(price).toFixed(2);
        }
        response = {
          thermal: {
            price,
            change: priceObj.coal.change ?? null,
            changePercent: priceObj.coal.changePercent ?? null,
            lastUpdate,
            unit: 'USD/ton'
          },
          coking: null,
          anthracite: null
        };
      } else {
        response = { thermal: null, coking: null, anthracite: null };
      }
    }
    console.log('Sending to frontend:', response);
    res.json(response);
  } catch (error) {
    console.error('Error in coal prices endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch coal price' });
  }
});



// MarineTraffic REST API Endpoints

// Get vessels within viewport
app.get('/api/vessels', async (req, res) => {
  try {
    const { minLat, maxLat, minLon, maxLon, vesselType } = req.query;
    
    if (!minLat || !maxLat || !minLon || !maxLon) {
      return res.status(400).json({ 
        error: 'Missing required parameters: minLat, maxLat, minLon, maxLon' 
      });
    }

    const bounds = {
      minLat: parseFloat(minLat),
      maxLat: parseFloat(maxLat),
      minLon: parseFloat(minLon),
      maxLon: parseFloat(maxLon)
    };

    console.log('Vessels endpoint called with bounds:', bounds);
    const vessels = await marineTrafficService.getVesselsInViewport(bounds, vesselType);
    
    res.json({
      success: true,
      data: vessels,
      bounds,
      vesselType: vesselType || 'all'
    });
  } catch (error) {
    console.error('Error in vessels endpoint:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch vessels data' 
    });
  }
});

// Get specific vessel details
app.get('/api/vessels/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { identifierType = 'imo' } = req.query;
    
    console.log(`Vessel details endpoint called for ${identifierType}: ${id}`);
    const vesselDetails = await marineTrafficService.getVesselDetails(id, identifierType);
    
    res.json({
      success: true,
      data: vesselDetails
    });
  } catch (error) {
    console.error('Error in vessel details endpoint:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch vessel details' 
    });
  }
});

// Search vessels
app.get('/api/vessels/search', async (req, res) => {
  try {
    const { query, searchType = 'name' } = req.query;
    
    if (!query) {
      return res.status(400).json({ 
        error: 'Missing required parameter: query' 
      });
    }

    console.log(`Vessel search endpoint called: ${searchType} = ${query}`);
    const searchResults = await marineTrafficService.searchVessels(query, searchType);
    
    res.json({
      success: true,
      data: searchResults,
      query,
      searchType
    });
  } catch (error) {
    console.error('Error in vessel search endpoint:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to search vessels' 
    });
  }
});

// Get vessel track/history
app.get('/api/vessels/:id/track', async (req, res) => {
  try {
    const { id } = req.params;
    const { timeSpan = 24 } = req.query;
    
    console.log(`Vessel track endpoint called for ${id}, timeSpan: ${timeSpan}`);
    const trackData = await marineTrafficService.getVesselTrack(id, parseInt(timeSpan));
    
    res.json({
      success: true,
      data: trackData,
      vesselId: id,
      timeSpan: parseInt(timeSpan)
    });
  } catch (error) {
    console.error('Error in vessel track endpoint:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch vessel track' 
    });
  }
});



// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        redis: redisClient.isReady,
        marineTraffic: await marineTrafficService.validateApiKey(),
        websocket: wsHandler.getConnectedClientsCount()
      },
      activeRooms: wsHandler.getActiveRoomsInfo()
    };
    
    res.json(health);
  } catch (error) {
    console.error('Error in health check:', error);
    res.status(500).json({ 
      status: 'unhealthy',
      error: error.message 
    });
  }
});

// Mapbox token endpoint
app.get('/api/mapbox-token', (req, res) => {
  console.log('Mapbox token endpoint called');
  console.log('MAPBOX_TOKEN from env:', MAPBOX_TOKEN ? 'SET' : 'NOT SET');
  
  if (MAPBOX_TOKEN) {
    console.log('Returning Mapbox token successfully');
    res.json({ token: MAPBOX_TOKEN });
  } else {
    console.error('MAPBOX_TOKEN not set in environment variables');
    res.status(500).json({ error: 'MAPBOX_TOKEN not set in environment variables' });
  }
});

// Initialize oil price cache on startup
updateOilPriceCache();
// Initialize coal price cache on startup
updateCoalPriceCache();

server.listen(port, () => {
  console.log(`News and oil prices backend listening at http://localhost:${port}`);
}); 