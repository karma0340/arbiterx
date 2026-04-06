import sys
import os

def main():
    """Main function to start the complete system."""
    print("🚀 Starting Oddspedia Bookmakers Scraping System")
    print("=" * 60)
    
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
        
        if command == "scrape":
            # Run single scraping operation
            import asyncio
            from scraper import OddspediaScraper
            
            async def run_scrape():
                scraper = OddspediaScraper()
                print("Running single scraping operation...")
                result = await scraper.scrape_bookmakers()
                if result:
                    print("✅ Scraping completed successfully")
                else:
                    print("❌ Scraping failed")
            
            asyncio.run(run_scrape())
                
        elif command == "server":
            # Start API server
            import uvicorn
            
            print("Starting API server...")
            print("API will be available at: http://localhost:8000")
            print("Documentation at: http://localhost:8000/docs")
            print("Bookmakers endpoint: http://localhost:8000/bookmakers")
            
            uvicorn.run(
                "api_server:app",
                host="0.0.0.0",
                port=8000,
                reload=False,
                log_level="info"
            )
            
        elif command == "test":
            # Test database operations
            print("Testing database operations...")
            from database import BookmakersDB
            
            db = BookmakersDB()
            
            # Test save
            test_data = {"test": "data", "timestamp": "2024-01-01"}
            if db.save_data(test_data):
                print("✅ Database save test passed")
            else:
                print("❌ Database save test failed")
            
            # Test retrieve
            latest = db.get_latest_data()
            if latest:
                print("✅ Database retrieve test passed")
                print(f"Latest data: {latest}")
            else:
                print("❌ Database retrieve test failed")
                
        else:
            print(f"Unknown command: {command}")
            print("Available commands:")
            print("  scrape  - Run single scraping operation")
            print("  server  - Start API server with automated scraping")
            print("  test    - Test database operations")
    else:
        # Default: start API server
        import uvicorn
        
        print("Starting API server with automated scraping...")
        print("API will be available at: http://localhost:8000")
        print("Documentation at: http://localhost:8000/docs")
        print("Bookmakers endpoint: http://localhost:8000/bookmakers")
        print("\nPress Ctrl+C to stop the server")
        
        uvicorn.run(
            "api_server:app",
            host="0.0.0.0",
            port=8000,
            reload=False,
            log_level="info"
        )

if __name__ == "__main__":
    main()
