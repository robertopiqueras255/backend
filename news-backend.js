// news-backend.js
// Simple Express backend to fetch and parse RSS feeds for news

const express = require('express');
const cors = require('cors');
const Parser = require('rss-parser');

const app = express();
const port = 4000;
const parser = new Parser();

const FEEDS = {
  energy: 'https://rss.app/feeds/_iP3HVWTdd0BxHjSn.xml', // rss.app energy feed
  commodities: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', // fallback example
  bloomberg: 'https://www.bloomberg.com/feed/podcast/energy.xml',
};

app.use(cors());

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

app.listen(port, () => {
  console.log(`News backend listening at http://localhost:${port}`);
}); 