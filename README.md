# Enhanced Backend with MarineTraffic API Integration

A comprehensive backend providing real-time marine traffic data, commodity prices, news feeds, and 3D map support with WebSocket streaming and Redis caching.

## 🚀 Core Functionality

### **Commodity Prices**
- **Oil Prices** (`/api/oil-prices`): Real-time Brent, WTI, and Dubai crude prices with hourly caching
- **Coal Prices** (`/api/coal-prices`): Thermal coal prices via OilPriceAPI with proper formatting
- **Minerals Prices** (`/api/minerals-prices`): Copper, gold, silver, lithium, nickel, aluminum with fallback data

### **News RSS Feeds**
- **Multiple Sources** (`/api/news?feed=<type>`): Energy, commodities, Bloomberg, minerals & metals
- **Image Extraction**: Automatic image parsing from feed content and enclosures
- **Enhanced Content**: Processed items with extracted images and metadata

### **MarineTraffic API Integration**
- **Real-time Vessel Tracking**: Live vessel positions and movements
- **Vessel Details**: Name, IMO, MMSI, type, flag, dimensions, status, speed, course
- **Port Information**: Port details, congestion, vessels in/approaching
- **Historical Tracks**: Vessel movement history and route data
- **Search Functionality**: Find vessels by name, IMO, or MMSI

### **WebSocket Real-time Updates**
- **Live Vessel Data**: 30-second updates for vessel positions
- **Room-based Broadcasting**: Geographic area-specific updates
- **Event-driven Architecture**: Real-time vessel details, search, and port info
- **Automatic Cleanup**: Efficient resource management

### **3D Map Support**
- **Mapbox Integration**: Secure token provision via `/api/mapbox-token`
- **3D Globe Display**: Frontend receives token securely from backend
- **No Frontend Secrets**: All API keys and tokens managed server-side

## 📊 API Endpoints

### **Commodity Prices**
```
GET /api/oil-prices          # Oil prices with caching
GET /api/coal-prices         # Coal prices with caching  
GET /api/minerals-prices     # Minerals prices
```

### **News & Content**
```
GET /api/news?feed=<type>    # RSS feeds (energy, commodities, etc.)
```

### **MarineTraffic**
```
GET /api/vessels             # Vessels in viewport
GET /api/vessels/:id         # Specific vessel details
GET /api/vessels/search      # Vessel search
GET /api/vessels/:id/track   # Vessel track history
GET /api/ports               # Port information
GET /api/ports/:id           # Specific port details
```

### **System**
```
GET /api/health              # System health status
GET /api/mapbox-token        # Secure Mapbox token
```

## 🔧 Technical Architecture

### **Caching Strategy**
- **Redis Caching**: Server-side caching with configurable TTL
- **Smart Invalidation**: Automatic cache refresh based on data type
- **Performance**: Reduced API calls and improved response times

### **Security**
- **Environment Variables**: All API keys and tokens secured
- **No Frontend Secrets**: Backend manages all external services
- **Secure Token Provision**: Mapbox token provided via API

### **Real-time Features**
- **Socket.IO WebSocket**: Live data streaming
- **Room Management**: Geographic area-based updates
- **Event Broadcasting**: Efficient real-time communication

## 🛠️ Setup

### **Prerequisites**
- Node.js (v14+)
- Redis server
- MarineTraffic API key

### **Installation**
```bash
npm install
```

### **Environment Variables**
```env
MARINETRAFFIC_API_KEY=your_api_key
MAPBOX_TOKEN=your_mapbox_token
REDIS_HOST=localhost
REDIS_PORT=6379
PORT=4000
NODE_ENV=development
```

### **Start Server**
```bash
npm start
```

## 🌐 WebSocket Events

### **Client → Server**
- `join-area` - Join geographic area for updates
- `leave-area` - Leave geographic area
- `get-vessel-details` - Request vessel details
- `search-vessels` - Search for vessels
- `get-port-info` - Get port information
- `get-vessel-track` - Get vessel track history

### **Server → Client**
- `vessel-update` - Real-time vessel position updates
- `vessel-details` - Vessel details response
- `vessel-search-results` - Vessel search results
- `port-info` - Port information response
- `vessel-track` - Vessel track data

## 📁 File Structure
```
backend/
├── news-backend.js          # Main server with all endpoints
├── redisClient.js           # Redis caching utilities
├── marineTrafficService.js  # MarineTraffic API service
├── websocketHandler.js      # WebSocket/Socket.IO handler
├── package.json             # Dependencies
├── .env                     # Environment variables
├── README.md               # This documentation
└── VERSION_LOG.md          # Version history
```

## 🎯 Key Features

✅ **Real-time vessel tracking** with live position updates  
✅ **Commodity price monitoring** (oil, coal, minerals)  
✅ **News RSS feeds** with image extraction  
✅ **3D map integration** with secure token management  
✅ **Redis caching** for improved performance  
✅ **WebSocket streaming** for live data  
✅ **Comprehensive error handling** and logging  
✅ **Health monitoring** and system status  
✅ **Modular architecture** for scalability  

## 🔮 Usage Examples

### **Frontend Integration**
```javascript
// Connect to WebSocket
const socket = io('http://localhost:4000');

// Join area for real-time updates
socket.emit('join-area', {
  bounds: { minLat: 40, maxLat: 42, minLon: -74, maxLon: -72 }
});

// Listen for vessel updates
socket.on('vessel-update', (data) => {
  console.log('Vessel update:', data);
});

// Get Mapbox token securely
fetch('/api/mapbox-token')
  .then(res => res.json())
  .then(data => {
    // Initialize 3D map with token
    initializeMap(data.token);
  });
```

### **REST API Usage**
```bash
# Get oil prices
curl http://localhost:4000/api/oil-prices

# Get vessels in area
curl "http://localhost:4000/api/vessels?minLat=40&maxLat=42&minLon=-74&maxLon=-72"

# Search vessels
curl "http://localhost:4000/api/vessels/search?query=MAERSK&searchType=name"
```

## 📈 Performance

- **Caching TTL**: 5min (vessels) to 1hr (details)
- **Update Frequency**: 30 seconds for real-time data
- **Response Time**: <100ms for cached data
- **Scalability**: Room-based WebSocket broadcasting

## 🔒 Security

- All API keys stored server-side
- Environment variable configuration
- No sensitive data exposed to frontend
- Secure token provision for maps

---

**Last Updated:** July 24, 2025  
**Version:** 2.0.0 - MarineTraffic API Integration 