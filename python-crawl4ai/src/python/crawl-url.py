import asyncio
import sys
from crawl4ai import *

async def main(url: str):
    async with AsyncWebCrawler() as crawler:
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