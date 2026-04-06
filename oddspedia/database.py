import sqlite3
import json
import datetime
from typing import Dict, Any, Optional, List
import os

class EnhancedOddsDB:
    def __init__(self, db_path: str = "oddspedia.db"):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialize the database with required tables for all data types."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Table for bookmakers data
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS bookmakers_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data TEXT,
                scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                success BOOLEAN DEFAULT TRUE
            )
        ''')
        
        # Table for max odds data
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS max_odds_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data TEXT,
                scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                success BOOLEAN DEFAULT TRUE,
                start_date TEXT,
                end_date TEXT,
                sport TEXT DEFAULT 'football',
                page INTEGER DEFAULT 1,
                per_page INTEGER DEFAULT 50
            )
        ''')
        
        # Table for match poll data
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS match_poll_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data TEXT,
                scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                success BOOLEAN DEFAULT TRUE,
                sport TEXT DEFAULT 'football',
                league TEXT,
                category TEXT,
                date TEXT
            )
        ''')
        
        # Create indexes for faster queries
        indexes = [
            'CREATE INDEX IF NOT EXISTS idx_bookmakers_scraped_at ON bookmakers_data(scraped_at DESC)',
            'CREATE INDEX IF NOT EXISTS idx_max_odds_scraped_at ON max_odds_data(scraped_at DESC)',
            'CREATE INDEX IF NOT EXISTS idx_match_poll_scraped_at ON match_poll_data(scraped_at DESC)',
            'CREATE INDEX IF NOT EXISTS idx_max_odds_date ON max_odds_data(start_date, end_date)',
            'CREATE INDEX IF NOT EXISTS idx_match_poll_sport ON match_poll_data(sport, league)'
        ]
        
        for index_sql in indexes:
            cursor.execute(index_sql)
        
        conn.commit()
        conn.close()
    
    def delete_old_data(self, table_name: str):
        """Delete all old successful data from specific table."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Delete all successful records
            cursor.execute(f'''
                DELETE FROM {table_name} 
                WHERE success = TRUE
            ''')
            
            # Keep only last 10 failed attempts for debugging
            cursor.execute(f'''
                DELETE FROM {table_name} 
                WHERE success = FALSE 
                AND id NOT IN (
                    SELECT id FROM {table_name} 
                    WHERE success = FALSE 
                    ORDER BY scraped_at DESC 
                    LIMIT 10
                )
            ''')
            
            deleted_count = cursor.rowcount
            conn.commit()
            conn.close()
            
            if deleted_count > 0:
                print(f"Cleaned up {deleted_count} old records from {table_name}")
            return True
            
        except Exception as e:
            print(f"Error cleaning up old data from {table_name}: {e}")
            return False
    
    def save_bookmakers_data(self, data: Dict[str, Any], success: bool = True) -> bool:
        """Save bookmakers data to database."""
        if success and data is not None:
            self.delete_old_data('bookmakers_data')
        
        return self._save_data('bookmakers_data', data, success)
    
    def save_max_odds_data(self, data: Dict[str, Any], success: bool = True, 
                          start_date: str = None, end_date: str = None, 
                          sport: str = 'football', page: int = 1, per_page: int = 50) -> bool:
        """Save max odds data to database."""
        if success and data is not None:
            self.delete_old_data('max_odds_data')
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            json_data = json.dumps(data) if data is not None else None
            
            cursor.execute('''
                INSERT INTO max_odds_data (data, success, scraped_at, start_date, end_date, sport, page, per_page)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (json_data, success, datetime.datetime.now(), start_date, end_date, sport, page, per_page))
            
            conn.commit()
            conn.close()
            return True
            
        except Exception as e:
            print(f"Error saving max odds data: {e}")
            return False
    
    def save_match_poll_data(self, data: Dict[str, Any], success: bool = True,
                            sport: str = 'football', league: str = None, 
                            category: str = None, date: str = None) -> bool:
        """Save match poll data to database."""
        if success and data is not None:
            self.delete_old_data('match_poll_data')
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            json_data = json.dumps(data) if data is not None else None
            
            cursor.execute('''
                INSERT INTO match_poll_data (data, success, scraped_at, sport, league, category, date)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (json_data, success, datetime.datetime.now(), sport, league, category, date))
            
            conn.commit()
            conn.close()
            return True
            
        except Exception as e:
            print(f"Error saving match poll data: {e}")
            return False
    
    def _save_data(self, table_name: str, data: Dict[str, Any], success: bool = True) -> bool:
        """Generic save method for simple tables."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            json_data = json.dumps(data) if data is not None else None
            
            cursor.execute(f'''
                INSERT INTO {table_name} (data, success, scraped_at)
                VALUES (?, ?, ?)
            ''', (json_data, success, datetime.datetime.now()))
            
            conn.commit()
            conn.close()
            return True
            
        except Exception as e:
            print(f"Error saving data to {table_name}: {e}")
            return False
    
    def get_latest_bookmakers_data(self) -> Optional[Dict[str, Any]]:
        """Get the latest successful bookmakers data."""
        return self._get_latest_data('bookmakers_data')
    
    def get_latest_max_odds_data(self) -> Optional[Dict[str, Any]]:
        """Get the latest successful max odds data."""
        return self._get_latest_data('max_odds_data')
    
    def get_latest_match_poll_data(self) -> Optional[Dict[str, Any]]:
        """Get the latest successful match poll data."""
        return self._get_latest_data('match_poll_data')
    
    def _get_latest_data(self, table_name: str) -> Optional[Dict[str, Any]]:
        """Generic method to get latest data from any table."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(f'''
                SELECT data FROM {table_name} 
                WHERE success = TRUE AND data IS NOT NULL
                ORDER BY scraped_at DESC 
                LIMIT 1
            ''')
            
            result = cursor.fetchone()
            conn.close()
            
            if result and result[0]:
                return json.loads(result[0])
            return None
            
        except Exception as e:
            print(f"Error getting latest data from {table_name}: {e}")
            return None
    
    def get_all_data(self, table_name: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get all data from specific table with metadata."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(f'''
                SELECT id, data, scraped_at, success 
                FROM {table_name} 
                ORDER BY scraped_at DESC 
                LIMIT ?
            ''', (limit,))
            
            results = cursor.fetchall()
            conn.close()
            
            formatted_results = []
            for row in results:
                formatted_results.append({
                    'id': row[0],
                    'data': json.loads(row[1]) if row[1] else None,
                    'scraped_at': row[2],
                    'success': bool(row[3])
                })
            
            return formatted_results
            
        except Exception as e:
            print(f"Error getting all data from {table_name}: {e}")
            return []
    
    def get_record_counts(self) -> Dict[str, Dict[str, int]]:
        """Get count of successful and failed records for all tables."""
        tables = ['bookmakers_data', 'max_odds_data', 'match_poll_data']
        counts = {}
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            for table in tables:
                cursor.execute(f'SELECT COUNT(*) FROM {table} WHERE success = TRUE')
                successful_count = cursor.fetchone()[0]
                
                cursor.execute(f'SELECT COUNT(*) FROM {table} WHERE success = FALSE')
                failed_count = cursor.fetchone()[0]
                
                counts[table] = {
                    'successful': successful_count,
                    'failed': failed_count,
                    'total': successful_count + failed_count
                }
            
            conn.close()
            return counts
            
        except Exception as e:
            print(f"Error getting record counts: {e}")
            return {}

# Backward compatibility
class BookmakersDB(EnhancedOddsDB):
    """Backward compatibility class."""
    def save_data(self, data: Dict[str, Any], success: bool = True) -> bool:
        return self.save_bookmakers_data(data, success)
    
    def get_latest_data(self) -> Optional[Dict[str, Any]]:
        return self.get_latest_bookmakers_data()
    
    def get_record_count(self) -> Dict[str, int]:
        counts = self.get_record_counts()
        return counts.get('bookmakers_data', {'successful': 0, 'failed': 0, 'total': 0})
