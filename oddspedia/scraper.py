import nodriver
import time
import json
import asyncio
from typing import Dict, Any, Optional
from database import EnhancedOddsDB
import threading
import schedule
from datetime import datetime, timedelta
import concurrent.futures
import requests
from urllib.parse import quote

class EnhancedOddspediaScraper:
    def __init__(self, db_path: str = "oddspedia.db"):
        self.db = EnhancedOddsDB(db_path)
        self.is_running = False
        self.scheduler_thread = None
        self.executor = concurrent.futures.ThreadPoolExecutor(max_workers=3)
    
    def get_current_date_range(self):
        """Get current date range for max odds API."""
        now = datetime.now()
        start_date = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        end_date = (now + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
        return start_date, end_date
    
    async def scrape_with_cf_verify(self, url: str) -> Optional[Dict[str, Any]]:
        """Generic CF verification method for any URL."""
        browser = None
        try:
            from nodriver_cf_verify import CFVerify
            
            print(f"✅ Using CF verification for: {url[:50]}...")
            
            browser = await nodriver.start(
                headless=True,
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
            
            browser_tab = await browser.get(url)
            
            start = time.perf_counter()
            cf_verify = CFVerify(_browser_tab=browser_tab, _debug=False)
            
            success = await cf_verify.verify(
                _max_retries=15,
                _interval_between_retries=1, 
                _reload_page_after_n_retries=0
            )
            
            duration = time.perf_counter() - start
            
            if success:
                print(f"✅ CF verified successfully in {duration:.2f}s")
                await asyncio.sleep(3)
                content = await browser_tab.evaluate("document.body.innerText")
                
                try:
                    return json.loads(content)
                except json.JSONDecodeError:
                    print(f"❌ Response not JSON: {content[:200]}")
                    return None
            else:
                print(f"❌ CF verification failed after {duration:.2f}s")
                return None
                
        except Exception as e:
            print(f"❌ CF verification error: {e}")
            return None
        finally:
            if browser:
                try:
                    browser.stop()
                except:
                    pass
    
    def scrape_with_requests(self, url: str) -> Optional[Dict[str, Any]]:
        """Generic requests method for any URL."""
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
            }
            
            response = requests.get(url, headers=headers, timeout=30)
            
            if response.status_code == 200:
                try:
                    return response.json()
                except json.JSONDecodeError:
                    return None
            return None
                
        except Exception as e:
            print(f"❌ Requests error: {e}")
            return None
    
    async def scrape_bookmakers(self) -> Optional[Dict[str, Any]]:
        """Scrape bookmakers data."""
        url = "https://oddspedia.com/api/v1/getBookmakers?geoCode=&geoState=&language=en"
        
        methods = [
            ("CF Verification", self.scrape_with_cf_verify),
            ("Requests", self.scrape_with_requests),
        ]
        
        for method_name, method_func in methods:
            try:
                if asyncio.iscoroutinefunction(method_func):
                    result = await method_func(url)
                else:
                    result = method_func(url)
                
                if result:
                    print(f"🎉 Bookmakers - {method_name} succeeded!")
                    self.db.save_bookmakers_data(result, success=True)
                    return result
                    
            except Exception as e:
                print(f"❌ Bookmakers - {method_name} error: {e}")
        
        self.db.save_bookmakers_data(None, success=False)
        return None
    
    async def scrape_max_odds(self) -> Optional[Dict[str, Any]]:
        """Scrape max odds data using the confirmed working URL."""
        # Use the exact working URL without modifications
        url = "https://oddspedia.com/api/v1/getMaxOddsWithPagination?geoCode=IN&bookmakerGeoCode=IN&bookmakerGeoState=&wettsteuer=0&startDate=2025-09-10T18%3A30%3A00Z&endDate=2025-09-11T18%3A29%3A59Z&sport=football&ot=100&excludeSpecialStatus=0&popularLeaguesOnly=0&sortBy=default&status=all&page=1&perPage=50&inplay=1&language=en"
        
        methods = [
            ("CF Verification", self.scrape_with_cf_verify),
            ("Requests", self.scrape_with_requests),
        ]
        
        for method_name, method_func in methods:
            try:
                print(f"🔄 Trying Max Odds - {method_name}...")
                
                if asyncio.iscoroutinefunction(method_func):
                    result = await method_func(url)
                else:
                    result = method_func(url)
                
                if result and isinstance(result, (dict, list)):
                    print(f"🎉 Max Odds - {method_name} succeeded!")
                    
                    # Log what we got
                    if isinstance(result, dict):
                        print(f"  Keys: {list(result.keys())}")
                        # Check if we have the expected data structure
                        if 'data' in result:
                            data_content = result['data']
                            if isinstance(data_content, list):
                                print(f"  Data array length: {len(data_content)}")
                            elif isinstance(data_content, dict):
                                print(f"  Data object keys: {list(data_content.keys())}")
                    elif isinstance(result, list):
                        print(f"  List length: {len(result)}")
                    
                    self.db.save_max_odds_data(
                        result, success=True, 
                        start_date="2025-09-10T18:30:00Z", 
                        end_date="2025-09-11T18:29:59Z",
                        sport='football', page=1, per_page=50
                    )
                    return result
                else:
                    print(f"❌ Max Odds - {method_name} failed or returned invalid data")
                    
            except Exception as e:
                print(f"❌ Max Odds - {method_name} error: {e}")
        
        print("❌ All Max Odds methods failed")
        self.db.save_max_odds_data(None, success=False)
        return None
    
    async def scrape_match_poll(self) -> Optional[Dict[str, Any]]:
        """Scrape match poll data."""
        url = "https://oddspedia.com/api/v1/getMatchPoll?geoCode=IN&bookmakerGeoState=&bookmakerGeoCode=IN&sport=football&league=&category=&date=&language=en"
        
        methods = [
            ("CF Verification", self.scrape_with_cf_verify),
            ("Requests", self.scrape_with_requests),
        ]
        
        for method_name, method_func in methods:
            try:
                if asyncio.iscoroutinefunction(method_func):
                    result = await method_func(url)
                else:
                    result = method_func(url)
                
                if result:
                    print(f"🎉 Match Poll - {method_name} succeeded!")
                    self.db.save_match_poll_data(
                        result, success=True,
                        sport='football'
                    )
                    return result
                    
            except Exception as e:
                print(f"❌ Match Poll - {method_name} error: {e}")
        
        self.db.save_match_poll_data(None, success=False)
        return None
    
    async def scrape_all_endpoints(self) -> Dict[str, Optional[Dict[str, Any]]]:
        """Scrape all three endpoints."""
        print(f"[{datetime.now()}] Starting complete oddspedia scraping...")
        
        results = {}
        
        # Scrape all endpoints
        endpoints = [
            ("bookmakers", self.scrape_bookmakers),
            ("max_odds", self.scrape_max_odds), 
            ("match_poll", self.scrape_match_poll)
        ]
        
        for endpoint_name, scrape_func in endpoints:
            print(f"\n🔄 Scraping {endpoint_name}...")
            try:
                result = await scrape_func()
                results[endpoint_name] = result
                if result:
                    print(f"✅ {endpoint_name} completed successfully")
                else:
                    print(f"❌ {endpoint_name} failed")
            except Exception as e:
                print(f"💥 {endpoint_name} error: {e}")
                results[endpoint_name] = None
        
        success_count = sum(1 for r in results.values() if r is not None)
        print(f"\n📊 Scraping summary: {success_count}/{len(endpoints)} endpoints successful")
        
        return results
    
    def run_scraping_job_sync(self):
        """Run scraping job in a separate thread with its own event loop."""
        def scraping_worker():
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                results = loop.run_until_complete(self.scrape_all_endpoints())
                success_count = sum(1 for r in results.values() if r is not None)
                
                print(f"[{datetime.now()}] ✅ Scraping job completed: {success_count}/3 successful")
                    
            except Exception as e:
                print(f"[{datetime.now()}] ⚠️ Error in scraping job: {e}")
            finally:
                loop.close()
        
        self.executor.submit(scraping_worker)
    
    async def run_scraping_job_async(self):
        """Run scraping job asynchronously."""
        try:
            results = await self.scrape_all_endpoints()
            success_count = sum(1 for r in results.values() if r is not None)
            
            print(f"[{datetime.now()}] ✅ Async scraping completed: {success_count}/3 successful")
            return results
                
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
        print("🚀 Running initial enhanced scraping for all endpoints...")
        self.run_scraping_job_sync()
        
        self.is_running = True
        
        def run_scheduler():
            print("📅 Enhanced scheduler started - will scrape all endpoints every 6 minutes")
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
    
    # Getter methods
    def get_latest_bookmakers_data(self):
        return self.db.get_latest_bookmakers_data()
    
    def get_latest_max_odds_data(self):
        return self.db.get_latest_max_odds_data()
    
    def get_latest_match_poll_data(self):
        return self.db.get_latest_match_poll_data()
    
    def get_all_data(self, table_name: str, limit: int = 100):
        return self.db.get_all_data(table_name, limit)

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

if __name__ == "__main__":
    # Test the enhanced scraper
    scraper = EnhancedOddspediaScraper()
    
    async def test():
        print("🧪 Testing enhanced multi-endpoint scraper...")
        results = await scraper.scrape_all_endpoints()
        
        for endpoint, result in results.items():
            if result:
                print(f"✅ {endpoint}: {type(result)} with {len(result) if isinstance(result, (list, dict)) else 'data'}")
            else:
                print(f"❌ {endpoint}: Failed")
    
    asyncio.run(test())
