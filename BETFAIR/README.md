# Betfair API Proxy

A Node.js API that proxies requests to Betfair's readonly API and Oddspedia API with Cloudflare bypass.

// ...existing code...

## API Endpoints

### GET /api/betfair/markets

// ...existing code...

### GET /api/oddspedia/bookmakers

Fetches bookmakers data from Oddspedia API with automatic Cloudflare bypass.

**Query Parameters:**
- `geoCode` (optional): Geographic code filter
- `geoState` (optional): Geographic state filter  
- `language` (optional): Language code (default: 'en')

**Example:**
```
GET http://localhost:3000/api/oddspedia/bookmakers
GET http://localhost:3000/api/oddspedia/bookmakers?language=en&geoCode=US
```

**Response:**
```json
{
  "success": true,
  "data": { ... },
  "method": "direct" | "cf_bypass",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### GET /api/oddspedia/bookmakers-v2

Enhanced Oddspedia API endpoint with exact browser headers and fallback strategies.

**Query Parameters:**
- `geoCode` (optional): Geographic code filter
- `geoState` (optional): Geographic state filter  
- `language` (optional): Language code (default: 'en')

**Example:**
```
GET http://localhost:3000/api/oddspedia/bookmakers-v2
GET http://localhost:3000/api/oddspedia/bookmakers-v2?language=en&geoCode=US
```

**Response:**
```json
{
  "success": true,
  "data": { ... },
  "method": "direct_with_headers" | "simplified_headers",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### POST /api/oddspedia/update-cookies

Updates the cookies used for Oddspedia requests.

**Body:**
```json
{
  "cookies": "your_updated_cookie_string_here"
}
```

### GET /api/oddspedia/cookies

Returns the current cookies being used for Oddspedia requests.

### GET /api/oddspedia/test-cf

Tests Cloudflare bypass functionality.

**Example:**
```
GET http://localhost:3000/api/oddspedia/test-cf
```

// ...existing code...

## Features

- **Proxy Support**: Routes requests through proxy servers
- **Cloudflare Bypass**: Automatically detects and bypasses Cloudflare protection
- **Fallback Strategy**: Tries direct request first, then CF bypass if needed
- **Error Handling**: Comprehensive error responses with details
- **Multiple APIs**: Supports both Betfair and Oddspedia endpoints

## Enhanced Features

- **Exact Browser Headers**: Uses identical headers from your working curl request
- **Cookie Management**: Ability to update cookies when they expire
- **Fallback Strategies**: Multiple request methods for better success rate
- **Service Architecture**: Modular design with dedicated service files

## Notes

- The Oddspedia endpoint will first try a direct request
- If Cloudflare protection is detected, it automatically switches to browser-based bypass
- Puppeteer is used for CF bypass with stealth techniques
- Random user agents are used to avoid detection
