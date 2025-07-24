# Enhanced Backend with MarineTraffic API Integration

This backend provides comprehensive marine traffic data integration with real-time updates, caching, and WebSocket support.

## Features

- **MarineTraffic API Integration**: Real-time vessel positions and details
- **Redis Caching**: Server-side caching for improved performance
- **Socket.IO WebSocket**: Real-time data streaming to frontend clients
- **RESTful API**: Complete REST endpoints for vessel and port data
- **Oil & Coal Price APIs**: Existing commodity price functionality
- **News RSS Feeds**: RSS feed parsing and serving

## Prerequisites

- Node.js (v14 or higher)
- Redis server
- MarineTraffic API key

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file in the root directory:
   ```env
   # MarineTraffic API Configuration
   MARINETRAFFIC_API_KEY=your_marinetraffic_api_key_here

   # Redis Configuration
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=

   # Server Configuration
   PORT=4000
   NODE_ENV=development
   ```

3. **Start Redis server:**
   ```bash
   # On Windows (if using WSL or Docker)
   redis-server

   # On macOS (if installed via Homebrew)
   brew services start redis

   # On Linux
   sudo systemctl start redis
   ```

4. **Start the backend:**
   ```bash
   npm start
   ```

## API Endpoints

### MarineTraffic Endpoints

#### Vessels
- `GET /api/vessels` - Get vessels within viewport
  - Query params: `minLat`, `maxLat`, `minLon`, `maxLon`, `vesselType` (optional)
  
- `GET /api/vessels/:id` - Get specific vessel details
  - Query params: `identifierType` (imo, mmsi, name)
  
- `GET /api/vessels/search` - Search vessels
  - Query params: `query`, `searchType` (name, imo, mmsi)
  
- `GET /api/vessels/:id/track` - Get vessel track/history
  - Query params: `timeSpan` (hours, default: 24)

#### Ports
- `GET /api/ports` - Get port information
  - Query params: `portId` or `portName`
  
- `GET /api/ports/:id` - Get specific port details

#### Health Check
- `GET /api/health` - System health status

### Existing Endpoints

#### Commodity Prices
- `GET /api/oil-prices` - Oil prices with caching
- `GET /api/coal-prices` - Coal prices with caching
- `GET /api/minerals-prices` - Minerals prices

#### News
- `GET /api/news?feed=<feedKey>` - RSS feed news

## WebSocket Events

### Client to Server
- `join-area` - Join a geographic area for real-time updates
- `leave-area` - Leave a geographic area
- `get-vessel-details` - Request specific vessel details
- `search-vessels` - Search for vessels
- `get-port-info` - Get port information
- `get-vessel-track` - Get vessel track/history

### Server to Client
- `vessel-update` - Real-time vessel position updates
- `vessel-details` - Vessel details response
- `vessel-search-results` - Vessel search results
- `port-info` - Port information response
- `vessel-track` - Vessel track data

## WebSocket Usage Example

```javascript
// Connect to WebSocket
const socket = io('http://localhost:4000');

// Join an area for real-time updates
socket.emit('join-area', {
  bounds: {
    minLat: 40.0,
    maxLat: 42.0,
    minLon: -74.0,
    maxLon: -72.0
  },
  vesselType: 'cargo' // optional
});

// Listen for vessel updates
socket.on('vessel-update', (data) => {
  console.log('Vessel update:', data);
});

// Request vessel details
socket.emit('get-vessel-details', {
  identifier: '123456789',
  identifierType: 'imo'
});

// Listen for vessel details response
socket.on('vessel-details', (data) => {
  console.log('Vessel details:', data);
});
```

## Caching

The system uses Redis for caching with the following TTL values:

- **Vessel Positions**: 5 minutes
- **Vessel Details**: 1 hour
- **Port Information**: 30 minutes
- **Vessel Tracks**: 1 hour
- **Vessel Search**: 30 minutes

## Error Handling

All endpoints include comprehensive error handling:

- **400 Bad Request**: Missing or invalid parameters
- **500 Internal Server Error**: API or service errors
- **WebSocket Errors**: Emitted with error details

## Logging

The backend provides detailed logging for:

- API requests and responses
- Cache hits and misses
- WebSocket connections and events
- Error conditions

## Development

### File Structure
```
backend/
├── news-backend.js          # Main server file
├── redisClient.js           # Redis configuration and utilities
├── marineTrafficService.js  # MarineTraffic API service
├── websocketHandler.js      # WebSocket/Socket.IO handler
├── package.json             # Dependencies
├── .env                     # Environment variables
└── README.md               # This file
```

### Adding New Features

1. **New API Endpoints**: Add to `news-backend.js`
2. **New Services**: Create separate service files
3. **New WebSocket Events**: Add to `websocketHandler.js`
4. **New Cache Keys**: Use consistent naming in `redisClient.js`

## Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   - Ensure Redis server is running
   - Check Redis host/port in `.env`

2. **MarineTraffic API Errors**
   - Verify API key in `.env`
   - Check API key validity with `/api/health`

3. **WebSocket Connection Issues**
   - Ensure Socket.IO client is properly configured
   - Check CORS settings if connecting from different domain

### Debug Mode

Enable detailed logging by setting:
```env
NODE_ENV=development
```

## License

This project is for internal use only. 