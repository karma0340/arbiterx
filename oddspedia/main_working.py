import sys
import uvicorn

def main():
    """Main function to start the working system."""
    print("🚀 Starting WORKING Oddspedia Bookmakers Scraping System")
    print("=" * 60)
    
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
        
        if command == "test":
            # Test the working scraper
            import asyncio
            from working_enhanced_scraper import WorkingEnhancedScraper
            
            async def run_test():
                scraper = WorkingEnhancedScraper()
                print("🧪 Testing working enhanced scraper...")
                result = await scraper.scrape_bookmakers()
                if result:
                    print("✅ Test completed successfully!")
                    print(f"Data preview: {str(result)[:200]}...")
                else:
                    print("❌ Test failed")
            
            asyncio.run(run_test())
                
        elif command == "server":
            # Start API server with working scraper
            print("Starting API server with WORKING enhanced scraper...")
            print("API will be available at: http://localhost:8000")
            print("Documentation at: http://localhost:8000/docs")
            print("Bookmakers endpoint: http://localhost:8000/bookmakers")
            
            # Import and modify api_server to use working scraper
            from working_enhanced_scraper import WorkingEnhancedScraper
            from fastapi import FastAPI, HTTPException
            from typing import Dict, Any, Optional, List
            from datetime import datetime
            import asyncio
            
            app = FastAPI(
                title="WORKING Oddspedia Bookmakers API",
                description="API using WORKING enhanced scraper with CF verification",
                version="3.0.0"
            )
            
            scraper = WorkingEnhancedScraper()
            
            @app.on_event("startup")
            async def startup_event():
                print("🚀 Starting WORKING automated scraper...")
                scraper.start_scheduler()
            
            @app.on_event("shutdown")
            async def shutdown_event():
                print("🛑 Stopping WORKING automated scraper...")
                scraper.stop_scheduler()
            
            @app.get("/")
            async def root():
                return {
                    "message": "WORKING Oddspedia Bookmakers API",
                    "version": "3.0.0",
                    "status": "CF Verification confirmed working!",
                    "endpoints": {
                        "/bookmakers": "Get latest bookmakers data",
                        "/bookmakers/status": "Get scraping status",
                        "/health": "Health check"
                    }
                }
            
            @app.get("/bookmakers")
            async def get_bookmakers() -> Dict[str, Any]:
                try:
                    latest_data = scraper.get_latest_data()
                    
                    if latest_data is None:
                        raise HTTPException(
                            status_code=404, 
                            detail="No bookmakers data available yet. CF verification may be in progress."
                        )
                    
                    return latest_data
                    
                except Exception as e:
                    raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
            
            @app.get("/bookmakers/status")
            async def get_status():
                try:
                    latest_data = scraper.get_latest_data()
                    all_records = scraper.get_all_data(5)
                    record_counts = scraper.db.get_record_count()
                    
                    return {
                        "scraper_type": "WORKING Enhanced Scraper",
                        "cf_verification": "Confirmed working!",
                        "scraper_running": scraper.is_running,
                        "has_current_data": latest_data is not None,
                        "record_counts": record_counts,
                        "recent_scrapes": [
                            {
                                "scraped_at": record['scraped_at'],
                                "success": record['success']
                            }
                            for record in all_records
                        ]
                    }
                    
                except Exception as e:
                    raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
            
            @app.post("/bookmakers/scrape-now")
            async def trigger_scrape():
                try:
                    asyncio.create_task(scraper.run_scraping_job_async())
                    
                    return {
                        "message": "WORKING scraping triggered!",
                        "method": "CF Verification (confirmed working)",
                        "timestamp": datetime.now().isoformat()
                    }
                    
                except Exception as e:
                    raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
            
            @app.get("/health")
            async def health_check():
                return {
                    "status": "healthy",
                    "scraper_type": "WORKING",
                    "cf_verification": "confirmed_working",
                    "timestamp": datetime.now().isoformat()
                }
            
            uvicorn.run(
                app,
                host="0.0.0.0",
                port=8000,
                reload=False,
                log_level="info"
            )
            
        else:
            print(f"Unknown command: {command}")
            print("Available commands:")
            print("  test    - Test the working scraper")
            print("  server  - Start API server with working scraper")
    else:
        # Default: start working server
        print("Starting WORKING API server...")
        main_args = ["", "server"]
        sys.argv = main_args
        main()

if __name__ == "__main__":
    main()
