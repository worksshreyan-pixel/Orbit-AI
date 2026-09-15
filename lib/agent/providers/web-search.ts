import dns from 'dns';
import { promisify } from 'util';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface WebSearchProvider {
  search(query: string, maxResults?: number): Promise<SearchResult[]>;
  read(url: string): Promise<{ title: string; url: string; content: string; source: string; }>;
}

const lookup = promisify(dns.lookup);

async function isSafeUrl(urlString: string): Promise<boolean> {
  try {
    const url = new URL(urlString);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    
    const hostname = url.hostname.toLowerCase();
    
    // Quick string checks
    if (
      hostname === 'localhost' ||
      hostname.includes('127.0.0.1') ||
      hostname.includes('[::1]') ||
      hostname.includes('internal') ||
      hostname.includes('metadata') ||
      hostname.includes('169.254.169.254')
    ) {
      return false;
    }

    // Attempt IP resolution for Node environments
    try {
      const { address } = await lookup(hostname);
      const parts = address.split('.').map(Number);
      
      // IPv4 private ranges
      if (parts.length === 4) {
        if (parts[0] === 10) return false;
        if (parts[0] === 127) return false;
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
        if (parts[0] === 192 && parts[1] === 168) return false;
        if (parts[0] === 169 && parts[1] === 254) return false;
      }
    } catch (dnsError) {
      // If DNS fails, it's either an invalid host or Edge runtime where dns is missing.
      // We will allow the fetch to attempt, relying on the string checks above.
    }
    
    return true;
  } catch (e) {
    return false;
  }
}

export const defaultWebSearchProvider: WebSearchProvider = {
  async search(query: string, maxResults: number = 5): Promise<SearchResult[]> {
    try {
      // DuckDuckGo HTML parsing approach for zero-config research
      const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Search request failed with status: ${response.status}`);
      }
      
      const html = await response.text();
      
      const results: SearchResult[] = [];
      const resultBlockRegex = /<a class="result__url" href="([^"]+)"[\s\S]*?>\s*([\s\S]*?)\s*<\/a>[\s\S]*?<a class="result__snippet[^>]*>\s*([\s\S]*?)\s*<\/a>/gi;
      
      let match;
      while ((match = resultBlockRegex.exec(html)) !== null && results.length < maxResults) {
        let url = match[1];
        if (url.startsWith('//')) {
          const urlObj = new URL('https:' + url);
          const uddg = urlObj.searchParams.get('uddg');
          if (uddg) url = uddg;
        }
        
        let title = match[2].replace(/<\/?[^>]+(>|$)/g, '').trim(); // Strip tags
        let snippet = match[3].replace(/<\/?[^>]+(>|$)/g, '').trim(); // Strip tags
        
        // decode html entities naive
        title = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        snippet = snippet.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

        results.push({
          title,
          url,
          snippet,
          source: new URL(url).hostname
        });
      }
      
      return results;
    } catch (err: any) {
      throw new Error(`Web search failed: ${err.message}`);
    }
  },

  async read(url: string): Promise<{ title: string; url: string; content: string; source: string; }> {
    if (!(await isSafeUrl(url))) {
      throw new Error('Access to this URL is blocked for security reasons.');
    }

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch URL with status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
        throw new Error('Unsupported content type. Can only read HTML or Text.');
      }

      let html = await response.text();

      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : 'Unknown Title';

      // Very simple tag stripping for context
      // Strip script and style blocks entirely
      html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
      html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
      
      // Replace typical structural block tags with newlines
      html = html.replace(/<\/?(?:div|p|br|h[1-6]|li|tr)[^>]*>/gi, '\n');
      
      // Strip all other tags
      let text = html.replace(/<\/?[^>]+(>|$)/g, ' ');
      
      // Clean up whitespace
      text = text.replace(/&nbsp;/g, ' ');
      text = text.replace(/[ \t]+/g, ' ');
      text = text.replace(/\n\s*\n+/g, '\n\n');
      text = text.trim();

      // Decode entities
      text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

      // Truncate to reasonable length (e.g., 12000 chars) to prevent context bloat
      if (text.length > 12000) {
        text = text.substring(0, 12000) + '\n\n[CONTENT TRUNCATED FOR LENGTH]';
      }

      return {
        title,
        url,
        content: text,
        source: new URL(url).hostname
      };
    } catch (err: any) {
      throw new Error(`Failed to read web source: ${err.message}`);
    }
  }
};
