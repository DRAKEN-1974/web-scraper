from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Any, Dict, List
from urllib.parse import urlparse, urljoin
import requests
from bs4 import BeautifulSoup
import time

app = FastAPI()

# --- CORS (allow all for dev, restrict for prod) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Simple In-Memory Rate Limiting (per IP, for demo) ---
rate_limit = {}
RATE_LIMIT = 20
RATE_PERIOD = 60  # seconds

def check_rate_limit(ip):
    now = time.time()
    history = rate_limit.get(ip, [])
    history = [t for t in history if now - t < RATE_PERIOD]
    if len(history) >= RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Too many requests - slow down!")
    history.append(now)
    rate_limit[ip] = history

# --- Utilities ---
def is_valid_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        return parsed.scheme in ("http", "https") and bool(parsed.netloc)
    except Exception:
        return False

def safe_requests_get(url, headers, timeout):
    try:
        resp = requests.get(url, headers=headers, timeout=timeout)
        resp.raise_for_status()
        return resp
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch {url}: {str(e)}")

def extract_metadata(soup):
    meta_tags = [
        {"name": tag.get("name", ""), "content": tag.get("content", "")}
        for tag in soup.find_all("meta") if tag.get("name") and tag.get("content")
    ]
    og_tags = [
        {"property": tag.get("property", ""), "content": tag.get("content", "")}
        for tag in soup.find_all("meta", property=True)
    ]
    twitter_tags = [
        {"name": tag.get("name", ""), "content": tag.get("content", "")}
        for tag in soup.find_all("meta", attrs={"name": lambda v: v and v.startswith("twitter:")})
    ]
    canonical = soup.find("link", rel="canonical")
    return {
        "meta": meta_tags,
        "og": og_tags,
        "twitter": twitter_tags,
        "canonical": canonical["href"] if canonical and canonical.get("href") else None
    }

def scrape_page(
    url: str,
    selector: Optional[str],
    extract: Optional[str],
    include_metadata: bool,
    user_agent: str,
    timeout: int,
) -> Dict[str, Any]:
    headers = {"User-Agent": user_agent}
    resp = safe_requests_get(url, headers, timeout)
    soup = BeautifulSoup(resp.text, "html.parser")
    results = None

    # Extraction logic
    if extract == "links":
        results = [urljoin(url, a.get("href")) for a in soup.find_all("a", href=True)]
    elif extract == "images":
        results = [urljoin(url, img.get("src")) for img in soup.find_all("img", src=True)]
    elif extract and extract.startswith("attr:"):
        attr = extract.split(":", 1)[1]
        if selector:
            elements = soup.select(selector)
            results = [el.get(attr) for el in elements if el.get(attr)]
        else:
            results = [el.get(attr) for el in soup.find_all(attrs={attr: True})]
    elif selector:
        elements = soup.select(selector)
        results = [el.get_text(strip=True) for el in elements]
    else:
        results = resp.text

    metadata = extract_metadata(soup) if include_metadata else None
    html_preview = resp.text[:3000] if not selector else None

    return {
        "results": results,
        "metadata": metadata,
        "html_preview": html_preview,
    }

@app.get("/scrape")
def scrape(
    request: Request,
    url: str = Query(..., description="URL to scrape"),
    selector: Optional[str] = Query(None, description="CSS selector"),
    extract: Optional[str] = Query(None, description="Extraction type: links, images, attr:href, etc."),
    includeMetadata: Optional[bool] = Query(False, description="Include metadata (meta, og, twitter, canonical)"),
    followLinks: Optional[bool] = Query(False, description="Follow links one level deep"),
    maxDepth: Optional[int] = Query(1, ge=1, le=2, description="Crawl depth (max 2 for safety)"),
    timeout: Optional[int] = Query(30, ge=5, le=60),
    userAgent: Optional[str] = Query("Mozilla/5.0 (Custom Scraper)")
):
    ip = request.client.host
    check_rate_limit(ip)
    if not is_valid_url(url):
        raise HTTPException(status_code=400, detail="Invalid URL")

    output = []
    # Main page
    page = scrape_page(url, selector, extract, includeMetadata, userAgent, timeout)
    output.append({"url": url, **page})

    # Optionally follow links (only 1 extra level for demo/safety)
    if followLinks and maxDepth > 1 and (extract == "links" or (selector and not extract)):
        links = []
        if extract == "links":
            links = page["results"] if isinstance(page["results"], list) else []
        elif selector:
            soup = BeautifulSoup(page.get("html_preview") or "", "html.parser")
            links = [urljoin(url, a.get("href")) for a in soup.find_all("a", href=True)]
        links = links[:5]  # Limit for safety
        for link in links:
            if is_valid_url(link):
                try:
                    sub_page = scrape_page(link, selector, extract, includeMetadata, userAgent, timeout)
                    output.append({"url": link, **sub_page})
                except Exception:
                    continue

    return {"pages": output}

@app.get("/headers")
def headers(url: str = Query(..., description="URL to fetch headers for")):
    if not is_valid_url(url):
        raise HTTPException(status_code=400, detail="Invalid URL")
    try:
        resp = requests.head(url, allow_redirects=True)
        return {"headers": dict(resp.headers)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Header fetch failed: {str(e)}")

@app.get("/health")
def health():
    return {"status": "ok"}