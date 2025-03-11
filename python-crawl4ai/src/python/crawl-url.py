import asyncio
import sys
import os
from crawl4ai import *
from crawl4ai.async_configs import BrowserConfig

async def main(url: str):
    # Get proxy configuration from environment variables
    proxy_url = os.environ.get("PROXY_URL")
    proxy_username = os.environ.get("PROXY_USERNAME")
    proxy_password = os.environ.get("PROXY_PASSWORD")
    
    # Configure the proxy
    browser_config = None
    if proxy_url:
        if proxy_username and proxy_password:
            # Use authenticated proxy
            proxy_config = {
                "server": proxy_url,
                "username": proxy_username,
                "password": proxy_password
            }
            browser_config = BrowserConfig(proxy_config=proxy_config)
        else:
            # Use simple proxy
            browser_config = BrowserConfig(proxy=proxy_url)
    else:
        browser_config = BrowserConfig()
    
    async with AsyncWebCrawler(config=browser_config) as crawler:
        result = await crawler.arun(
            url=url,
        )
        print(result.markdown)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python crawl-url.py <url>")
        sys.exit(1)
    url = sys.argv[1]
    asyncio.run(main(url))