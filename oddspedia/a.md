### [scraper.py](file:///c%3A/Users/mohil/OneDrive/Desktop/workspace/oddspedia/scraper.py)

Update scraper.py to use the enhanced multi-endpoint functionality.

```python
# ...existing code...

# Backward compatibility aliases for the old OddspediaScraper class
class OddspediaScraper(EnhancedOddspediaScraper):
    """Backward compatibility class that extends EnhancedOddspediaScraper."""
    
    def __init__(self, db_path: str = "oddspedia.db"):
        super().__init__(db_path)
    
    # Legacy method names for backward compatibility
    def get_latest_data(self):
        """Legacy method - returns bookmakers data."""
        return self.get_latest_bookmakers_data()
    
    def get_all_data(self, limit: int = 100):
        """Legacy method - returns bookmakers data."""
        return self.get_all_data('bookmakers_data', limit)

# ...existing code...
```

### [api_server.py](file:///c%3A/Users/mohil/OneDrive/Desktop/workspace/oddspedia/api_server.py)

Update API server to serve all three endpoints with proper routes.

```python


Made changes.

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from typing import Dict, Any, Optional, List
import uvicorn
from database import EnhancedOddsDB
from scraper import EnhancedOddspediaScraper
import threading
import time
from datetime import datetime
import asyncio

app = FastAPI(
    title="Enhanced Oddspedia API",
    description="Multi-endpoint API to serve scraped data from Oddspedia with CF bypass",
    version="2.0.0"
)

# Initialize enhanced scraper and database
scraper = EnhancedOddspediaScraper()
db = EnhancedOddsDB()

@app.on_event("startup")
async def startup_event():
    """Start the automated scraper when the API starts."""
    print("🚀 Starting enhanced automated scraper for all endpoints...")
    scraper.start_scheduler()

@app.on_event("shutdown")
async def shutdown_event():
    """Stop the scraper when the API shuts down."""
    print("🛑 Stopping enhanced automated scraper...")
    scraper.stop_scheduler()

@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "message": "Enhanced Oddspedia API",
        "version": "2.0.0",
        "description": "Multi-endpoint API with CF bypass",
        "features": [
            "3 different data endpoints",
            "Cloudflare bypass",
            "Automatic scheduling every 6 minutes",
            "SQLite database storage",
            "Separate tables for each data type"
        ],
        "endpoints": {
            "/bookmakers": "Get latest bookmakers data",
            "/max-odds": "Get latest max odds with pagination",
            "/match-poll": "Get latest match poll data",
            "/status": "Get scraping status for all endpoints",
            "/health": "Health check"
        }
    }

# BOOKMAKERS ENDPOINTS
@app.get("/bookmakers")
async def get_bookmakers() -> Dict[str, Any]:
    """Get the latest bookmakers data."""
    try:
        latest_data = scraper.get_latest_bookmakers_data()
        
        if latest_data is None:
            raise HTTPException(
                status_code=404, 
                detail="No bookmakers data available. Scraping may still be in progress."
            )
        
        return latest_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving bookmakers data: {str(e)}")

@app.get("/bookmakers/all")
async def get_all_bookmakers(limit: int = 100) -> List[Dict[str, Any]]:
    """Get all scraped bookmakers data with metadata."""
    try:
        all_data = scraper.get_all_data('bookmakers_data', limit)
        return all_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving all bookmakers data: {str(e)}")

# MAX ODDS ENDPOINTS
@app.get("/max-odds")
async def get_max_odds() -> Dict[str, Any]:
    """Get the latest max odds with pagination data."""
    try:
        latest_data = scraper.get_latest_max_odds_data()
        
        if latest_data is None:
            raise HTTPException(
                status_code=404, 
                detail="No max odds data available. Scraping may still be in progress."
            )
        
        return latest_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving max odds data: {str(e)}")

@app.get("/max-odds/all")
async def get_all_max_odds(limit: int = 100) -> List[Dict[str, Any]]:
    """Get all scraped max odds data with metadata."""
    try:
        all_data = scraper.get_all_data('max_odds_data', limit)
        return all_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving all max odds data: {str(e)}")

# MATCH POLL ENDPOINTS
@app.get("/match-poll")
async def get_match_poll() -> Dict[str, Any]:
    """Get the latest match poll data."""
    try:
        latest_data = scraper.get_latest_match_poll_data()
        
        if latest_data is None:
            raise HTTPException(
                status_code=404, 
                detail="No match poll data available. Scraping may still be in progress."
            )
        
        return latest_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving match poll data: {str(e)}")

@app.get("/match-poll/all")
async def get_all_match_poll(limit: int = 100) -> List[Dict[str, Any]]:
    """Get all scraped match poll data with metadata."""
    try:
        all_data = scraper.get_all_data('match_poll_data', limit)
        return all_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving all match poll data: {str(e)}")

# STATUS AND CONTROL ENDPOINTS
@app.get("/status")
async def get_scraping_status():
    """Get the current status of the enhanced scraping system."""
    try:
        # Get latest data from all endpoints
        latest_bookmakers = scraper.get_latest_bookmakers_data()
        latest_max_odds = scraper.get_latest_max_odds_data()
        latest_match_poll = scraper.get_latest_match_poll_data()
        
        # Get record counts for all tables
        record_counts = scraper.db.get_record_counts()
        
        # Get recent scrapes from all tables
        recent_bookmakers = scraper.get_all_data('bookmakers_data', 5)
        recent_max_odds = scraper.get_all_data('max_odds_data', 5)
        recent_match_poll = scraper.get_all_data('match_poll_data', 5)
        
        status = {
            "scraper_type": "Enhanced Multi-Endpoint Scraper",
            "scraper_running": scraper.is_running,
            "endpoints_status": {
                "bookmakers": {
                    "has_data": latest_bookmakers is not None,
                    "last_successful_scrape": None,
                    "record_counts": record_counts.get('bookmakers_data', {})
                },
                "max_odds": {
                    "has_data": latest_max_odds is not None,
                    "last_successful_scrape": None,
                    "record_counts": record_counts.get('max_odds_data', {})
                },
                "match_poll": {
                    "has_data": latest_match_poll is not None,
                    "last_successful_scrape": None,
                    "record_counts": record_counts.get('match_poll_data', {})
                }
            },
            "total_record_counts": record_counts,
            "recent_scrapes": {
                "bookmakers": [
                    {
                        "scraped_at": record['scraped_at'],
                        "success": record['success']
                    }
                    for record in recent_bookmakers[:3]
                ],
                "max_odds": [
                    {
                        "scraped_at": record['scraped_at'],
                        "success": record['success']
                    }
                    for record in recent_max_odds[:3]
                ],
                "match_poll": [
                    {
                        "scraped_at": record['scraped_at'],
                        "success": record['success']
                    }
                    for record in recent_match_poll[:3]
                ]
            }
        }
        
        # Get last successful scrape times
        for records, endpoint in [(recent_bookmakers, "bookmakers"), 
                                 (recent_max_odds, "max_odds"), 
                                 (recent_match_poll, "match_poll")]:
            for record in records:
                if record['success']:
                    status["endpoints_status"][endpoint]["last_successful_scrape"] = record['scraped_at']
                    break
        
        return status
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting status: {str(e)}")

@app.post("/scrape-now")
async def trigger_scrape():
    """Manually trigger a scraping operation for all endpoints."""
    try:
        asyncio.create_task(scraper.run_scraping_job_async())
        
        return {
            "message": "Enhanced scraping triggered for all endpoints",
            "endpoints": ["bookmakers", "max_odds", "match_poll"],
            "methods": "CF Verification → Requests fallback",
            "status": "running",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error triggering scrape: {str(e)}")

@app.post("/scrape-bookmakers")
async def trigger_bookmakers_scrape():
    """Manually trigger scraping for bookmakers endpoint only."""
    try:
        async def run_bookmakers_only():
            await scraper.scrape_bookmakers()
        
        asyncio.create_task(run_bookmakers_only())
        
        return {
            "message": "Bookmakers scraping triggered",
            "endpoint": "bookmakers",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error triggering bookmakers scrape: {str(e)}")

@app.post("/scrape-max-odds")
async def trigger_max_odds_scrape():
    """Manually trigger scraping for max odds endpoint only."""
    try:
        async def run_max_odds_only():
            await scraper.scrape_max_odds()
        
        asyncio.create_task(run_max_odds_only())
        
        return {
            "message": "Max odds scraping triggered",
            "endpoint": "max_odds",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error triggering max odds scrape: {str(e)}")

@app.post("/scrape-match-poll")
async def trigger_match_poll_scrape():
    """Manually trigger scraping for match poll endpoint only."""
    try:
        async def run_match_poll_only():
            await scraper.scrape_match_poll()
        
        asyncio.create_task(run_match_poll_only())
        
        return {
            "message": "Match poll scraping triggered",
            "endpoint": "match_poll",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error triggering match poll scrape: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "scraper_running": scraper.is_running,
        "endpoints": ["bookmakers", "max_odds", "match_poll"],
        "version": "2.0.0"
    }

# Backward compatibility endpoints
@app.get("/bookmakers/status")
async def get_bookmakers_status():
    """Legacy endpoint - redirects to main status."""
    status = await get_scraping_status()
    return status["endpoints_status"]["bookmakers"]

if __name__ == "__main__":
    print("🚀 Starting Enhanced Oddspedia API Server...")
    print("API will be available at: http://localhost:8000")
    print("Documentation at: http://localhost:8000/docs")
    print("\n📊 Available endpoints:")
    print("  • /bookmakers - Latest bookmakers data")
    print("  • /max-odds - Latest max odds data")
    print("  • /match-poll - Latest match poll data")
    print("  • /status - Overall scraping status")
    
    uvicorn.run(
        "api_server:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info"
    )
```

