"use client";
import React, { useState, useEffect } from "react";

export default function Home() {
  // State variables
  const [url, setUrl] = useState("");
  const [selector, setSelector] = useState("");
  const [result, setResult] = useState<string[] | string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showSelectorHelper, setShowSelectorHelper] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showMeta, setShowMeta] = useState(false);
  const [metaTags, setMetaTags] = useState<any[]>([]);
  const [showHeaders, setShowHeaders] = useState(false);
  const [headers, setHeaders] = useState<Record<string, string>>({});
  const [config, setConfig] = useState({
    includeMetadata: false,
    followLinks: false,
    maxDepth: 1,
    timeout: 30,
    userAgent: "Mozilla/5.0 (Custom Scraper)",
  });

  // For advanced meta/og/twitter/canonical display
  const [ogTags, setOgTags] = useState<any[]>([]);
  const [twitterTags, setTwitterTags] = useState<any[]>([]);
  const [canonical, setCanonical] = useState<string | null>(null);
  const [htmlPreview, setHtmlPreview] = useState<string | null>(null);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Scraper call
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    setHtmlPreview(null);

    try {
      const params = new URLSearchParams({
        url,
        selector,
        includeMetadata: String(config.includeMetadata),
        followLinks: String(config.followLinks),
        maxDepth: String(config.maxDepth),
        timeout: String(config.timeout),
        userAgent: config.userAgent,
      });

      const res = await fetch(
        `http://localhost:8000/scrape?${params.toString()}`
      );
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setToast({ msg: "Scraping failed!", type: "error" });
      } else if (data.pages && data.pages.length > 0) {
        setResult(data.pages[0].results);
        setHtmlPreview(data.pages[0].html_preview || null);

        // If metadata included, update all types
        if (data.pages[0].metadata) {
          setMetaTags(data.pages[0].metadata.meta || []);
          setOgTags(data.pages[0].metadata.og || []);
          setTwitterTags(data.pages[0].metadata.twitter || []);
          setCanonical(data.pages[0].metadata.canonical || null);
        } else {
          setMetaTags([]);
          setOgTags([]);
          setTwitterTags([]);
          setCanonical(null);
        }

        setToast({ msg: "Scraping complete!", type: "success" });
      } else {
        setError("No results returned.");
      }
    } catch {
      setError("Failed to fetch. Is the backend running?");
      setToast({ msg: "Network error!", type: "error" });
    }
    setLoading(false);
  };

  // Export logic
  function exportResult(type: "txt" | "json" | "csv") {
    if (!result) return;
    let data = "";
    let filename = "scrape-result." + type;
    if (type === "json") {
      data = JSON.stringify(result, null, 2);
    } else if (type === "csv") {
      if (Array.isArray(result)) {
        data = result.map(x => `"${x.replace(/"/g, '""')}"`).join("\n");
      } else {
        data = `"${(result as string).replace(/"/g, '""')}"`;
      }
    } else {
      data = Array.isArray(result) ? result.join("\n") : result;
    }
    const blob = new Blob([data], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);
  }

  // Meta Tag Extractor - now uses backend meta extraction for accuracy!
  async function fetchMetaTags() {
    if (!url) return;
    setShowMeta(true);
    setMetaTags([]);
    setOgTags([]);
    setTwitterTags([]);
    setCanonical(null);
    setToast(null);
    try {
      const res = await fetch(`http://localhost:8000/scrape?url=${encodeURIComponent(url)}&includeMetadata=true`);
      const data = await res.json();
      if (data.pages && data.pages.length > 0 && data.pages[0].metadata) {
        setMetaTags(data.pages[0].metadata.meta || []);
        setOgTags(data.pages[0].metadata.og || []);
        setTwitterTags(data.pages[0].metadata.twitter || []);
        setCanonical(data.pages[0].metadata.canonical || null);
      } else {
        setMetaTags([]);
        setOgTags([]);
        setTwitterTags([]);
        setCanonical(null);
        setToast({ msg: "No meta tags found!", type: "info" });
      }
    } catch {
      setToast({ msg: "Failed to fetch meta tags.", type: "error" });
    }
  }

  // Header Fetcher
  async function fetchHeaders() {
    if (!url) return;
    setShowHeaders(true);
    setHeaders({});
    setToast(null);
    try {
      const res = await fetch(`http://localhost:8000/headers?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (data.headers) setHeaders(data.headers);
      else setToast({ msg: "No headers found!", type: "info" });
    } catch {
      setToast({ msg: "Failed to fetch headers.", type: "error" });
    }
  }

  // UI
  return (
    <div className="scraper-bg4">
      <div className="scraper-container4">
        <h1 className="scraper-title4">Modern Web Scraper</h1>
        <form onSubmit={handleSubmit} className="scraper-form4" autoComplete="off">
          <div className="scraper-label4">URL to Scrape</div>
          <div className="scraper-label-tip4">Enter a full website URL (e.g. https://example.com)</div>
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="scraper-input4"
            placeholder="https://example.com"
          />
          <div className="scraper-label4">CSS Selector <span style={{ color: "#3e54a3", fontWeight: 500 }}>(optional)</span></div>
          <div className="scraper-label-tip4">
            Use CSS selectors for targeted scraping. Leave blank to get the whole page.
          </div>
          <div className="scraper-input-row4">
            <input
              type="text"
              value={selector}
              onChange={(e) => setSelector(e.target.value)}
              className="scraper-input4"
              placeholder="e.g. h1, .class, #id"
              style={{ flex: 1 }}
            />
            <button type="button" className="scraper-helper-btn4" onClick={() => setShowSelectorHelper(true)}>
              Selector Helper
            </button>
          </div>
          <div className="scraper-actions4">
            <button type="button" className="scraper-btn4" onClick={() => setShowConfig(true)}>
              Config
            </button>
            <button type="button" className="scraper-btn4" onClick={fetchMetaTags}>
              Meta Tags
            </button>
            <button type="button" className="scraper-btn4" onClick={fetchHeaders}>
              Headers
            </button>
            <button type="submit" className="scraper-btn4 scraper-btn4-main" disabled={loading}>
              {loading ? <span className="scraper-spinner4"></span> : "Scrape"}
            </button>
          </div>
        </form>
        {error && (
          <div className="scraper-error4">{error}</div>
        )}

        {result && (
          <div className="scraper-result4">
            <div className="scraper-result-header4">
              <span>Results</span>
              <div>
                <button className="scraper-btn4 export" onClick={() => setShowExport(true)}>Export</button>
                <button className="scraper-btn4 copy" onClick={() => {
                  navigator.clipboard.writeText(Array.isArray(result) ? result.join('\n') : result as string);
                  setToast({ msg: "Copied to clipboard!", type: "success" });
                }}>
                  Copy
                </button>
              </div>
            </div>
            <div className="scraper-result-content4">
              {Array.isArray(result) ? (
                <ul>{result.map((text, i) => <li key={i}>{text}</li>)}</ul>
              ) : (
                <pre>{result}</pre>
              )}
            </div>
            {/* Optionally show HTML preview */}
            {htmlPreview && (
              <details style={{marginTop: "1em"}}>
                <summary style={{cursor: "pointer"}}>HTML Preview (first 3000 chars)</summary>
                <pre style={{maxHeight: "300px", overflow: "auto"}}>{htmlPreview}</pre>
              </details>
            )}
          </div>
        )}

        {/* Selector Helper Modal */}
        {showSelectorHelper && (
          <div className="scraper-modal-bg4" onClick={() => setShowSelectorHelper(false)}>
            <div className="scraper-modal4" onClick={e => e.stopPropagation()}>
              <button className="scraper-modal-close4" onClick={() => setShowSelectorHelper(false)}>✕</button>
              <h2>Selector Helper</h2>
              <div style={{ fontSize: 14, marginBottom: 12 }}>
                <strong>Tip:</strong> Use your browser's inspect tool to right-click any element and "Copy selector"!
              </div>
              <div className="scraper-html-preview4">
                <pre>{`<html>
  <body>
    <div>
      <h1>Main Title</h1>
      <p class="desc">Description here...</p>
      <a href="#">Link</a>
    </div>
  </body>
</html>`}</pre>
              </div>
              <button className="scraper-btn4" onClick={() => setShowSelectorHelper(false)}>Close</button>
            </div>
          </div>
        )}

        {/* Export Modal */}
        {showExport && (
          <div className="scraper-modal-bg4" onClick={() => setShowExport(false)}>
            <div className="scraper-modal4" onClick={e => e.stopPropagation()}>
              <button className="scraper-modal-close4" onClick={() => setShowExport(false)}>✕</button>
              <h2>Export Results As</h2>
              <div className="scraper-export-options4">
                <button onClick={() => exportResult("txt")}>TXT</button>
                <button onClick={() => exportResult("csv")}>CSV</button>
                <button onClick={() => exportResult("json")}>JSON</button>
              </div>
              <button className="scraper-btn4" onClick={() => setShowExport(false)}>Close</button>
            </div>
          </div>
        )}

        {/* Config Modal */}
        {showConfig && (
          <div className="scraper-modal-bg4" onClick={() => setShowConfig(false)}>
            <div className="scraper-modal4" onClick={e => e.stopPropagation()}>
              <button className="scraper-modal-close4" onClick={() => setShowConfig(false)}>✕</button>
              <h2>Scraper Configuration</h2>
              <div className="scraper-modal-content4">
                <label>
                  <span>Include Metadata</span>
                  <input
                    type="checkbox"
                    checked={config.includeMetadata}
                    onChange={(e) =>
                      setConfig({ ...config, includeMetadata: e.target.checked })
                    }
                  />
                </label>
                <label>
                  <span>Follow Links</span>
                  <input
                    type="checkbox"
                    checked={config.followLinks}
                    onChange={(e) =>
                      setConfig({ ...config, followLinks: e.target.checked })
                    }
                  />
                </label>
                <label>
                  <span>Max Depth</span>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={config.maxDepth}
                    onChange={(e) =>
                      setConfig({ ...config, maxDepth: parseInt(e.target.value) })
                    }
                  />
                </label>
                <label>
                  <span>Timeout (seconds)</span>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={config.timeout}
                    onChange={(e) =>
                      setConfig({ ...config, timeout: parseInt(e.target.value) })
                    }
                  />
                </label>
                <label>
                  <span>User-Agent</span>
                  <input
                    type="text"
                    value={config.userAgent}
                    onChange={(e) =>
                      setConfig({ ...config, userAgent: e.target.value })
                    }
                  />
                </label>
              </div>
              <button
                className="scraper-btn4 scraper-btn4-main"
                onClick={() => setShowConfig(false)}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Meta Tag Modal */}
        {showMeta && (
          <div className="scraper-modal-bg4" onClick={() => setShowMeta(false)}>
            <div className="scraper-modal4" onClick={e => e.stopPropagation()}>
              <button className="scraper-modal-close4" onClick={() => setShowMeta(false)}>✕</button>
              <h2>Meta Tags</h2>
              <div className="scraper-modal-content4">
                {metaTags.length === 0 && ogTags.length === 0 && twitterTags.length === 0 && !canonical && (
                  <div className="scraper-history-empty4">No meta tags found.</div>
                )}
                {metaTags.length > 0 && (
                  <div><strong>Meta:</strong>
                    <ul>
                      {metaTags.map((tag, i) => (
                        <li key={i}><b>{tag.name}:</b> {tag.content}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {ogTags.length > 0 && (
                  <div><strong>Open Graph:</strong>
                    <ul>
                      {ogTags.map((tag, i) => (
                        <li key={i}><b>{tag.property}:</b> {tag.content}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {twitterTags.length > 0 && (
                  <div><strong>Twitter:</strong>
                    <ul>
                      {twitterTags.map((tag, i) => (
                        <li key={i}><b>{tag.name}:</b> {tag.content}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {canonical && (
                  <div><strong>Canonical:</strong> {canonical}</div>
                )}
              </div>
              <button
                className="scraper-btn4 scraper-btn4-main"
                onClick={() => setShowMeta(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Headers Modal */}
        {showHeaders && (
          <div className="scraper-modal-bg4" onClick={() => setShowHeaders(false)}>
            <div className="scraper-modal4" onClick={e => e.stopPropagation()}>
              <button className="scraper-modal-close4" onClick={() => setShowHeaders(false)}>✕</button>
              <h2>HTTP Headers</h2>
              <div className="scraper-modal-content4">
                {Object.keys(headers).length === 0 && (
                  <div className="scraper-history-empty4">No headers found.</div>
                )}
                <ul>
                  {Object.entries(headers).map(([k, v], i) => (
                    <li key={i} className="scraper-history-item4">
                      <div><strong>{k}:</strong> {v}</div>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                className="scraper-btn4 scraper-btn4-main"
                onClick={() => setShowHeaders(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className={`scraper-toast4 scraper-toast4-${toast.type}`}>{toast.msg}</div>
        )}

        {/* Details Section */}
        <hr className="scraper-divider4" />
        <div className="scraper-section4">About & Features</div>
        <div className="scraper-intro4" style={{ fontSize: "1.06rem", margin: 0 }}>
          <ul>
            <li>
              <strong>What is this?</strong><br />
              Modern Web Scraper is a premium, privacy-friendly tool for extracting website content, meta tags, and headers.
            </li>
            <li>
              <strong>How does it work?</strong><br />
              Enter a URL and (optionally) a CSS selector. The scraper fetches the page and extracts data matching your selector, or the whole page if left blank.
            </li>
            <li>
              <strong>Features:</strong>
              <ul>
                <li><b>CSS Selector Helper</b>: Instantly get tips on writing selectors.</li>
                <li><b>Configurable</b>: Set metadata, follow links, max depth, timeout, and user-agent as you need.</li>
                <li><b>Meta Tag/Headers</b>: Inspect meta tags and HTTP headers of any web page.</li>
                <li><b>Export</b>: Download results in TXT, CSV, or JSON for your workflow.</li>
                <li><b>All processing is local or via your backend</b>; nothing is stored or shared.</li>
              </ul>
            </li>
            <li>
              <strong>Who is it for?</strong><br />
              Anyone needing a quick, beautiful, and flexible way to grab information from websites—students, researchers, and developers!
            </li>
            <li>
              <strong>How to use:</strong><br />
              1. Enter a URL.<br />
              2. (Optional) Add a CSS selector for specific content.<br />
              3. Adjust configuration as needed.<br />
              4. Scrape, review, and export your results or inspect meta/headers.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}