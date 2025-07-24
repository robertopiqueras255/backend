# Vessel Tracker Backend Module

This document outlines the implementation details, API endpoints, and configuration for the Vessel Tracker backend module, integrated within the main Express.js application (e.g., `news-backend.js`).

## Table of Contents

1.  [Overview](#1-overview)
2.  [Environment Variables](#2-environment-variables)
3.  [Dependencies](#3-dependencies)
4.  [API Endpoints](#4-api-endpoints)
    * [Get Vessels in Viewport](#get-vessels-in-viewport)
    * [Get Specific Vessel Details](#get-specific-vessel-details)
    * [Search Vessels](#search-vessels)
    * [Get Port Information](#get-port-information)
    * [Get Specific Port Details](#get-specific-port-details)
    * [Get Vessel Historical Track (Optional)](#get-vessel-historical-track-optional)
5.  [Real-time Data (WebSockets)](#5-real-time-data-websockets)
6.  [Caching](#6-caching)
7.  [Error Handling and Logging](#7-error-handling-and-logging)
8.  [Setup and Running](#8-setup-and-running)
9.  [Future Enhancements](#9-future-enhancements)

---

## 1. Overview

The *Vessel Tracker* backend module is responsible for fetching real-time and historical vessel/port data from the MarineTraffic API, processing it, and serving it to the frontend via both RESTful API endpoints and WebSocket for real-time updates. It integrates directly into the existing backend architecture to ensure consistency and secure API key management.

## 2. Environment Variables

The following environment variables **must be configured** in your `.env` file for the Vessel Tracker module to function correctly. These variables are accessed server-side and are **never exposed to the client.**

| Variable Name             | Description                                                                                             | Example Value                  |
| :------------------------ | :------------------------------------------------------------------------------------------------------ | :----------------------------- |
| `MARINETRAFFIC_API_KEY`   | Your API key for accessing the MarineTraffic API.                                                       | `your_marinetraffic_api_key`   |
| `REDIS_HOST`              | The hostname or IP address of your Redis instance.                                                      | `localhost` or `127.0.0.1`     |
| `REDIS_PORT`              | The port number on which your Redis instance is running.                                                | `6379`                         |
| `REDIS_PASSWORD`          | (Optional) Password for your Redis instance, if authentication is required.                             | `your_redis_password`          |
| `VESSEL_TRACKER_UPDATE_INTERVAL_MS` | (Optional) Interval in milliseconds for fetching real-time vessel updates for WebSockets. Default: `5000` (5 seconds). | `5000`                         |

**Example `.env` entry:**

```dotenv
MARINETRAFFIC_API_KEY=your_actual_marinetraffic_api_key_here
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
# REDIS_PASSWORD=your_redis_password # Uncomment if Redis requires a password
3. Dependencies
The following npm packages are required for the Vessel Tracker backend:

axios: For making HTTP requests to the MarineTraffic API.

redis: For interacting with the Redis caching server.

socket.io: For establishing and managing WebSocket connections for real-time data.

dotenv: (If not already present) For loading environment variables from a .env file.

You can install them using:

Bash

npm install axios redis socket.io
# If not already installed:
# npm install dotenv
4. API Endpoints
All Vessel Tracker API endpoints are prefixed with /api.

Get Vessels in Viewport
GET /api/vessels

Retrieves a list of vessels within a specified geographic bounding box.

Query Parameters:

minLat: (Required, float) Minimum latitude of the bounding box.

minLon: (Required, float) Minimum longitude of the bounding box.

maxLat: (Required, float) Maximum latitude of the bounding box.

maxLon: (Required, float) Maximum longitude of the bounding box.

type: (Optional, string) Filter by vessel type (e.g., tanker, cargo, passenger).

status: (Optional, string) Filter by vessel status (e.g., underway, anchored, moored).

flag: (Optional, string) Filter by vessel flag country (ISO 2-letter code).

limit: (Optional, integer) Maximum number of vessels to return. Default: 100.

Example Request:

GET /api/vessels?minLat=34&minLon=-77&maxLat=40&maxLon=-70&type=tanker
Example Response (200 OK):

JSON

[
  {
    "imo": 9235061,
    "mmsi": 218706000,
    "name": "OCEAN GLORY",
    "type": "Tanker",
    "flag": "MLT",
    "latitude": 38.2345,
    "longitude": -74.5678,
    "speed": 12.5,
    "course": 210,
    "status": "Underway",
    "destination": "ROTTERDAM",
    "eta": "2025-08-10T14:00:00Z",
    "lastReported": "2025-07-24T21:30:00Z"
  },
  // ... more vessel objects
]
Get Specific Vessel Details
GET /api/vessels/:id

Retrieves detailed information for a specific vessel. The :id can be either an IMO number or an MMSI. The backend should handle the logic to determine which identifier is used.

Path Parameters:

id: (Required, integer/string) IMO number or MMSI of the vessel.

Example Request:

GET /api/vessels/9235061
Example Response (200 OK):

JSON

{
  "imo": 9235061,
  "mmsi": 218706000,
  "name": "OCEAN GLORY",
  "type": "Tanker",
  "flag": "MLT",
  "dimensions": {
    "length": 250,
    "breadth": 40,
    "draught": 15
  },
  "currentStatus": "Underway",
  "speed": 12.5,
  "course": 210,
  "destination": "ROTTERDAM",
  "eta": "2025-08-10T14:00:00Z",
  "lastReportedPosition": {
    "latitude": 38.2345,
    "longitude": -74.5678
  },
  "lastReportedTime": "2025-07-24T21:30:00Z"
}
Search Vessels
GET /api/vessels/search

Searches for vessels based on a query string, typically matching vessel name, IMO, or MMSI.

Query Parameters:

q: (Required, string) Search query (e.g., vessel name, part of IMO/MMSI).

limit: (Optional, integer) Maximum number of results. Default: 10.

Example Request:

GET /api/vessels/search?q=ocean
Example Response (200 OK):
(Similar to GET /api/vessels but with a limit based on search results)

Get Port Information
GET /api/ports

Retrieves a list of ports, potentially filtered by geographic area or name.

Query Parameters:

minLat, minLon, maxLat, maxLon: (Optional, float) Bounding box for ports.

name: (Optional, string) Search by port name.

limit: (Optional, integer) Maximum number of ports to return. Default: 50.

Example Request:

GET /api/ports?name=Rotterdam
Example Response (200 OK):

JSON

[
  {
    "id": 1234,
    "name": "Port of Rotterdam",
    "location": {
      "latitude": 51.9225,
      "longitude": 4.47917
    },
    "type": "Major Commercial Port",
    "congestionStatus": "Moderate",
    "vesselsInPort": 25,
    "vesselsApproaching": 10
  },
  // ... more port objects
]
Get Specific Port Details
GET /api/ports/:id

Retrieves detailed information for a specific port.

Path Parameters:

id: (Required, integer/string) ID of the port.

Example Request:

GET /api/ports/1234
Example Response (200 OK):
(Similar to an individual object from GET /api/ports but potentially with more details if MarineTraffic provides them.)

Get Vessel Historical Track (Optional)
GET /api/vessels/:id/track

Retrieves the historical track for a specific vessel over a defined period.

Path Parameters:

id: (Required, integer/string) IMO number or MMSI of the vessel.

Query Parameters:

from: (Optional, ISO 8601 string) Start time of the historical period.

to: (Optional, ISO 8601 string) End time of the historical period.

Example Request:

GET /api/vessels/9235061/track?from=2025-07-20T00:00:00Z&to=2025-07-24T23:59:59Z
Example Response (200 OK):

JSON

[
  {
    "latitude": 38.000,
    "longitude": -75.000,
    "timestamp": "2025-07-20T00:00:00Z",
    "speed": 10.0,
    "course": 180
  },
  // ... more historical points
]
5. Real-time Data (WebSockets)
The backend provides real-time vessel position updates via Socket.IO.

Endpoint: The WebSocket server will typically run on the same port as the Express.js application.

Event: Clients should listen for a specific event, e.g., vessel_update.

Connection:

JavaScript

const socket = io('http://localhost:3000'); // Or your backend URL
socket.on('vessel_update', (data) => {
    console.log('Received vessel update:', data);
    // Update map with new vessel data
});
Data Format: The vessel_update event will send an array of vessel objects, similar to the GET /api/vessels response, but optimized for real-time changes (e.g., only including imo, latitude, longitude, speed, course).

6. Caching
Redis is used for caching MarineTraffic API responses to improve performance and manage API rate limits.

Mechanism: Data fetched from MarineTraffic will be stored in Redis with appropriate TTLs. Subsequent requests for the same data will first check the cache.

Cache Invalidation: Real-time updates from MarineTraffic will trigger invalidation or update of relevant cached vessel data.

7. Error Handling and Logging
Robust Error Handling: The backend includes comprehensive error handling for network issues, invalid API responses, and internal processing errors, returning appropriate HTTP status codes and informative error messages to the frontend.

Logging: Basic logging (e.g., using console.log or a dedicated logging library like winston) is implemented to track API usage, errors, and performance.

8. Setup and Running
Clone the Backend Repository: If you haven't already, clone the backend repository.

Install Dependencies:

Bash

npm install
Configure Environment Variables: Create a .env file in the root of the backend directory and add the variables listed in Section 2.

Start the Server:

Bash

npm start # Or node news-backend.js, depending on your package.json scripts
9. Future Enhancements
More granular WebSocket broadcasting (e.g., by geographic region).

Advanced caching strategies (e.g., pre-fetching).

Integration with other maritime data providers for redundancy or additional data.

Comprehensive monitoring and alerting for API usage and service health.