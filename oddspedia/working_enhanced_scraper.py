import nodriver
import time
import json
import asyncio
from typing import Dict, Any, Optional
from database import BookmakersDB
import threading
import schedule
from datetime import datetime
import concurrent.futures
import requests

class WorkingEnhancedScraper:
    def __init__(self, db_path: str = "bookmakers.db"):
        self.db = BookmakersDB(db_path)
        self.is_running = False
        self.scheduler_thread = None
        self.executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    
    async def scrape_with_cf_verify(self) -> Optional[Dict[str, Any]]:
        """Try scraping with CF verification - this method works!"""
        browser = None
        try:
            from nodriver_cf_verify import CFVerify
            
            print("✅ Using CF verification method (confirmed working)...")
            
            browser = await nodriver.start(
                headless=True,  # Works in headless mode
                browser_args=[
                    '--no-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-gpu',
                    '--disable-dev-shm-usage',
                    '--no-first-run',
                    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                ]
            )
            
            browser_tab = await browser.get(
                "https://oddspedia.com/api/v1/getBookmakers?geoCode=&geoState=&language=en"
            )
            
            print("Navigating to API endpoint...")
            
            start = time.perf_counter()
            cf_verify = CFVerify(_browser_tab=browser_tab, _debug=False)
            
            print("Starting Cloudflare verification...")
            success = await cf_verify.verify(
                _max_retries=15,
                _interval_between_retries=1, 
                _reload_page_after_n_retries=0
            )
            
            duration = time.perf_counter() - start
            
            if success:
                print(f"✅ Cloudflare verified successfully in {duration:.2f} seconds!")
                
                # Wait for page to fully load
                await asyncio.sleep(3)
                
                content = await browser_tab.evaluate("document.body.innerText")
                
                try:
                    json_data = json.loads(content)
                    print(f"✅ Successfully parsed JSON data!")
                    return json_data
                except json.JSONDecodeError:
                    print(f"❌ Response not JSON: {content[:200]}")
                    return None
            else:
                print(f"❌ CF verification failed after {duration:.2f} seconds")
                return None
                
        except Exception as e:
            print(f"❌ CF verification method error: {e}")
            return None
        finally:
            if browser:
                try:
                    browser.stop()  # No await
                except:
                    pass
    
    def scrape_with_cloudscraper(self) -> Optional[Dict[str, Any]]:
        """Try scraping with cloudscraper."""
        try:
            import cloudscraper
            
            print("Attempting cloudscraper method...")
            
            scraper = cloudscraper.create_scraper()
            response = scraper.get(
                "https://oddspedia.com/api/v1/getBookmakers?geoCode=&geoState=&language=en",
                timeout=30
            )
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    print("✅ Cloudscraper succeeded!")
                    return data
                except json.JSONDecodeError:
                    print(f"❌ Cloudscraper got non-JSON: {response.text[:200]}")
                    return None
            else:
                print(f"❌ Cloudscraper failed with status: {response.status_code}")
                return None
                
        except ImportError:
            print("❌ Cloudscraper not available")
            return None
        except Exception as e:
            print(f"❌ Cloudscraper error: {e}")
            return None
    
    def scrape_with_requests(self) -> Optional[Dict[str, Any]]:
        """Try scraping with requests."""
        try:
            print("Attempting requests method...")
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
            }
            
            response = requests.get(
                "https://oddspedia.com/api/v1/getBookmakers?geoCode=&geoState=&language=en",
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    print("✅ Requests succeeded!")
                    return data
                except json.JSONDecodeError:
                    print(f"❌ Requests got non-JSON: {response.text[:200]}")
                    return None
            else:
                print(f"❌ Requests failed with status: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"❌ Requests error: {e}")
            return None
    
    async def scrape_bookmakers(self) -> Optional[Dict[str, Any]]:
        """Try multiple scraping methods, prioritizing CF verification since it works."""
        print(f"[{datetime.now()}] Starting enhanced bookmakers scraping...")
        
        # Since CF verification works, try it first with fallbacks
        methods = [
            ("CF Verification", self.scrape_with_cf_verify),
            ("CloudScraper", self.scrape_with_cloudscraper),
            ("Requests", self.scrape_with_requests),
        ]
        
        for method_name, method_func in methods:
            print(f"\n🔄 Trying {method_name}...")
            try:
                if asyncio.iscoroutinefunction(method_func):
                    result = await method_func()
                else:
                    result = method_func()
                
                if result and isinstance(result, (dict, list)):
                    print(f"🎉 {method_name} succeeded!")
                    
                    # Save to database
                    if self.db.save_data(result, success=True):
                        print("💾 Data saved to database successfully")
                    else:
                        print("⚠️ Failed to save data to database")
                    
                    return result
                else:
                    print(f"❌ {method_name} failed or returned invalid data")
                    
            except Exception as e:
                print(f"❌ {method_name} error: {e}")
        
        # If all methods fail, save failure to database
        print("💀 All scraping methods failed")
        self.db.save_data(None, success=False)
        return None
    
    def run_scraping_job_sync(self):
        """Run scraping job in a separate thread with its own event loop."""
        def scraping_worker():
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                result = loop.run_until_complete(self.scrape_bookmakers())
                
                if result:
                    print(f"[{datetime.now()}] ✅ Scraping completed successfully")
                else:
                    print(f"[{datetime.now()}] ❌ Scraping failed")
                    
            except Exception as e:
                print(f"[{datetime.now()}] ⚠️ Error in scraping job: {e}")
            finally:
                loop.close()
        
        self.executor.submit(scraping_worker)
    
    async def run_scraping_job_async(self):
        """Run scraping job asynchronously."""
        try:
            result = await self.scrape_bookmakers()
            
            if result:
                print(f"[{datetime.now()}] ✅ Async scraping completed successfully")
                return result
            else:
                print(f"[{datetime.now()}] ❌ Async scraping failed")
                return None
                
        except Exception as e:
            print(f"[{datetime.now()}] ⚠️ Error in async scraping job: {e}")
            return None
    
    def start_scheduler(self):
        """Start the automated scheduler."""
        if self.is_running:
            print("Scheduler is already running")
            return
        
        # Schedule the job every 6 minutes
        schedule.every(6).minutes.do(self.run_scraping_job_sync)
        
        # Run initial scraping
        print("🚀 Running initial enhanced scraping...")
        self.run_scraping_job_sync()
        
        self.is_running = True
        
        def run_scheduler():
            print("📅 Enhanced scheduler started - will scrape every 6 minutes")
            while self.is_running:
                schedule.run_pending()
                time.sleep(1)
        
        self.scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
        self.scheduler_thread.start()
    
    def stop_scheduler(self):
        """Stop the automated scheduler."""
        self.is_running = False
        schedule.clear()
        self.executor.shutdown(wait=False)
        print("🛑 Enhanced scheduler stopped")
    
    def get_latest_data(self) -> Optional[Dict[str, Any]]:
        """Get the latest scraped data from database."""
        return self.db.get_latest_data()
    
    def get_all_data(self, limit: int = 100):
        """Get all scraped data with metadata."""
        return self.db.get_all_data(limit)

if __name__ == "__main__":
    # Test the working enhanced scraper
    scraper = WorkingEnhancedScraper()
    
    async def test():
        print("🧪 Testing working enhanced scraper...")
        result = await scraper.scrape_bookmakers()
        if result:
            print("🎉 Enhanced scraping test successful!")
            print(f"Data type: {type(result)}")
            if isinstance(result, dict):
                print(f"Keys: {list(result.keys())}")
            elif isinstance(result, list):
                print(f"List length: {len(result)}")
        else:
            print("💀 Enhanced scraping test failed")
    
    asyncio.run(test())
