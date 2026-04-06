import asyncio
import nodriver
from nodriver_cf_verify import CFVerify
import time
import json

async def simple_test():
    """Simple test to check what's causing the error."""
    browser = None
    try:
        print("Starting simple browser test...")
        
        # Start browser
        browser = await nodriver.start(headless=True)
        print(f"Browser type: {type(browser)}")
        print(f"Browser object: {browser}")
        
        # Get a tab
        tab = await browser.get("https://oddspedia.com/api/v1/getBookmakers?geoCode=&geoState=&language=en")
        print(f"Tab type: {type(tab)}")
        
        # Wait a bit
        await asyncio.sleep(10)
        
        # Get content
        content = await tab.evaluate("document.body.innerText")
        print(f"Content length: {len(content)}")
        print(f"Content preview: {content[:200]}")
        
        # Try CF verify
        try:
            cf_verify = CFVerify(_browser_tab=tab, _debug=True)
            success = await cf_verify.verify(_max_retries=5, _interval_between_retries=2)
            print(f"CF Verify success: {success}")
        except Exception as cf_error:
            print(f"CF Verify error: {cf_error}")
        
        return content
        
    except Exception as e:
        print(f"Error in simple test: {e}")
        return None
    finally:
        if browser:
            try:
                print(f"Attempting to stop browser: {browser}")
                print(f"Browser methods: {dir(browser)}")
                
                # Check what methods are available
                if hasattr(browser, 'stop'):
                    print("Browser has 'stop' method")
                    result = browser.stop()
                    print(f"Stop result: {result}")
                    if asyncio.iscoroutine(result):
                        await result
                else:
                    print("Browser does not have 'stop' method")
                    
            except Exception as cleanup_error:
                print(f"Cleanup error: {cleanup_error}")

if __name__ == "__main__":
    result = asyncio.run(simple_test())
    print("Test completed")
