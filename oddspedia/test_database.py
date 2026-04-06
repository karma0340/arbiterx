from database import BookmakersDB
import json
import time

def test_database():
    """Test database operations."""
    print("Testing database operations...")
    
    # Initialize database
    db = BookmakersDB("test_bookmakers.db")
    
    # Test 1: Save successful data
    print("\n1. Testing successful data save...")
    test_data_1 = {
        "bookmakers": [
            {"id": 1, "name": "Bookmaker 1", "odds": 1.5},
            {"id": 2, "name": "Bookmaker 2", "odds": 2.0}
        ],
        "timestamp": "2024-01-01T10:00:00"
    }
    
    result = db.save_data(test_data_1, success=True)
    print(f"Save result: {result}")
    
    # Test 2: Save another successful data (should replace old one)
    print("\n2. Testing second successful data save (should replace first)...")
    time.sleep(1)  # Small delay to ensure different timestamp
    test_data_2 = {
        "bookmakers": [
            {"id": 3, "name": "Bookmaker 3", "odds": 1.8},
            {"id": 4, "name": "Bookmaker 4", "odds": 2.2}
        ],
        "timestamp": "2024-01-01T11:00:00"
    }
    
    result = db.save_data(test_data_2, success=True)
    print(f"Save result: {result}")
    
    # Test 3: Save failed attempt
    print("\n3. Testing failed attempt save...")
    result = db.save_data(None, success=False)
    print(f"Save result: {result}")
    
    # Test 4: Get latest data
    print("\n4. Testing get latest data...")
    latest = db.get_latest_data()
    print(f"Latest data: {json.dumps(latest, indent=2) if latest else 'None'}")
    
    # Test 5: Get all data
    print("\n5. Testing get all data...")
    all_data = db.get_all_data()
    print(f"Total records: {len(all_data)}")
    for i, record in enumerate(all_data):
        print(f"Record {i+1}: Success={record['success']}, Time={record['scraped_at']}")
    
    # Test 6: Get record counts
    print("\n6. Testing record counts...")
    counts = db.get_record_count()
    print(f"Record counts: {counts}")
    
    print("\nDatabase test completed!")

if __name__ == "__main__":
    test_database()
