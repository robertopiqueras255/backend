// news-backend.js
// Simple Express backend to fetch and parse RSS feeds for news and cache oil prices

const express = require('express');
const cors = require('cors');
const Parser = require('rss-parser');

const app = express();
const port = 4000;
const parser = new Parser();

// Oil Price API Configuration
const OIL_PRICE_API_KEY = '50efc7a396586517babc8e62bc338e82bc3246f6fd9e92a1923a477ada10f02c';

// Oil price cache
let oilPriceCache = {
  data: null,
  lastUpdated: null,
  isUpdating: false
};

const FEEDS = {
  energy: 'https://rss.app/feeds/_iP3HVWTdd0BxHjSn.xml', // rss.app energy feed
  commodities: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', // fallback example
  bloomberg: 'https://www.bloomberg.com/feed/podcast/energy.xml',
};

app.use(cors());

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
    if (data && data.data && Array.isArray(data.data) && data.data.length >= 2) {
      const latest = data.data[0];
      const previous = data.data[1];
      const price = parseFloat(latest.price).toFixed(2);
      const prevPrice = parseFloat(previous.price);
      if (!isNaN(price) && !isNaN(prevPrice)) {
        const change = (price - prevPrice).toFixed(2);
        const changePercent = ((price - prevPrice) / prevPrice * 100).toFixed(2);
        return {
          price,
          change,
          changePercent,
          lastUpdated: latest.created_at ? new Date(latest.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : null,
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
      lastUpdated: fallback && fallback.lastUpdated ? fallback.lastUpdated : null
    };
  } catch (error) {
    console.error('Error fetching historical prices from OilPriceAPI:', error);
    const fallback = await fetchFromOilPriceAPI(code);
    return {
      ...fallback,
      change: null,
      changePercent: null,
      lastUpdated: fallback && fallback.lastUpdated ? fallback.lastUpdated : null
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
    if (data && data.data) {
      return {
        price: parseFloat(data.data.price).toFixed(2),
        change: parseFloat(data.data.change).toFixed(2),
        changePercent: parseFloat(data.data.change_percent).toFixed(2),
        lastUpdated: new Date(data.data.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        isPositive: parseFloat(data.data.change) >= 0
      };
    }
    throw new Error('No data');
  } catch (error) {
    console.error('Error fetching from OilPriceAPI:', error);
    return getFallbackData(code);
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
    'DUBAI_CRUDE_USD': { price: '67.89', change: '0.32', changePercent: '0.47' }
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
      oilPriceCache.data = prices;
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
  if (!oilPriceCache.lastUpdated) return true;
  
  const now = new Date();
  const lastUpdate = new Date(oilPriceCache.lastUpdated);
  const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);
  
  return hoursSinceUpdate >= 1; // Update every hour
}

// News endpoint
app.get('/api/news', async (req, res) => {
  const feedKey = req.query.feed;
  const feedUrl = FEEDS[feedKey];
  if (!feedUrl) {
    return res.status(400).json({ error: 'Invalid feed parameter' });
  }
  try {
    const feed = await parser.parseURL(feedUrl);
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
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch or parse RSS feed' });
  }
});

// Oil prices endpoint with caching
app.get('/api/oil-prices', async (req, res) => {
  try {
    // Check if we need to update the cache
    if (shouldUpdateCache()) {
      await updateOilPriceCache();
    }

    // Return cached data
    if (oilPriceCache.data) {
      res.json(oilPriceCache.data);
    } else {
      // If no cache, fetch fresh data
      const prices = await fetchOilPrices();
      if (prices) {
        oilPriceCache.data = prices;
        oilPriceCache.lastUpdated = new Date();
        res.json(prices);
      } else {
        res.status(500).json({ error: 'Failed to fetch oil prices' });
      }
    }
  } catch (error) {
    console.error('Error in oil prices endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch oil prices' });
  }
});

// Initialize oil price cache on startup
updateOilPriceCache();

app.listen(port, () => {
  console.log(`News and oil prices backend listening at http://localhost:${port}`);
}); 