Now your system is fully enhanced with:

## 🎯 **Available API Endpoints:**

### **Data Endpoints:**
- **📊 `/bookmakers`** - Latest bookmakers data
- **🎲 `/max-odds`** - Latest max odds with pagination 
- **⚽ `/match-poll`** - Latest match poll data

### **Metadata Endpoints:**
- **📈 `/bookmakers/all`** - All bookmakers data with metadata
- **📈 `/max-odds/all`** - All max odds data with metadata
- **📈 `/match-poll/all`** - All match poll data with metadata

### **Control Endpoints:**
- **📊 `/status`** - Complete status for all endpoints
- **⚡ `/scrape-now`** - Trigger scraping for all endpoints
- **⚡ `/scrape-bookmakers`** - Trigger bookmakers scraping only
- **⚡ `/scrape-max-odds`** - Trigger max odds scraping only
- **⚡ `/scrape-match-poll`** - Trigger match poll scraping only
- **🏥 `/health`** - Health check

### **Features:**
✅ **3 separate database tables** for each data type  
✅ **Individual endpoint scraping** or all at once  
✅ **CF verification** for all endpoints  
✅ **Auto-cleanup** - deletes old data, keeps latest  
✅ **6-minute automated scheduling** for all endpoints  
✅ **Detailed status monitoring** per endpoint  
✅ **Backward compatibility** with existing code  

Now run:
```bash
```bash
```bash
python main.py
```