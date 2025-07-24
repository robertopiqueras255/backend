// websocketHandler.js
// WebSocket handler for real-time vessel updates using Socket.IO

const { Server } = require('socket.io');
const marineTrafficService = require('./marineTrafficService');

class WebSocketHandler {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.activeRooms = new Map();
    this.updateIntervals = new Map();
    
    this.setupEventHandlers();
    console.log('✅ WebSocket server initialized');
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);

      // Join a specific area/region room
      socket.on('join-area', (areaData) => {
        const { bounds, vesselType } = areaData;
        const roomId = this.generateRoomId(bounds, vesselType);
        
        socket.join(roomId);
        this.activeRooms.set(roomId, { bounds, vesselType, clients: new Set() });
        this.activeRooms.get(roomId).clients.add(socket.id);
        
        console.log(`📍 Client ${socket.id} joined area room: ${roomId}`);
        
        // Send initial data
        this.sendVesselDataToRoom(roomId, bounds, vesselType);
        
        // Start periodic updates if not already running
        this.startPeriodicUpdates(roomId, bounds, vesselType);
      });

      // Leave area room
      socket.on('leave-area', (areaData) => {
        const { bounds, vesselType } = areaData;
        const roomId = this.generateRoomId(bounds, vesselType);
        
        socket.leave(roomId);
        const room = this.activeRooms.get(roomId);
        if (room) {
          room.clients.delete(socket.id);
          if (room.clients.size === 0) {
            this.stopPeriodicUpdates(roomId);
            this.activeRooms.delete(roomId);
          }
        }
        
        console.log(`📍 Client ${socket.id} left area room: ${roomId}`);
      });

      // Request specific vessel details
      socket.on('get-vessel-details', async (data) => {
        try {
          const { identifier, identifierType = 'imo' } = data;
          const vesselDetails = await marineTrafficService.getVesselDetails(identifier, identifierType);
          
          socket.emit('vessel-details', {
            success: true,
            data: vesselDetails
          });
        } catch (error) {
          socket.emit('vessel-details', {
            success: false,
            error: error.message
          });
        }
      });

      // Search vessels
      socket.on('search-vessels', async (data) => {
        try {
          const { query, searchType = 'name' } = data;
          const searchResults = await marineTrafficService.searchVessels(query, searchType);
          
          socket.emit('vessel-search-results', {
            success: true,
            data: searchResults
          });
        } catch (error) {
          socket.emit('vessel-search-results', {
            success: false,
            error: error.message
          });
        }
      });

      // Get port information
      socket.on('get-port-info', async (data) => {
        try {
          const { portId, portName } = data;
          const portInfo = await marineTrafficService.getPortInfo(portId, portName);
          
          socket.emit('port-info', {
            success: true,
            data: portInfo
          });
        } catch (error) {
          socket.emit('port-info', {
            success: false,
            error: error.message
          });
        }
      });

      // Get vessel track
      socket.on('get-vessel-track', async (data) => {
        try {
          const { vesselId, timeSpan = 24 } = data;
          const trackData = await marineTrafficService.getVesselTrack(vesselId, timeSpan);
          
          socket.emit('vessel-track', {
            success: true,
            data: trackData
          });
        } catch (error) {
          socket.emit('vessel-track', {
            success: false,
            error: error.message
          });
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
        
        // Remove client from all rooms
        this.activeRooms.forEach((room, roomId) => {
          if (room.clients.has(socket.id)) {
            room.clients.delete(socket.id);
            if (room.clients.size === 0) {
              this.stopPeriodicUpdates(roomId);
              this.activeRooms.delete(roomId);
            }
          }
        });
      });
    });
  }

  // Generate unique room ID based on bounds and vessel type
  generateRoomId(bounds, vesselType = 'all') {
    const boundsStr = JSON.stringify(bounds);
    return `area:${vesselType}:${this.hashCode(boundsStr)}`;
  }

  // Simple hash function for generating room IDs
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Send vessel data to a specific room
  async sendVesselDataToRoom(roomId, bounds, vesselType) {
    try {
      console.log(`🌊 Fetching vessels for room: ${roomId}`);
      const vessels = await marineTrafficService.getVesselsInViewport(bounds, vesselType);
      
      this.io.to(roomId).emit('vessel-update', {
        success: true,
        timestamp: new Date().toISOString(),
        data: vessels
      });
      
      console.log(`📡 Sent vessel update to room: ${roomId} (${vessels?.length || 0} vessels)`);
    } catch (error) {
      console.error(`❌ Error sending vessel data to room ${roomId}:`, error);
      
      this.io.to(roomId).emit('vessel-update', {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Start periodic updates for a room
  startPeriodicUpdates(roomId, bounds, vesselType) {
    // Don't start if already running
    if (this.updateIntervals.has(roomId)) {
      return;
    }

    const interval = setInterval(async () => {
      await this.sendVesselDataToRoom(roomId, bounds, vesselType);
    }, 30000); // Update every 30 seconds

    this.updateIntervals.set(roomId, interval);
    console.log(`🔄 Started periodic updates for room: ${roomId}`);
  }

  // Stop periodic updates for a room
  stopPeriodicUpdates(roomId) {
    const interval = this.updateIntervals.get(roomId);
    if (interval) {
      clearInterval(interval);
      this.updateIntervals.delete(roomId);
      console.log(`🛑 Stopped periodic updates for room: ${roomId}`);
    }
  }

  // Broadcast to all connected clients
  broadcastToAll(event, data) {
    this.io.emit(event, data);
  }

  // Get active rooms info
  getActiveRoomsInfo() {
    const info = {};
    this.activeRooms.forEach((room, roomId) => {
      info[roomId] = {
        bounds: room.bounds,
        vesselType: room.vesselType,
        clientCount: room.clients.size
      };
    });
    return info;
  }

  // Get connected clients count
  getConnectedClientsCount() {
    return this.io.engine.clientsCount;
  }
}

module.exports = WebSocketHandler; 