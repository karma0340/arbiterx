# **App Name**: ArbiterX

## Core Features:

- Real-time Opportunity Stream: Display arbitrage opportunities as they are detected via WebSocket connection, with a live-updating dashboard. Features live odds for quick reactions to arbitrage.
- Data Normalization Adapters: Integrate data from OrbitX and other bookmakers via dedicated adapters to ensure consistent data formatting, using data fetched via REST APIs or HTML scraping.
- Automated Arbitrage Comparison Engine: A service that takes normalized odds, compares them, and highlights arbitrage opportunities based on a configured threshold and latency tolerance.
- Python Scraper Integration: Seamlessly integrate with Python Selenium scrapers for automated data collection from various bookmakers that lack direct APIs, managed using provided wrapper scripts to maintain data flow to the arbitrage engine.
- Historical Arbitrage Analysis: Using generative AI, a tool will process historical arbitrage data and suggest optimal staking strategies. Includes considerations for liquidity and risk.
- User Authentication: Firebase Authentication integration for user management and secure access to application features.
- Filtering and Sorting: Allow users to filter and sort arbitrage opportunities by various criteria such as league, market, and arbitrage percentage.

## Style Guidelines:

- Primary color: Slate blue (#778DA9) to convey trust and stability.
- Background color: Dark gray (#1B262C) for a modern, focused feel.
- Accent color: Vibrant teal (#41E2BA) to highlight key arbitrage opportunities and interactive elements. The vibrancy should draw the user's eye.
- Body font: 'Inter', a sans-serif font known for its clean readability in various UI contexts.
- Headline font: 'Space Grotesk', a slightly more stylized sans-serif to signal modernity.
- Use sharp, geometric icons from 'lucide-react' to maintain a consistent, modern aesthetic.
- Implement a responsive, mobile-first design with a clear information hierarchy. Utilize a grid layout to display arbitrage opportunities efficiently, switching to a two-column layout on larger screens.