// marineTrafficService.js
// MarineTraffic API integration service

const axios = require('axios');
const { cacheUtils } = require('./redisClient');
require('dotenv').config();

// MarineTraffic API configuration
const MARINETRAFFIC_API_KEY = process.env.MARINETRAFFIC_API_KEY;
const MARINETRAFFIC_BASE_URL = 'https://services.marinetraffic.com/api';

// API endpoints
const ENDPOINTS = {
  VESSEL_POSITIONS: '/exportvessels',
  VESSEL_DETAILS: '/vesselmasterdata',
  PORT_INFO: '/portinfo',
  VESSEL_TRACK: '/shiptrack',
  VESSEL_SEARCH: '/vesselsearch'
};

// Cache TTL values (in seconds)
const CACHE_TTL = {
  VESSEL_POSITIONS: 300,    // 5 minutes
  VESSEL_DETAILS: 3600,     // 1 hour
  PORT_INFO: 1800,          // 30 minutes
  VESSEL_TRACK: 3600,       // 1 hour
  VESSEL_SEARCH: 1800       // 30 minutes
};

// MarineTraffic API service class
class MarineTrafficService {
  constructor() {
    if (!MARINETRAFFIC_API_KEY) {
      console.warn('⚠️  MARINETRAFFIC_API_KEY not found in environment variables');
    }
  }

  // Make API request with error handling
  async makeRequest(endpoint, params = {}) {
    try {
      const url = `${MARINETRAFFIC_BASE_URL}${endpoint}`;
      const queryParams = {
        ...params,
        apikey: MARINETRAFFIC_API_KEY
      };

      console.log(`🌊 Making MarineTraffic API request: ${endpoint}`);
      const response = await axios.get(url, { params: queryParams });
      
      if (response.status === 200) {
        console.log(`✅ MarineTraffic API response received for ${endpoint}`);
        return response.data;
      } else {
        throw new Error(`API request failed with status ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ MarineTraffic API error for ${endpoint}:`, error.message);
      throw error;
    }
  }

  // Get vessels within viewport
  async getVesselsInViewport(bounds, vesselType = null) {
    const cacheKey = `vessels:viewport:${JSON.stringify(bounds)}:${vesselType || 'all'}`;
    
    // Try to get from cache first
    const cached = await cacheUtils.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = {
        MINLAT: bounds.minLat,
        MAXLAT: bounds.maxLat,
        MINLON: bounds.minLon,
        MAXLON: bounds.maxLon,
        format: 'json'
      };

      if (vesselType) {
        params.shiptype = vesselType;
      }

      const data = await this.makeRequest(ENDPOINTS.VESSEL_POSITIONS, params);
      
      // Cache the result
      await cacheUtils.set(cacheKey, data, CACHE_TTL.VESSEL_POSITIONS);
      
      return data;
    } catch (error) {
      console.error('Error fetching vessels in viewport:', error);
      throw error;
    }
  }

  // Get vessel details by IMO, MMSI, or name
  async getVesselDetails(identifier, identifierType = 'imo') {
    const cacheKey = `vessel:${identifierType}:${identifier}`;
    
    // Try to get from cache first
    const cached = await cacheUtils.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = {
        format: 'json'
      };

      // Set the appropriate parameter based on identifier type
      switch (identifierType.toLowerCase()) {
        case 'imo':
          params.imo = identifier;
          break;
        case 'mmsi':
          params.mmsi = identifier;
          break;
        case 'name':
          params.vesselname = identifier;
          break;
        default:
          throw new Error(`Invalid identifier type: ${identifierType}`);
      }

      const data = await this.makeRequest(ENDPOINTS.VESSEL_DETAILS, params);
      
      // Cache the result
      await cacheUtils.set(cacheKey, data, CACHE_TTL.VESSEL_DETAILS);
      
      return data;
    } catch (error) {
      console.error('Error fetching vessel details:', error);
      throw error;
    }
  }

  // Search vessels by name, IMO, or MMSI
  async searchVessels(query, searchType = 'name') {
    const cacheKey = `vessel:search:${searchType}:${query}`;
    
    // Try to get from cache first
    const cached = await cacheUtils.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = {
        format: 'json'
      };

      // Set the appropriate parameter based on search type
      switch (searchType.toLowerCase()) {
        case 'name':
          params.vesselname = query;
          break;
        case 'imo':
          params.imo = query;
          break;
        case 'mmsi':
          params.mmsi = query;
          break;
        default:
          throw new Error(`Invalid search type: ${searchType}`);
      }

      const data = await this.makeRequest(ENDPOINTS.VESSEL_SEARCH, params);
      
      // Cache the result
      await cacheUtils.set(cacheKey, data, CACHE_TTL.VESSEL_SEARCH);
      
      return data;
    } catch (error) {
      console.error('Error searching vessels:', error);
      throw error;
    }
  }

  // Get port information
  async getPortInfo(portId = null, portName = null) {
    const cacheKey = `port:${portId || portName}`;
    
    // Try to get from cache first
    const cached = await cacheUtils.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = {
        format: 'json'
      };

      if (portId) {
        params.portid = portId;
      } else if (portName) {
        params.portname = portName;
      } else {
        throw new Error('Either portId or portName must be provided');
      }

      const data = await this.makeRequest(ENDPOINTS.PORT_INFO, params);
      
      // Cache the result
      await cacheUtils.set(cacheKey, data, CACHE_TTL.PORT_INFO);
      
      return data;
    } catch (error) {
      console.error('Error fetching port info:', error);
      throw error;
    }
  }

  // Get vessel track/history
  async getVesselTrack(vesselId, timeSpan = 24) {
    const cacheKey = `vessel:track:${vesselId}:${timeSpan}`;
    
    // Try to get from cache first
    const cached = await cacheUtils.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = {
        mmsi: vesselId,
        timespan: timeSpan,
        format: 'json'
      };

      const data = await this.makeRequest(ENDPOINTS.VESSEL_TRACK, params);
      
      // Cache the result
      await cacheUtils.set(cacheKey, data, CACHE_TTL.VESSEL_TRACK);
      
      return data;
    } catch (error) {
      console.error('Error fetching vessel track:', error);
      throw error;
    }
  }

  // Get all vessels in a specific area (for real-time updates)
  async getAllVesselsInArea(bounds) {
    try {
      const vessels = await this.getVesselsInViewport(bounds);
      return vessels;
    } catch (error) {
      console.error('Error fetching all vessels in area:', error);
      throw error;
    }
  }

  // Validate API key
  async validateApiKey() {
    try {
      const testParams = {
        MINLAT: 0,
        MAXLAT: 1,
        MINLON: 0,
        MAXLON: 1,
        format: 'json'
      };
      
      await this.makeRequest(ENDPOINTS.VESSEL_POSITIONS, testParams);
      console.log('✅ MarineTraffic API key is valid');
      return true;
    } catch (error) {
      console.error('❌ MarineTraffic API key validation failed:', error.message);
      return false;
    }
  }
}

module.exports = new MarineTrafficService(); 