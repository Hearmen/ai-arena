/**
 * AI Arena — Background Service Worker (MV3)
 *
 * Handles CSP relaxation for host pages so that the side panel iframe
 * (loading kimi.com, doubao.com, etc.) is not blocked by the host's
 * Content-Security-Policy frame-src directive.
 */

const HOST_URL_PATTERNS = [
  'https://chatgpt.com/*',
  'https://gemini.google.com/*',
  'https://kimi.com/*',
  'https://www.kimi.com/*',
  'https://www.doubao.com/*',
];

const CSP_HEADER_NAMES = [
  'content-security-policy',
  'content-security-policy-report-only',
];

/**
 * Relaxes the frame-src directive in CSP headers to allow loading
 * AI panel iframes (kimi.com, doubao.com, gemini.google.com).
 */
function relaxCspFrameSrc(headers) {
  return headers.map((header) => {
    const nameLower = header.name.toLowerCase();
    if (!CSP_HEADER_NAMES.includes(nameLower)) {
      return header;
    }

    let csp = header.value;

    // If there's a frame-src directive, append allowed origins
    if (/frame-src/i.test(csp)) {
      csp = csp.replace(
        /frame-src\s+([^;]+);/gi,
        'frame-src $1 https://kimi.com https://www.kimi.com https://www.doubao.com https://gemini.google.com;'
      );
    } else {
      // No frame-src directive; add one before the first directive or at the end
      const allowed = 'frame-src https://kimi.com https://www.kimi.com https://www.doubao.com https://gemini.google.com;';
      // Try to insert after the first directive for readability
      const firstSemi = csp.indexOf(';');
      if (firstSemi !== -1) {
        csp = csp.slice(0, firstSemi + 1) + ' ' + allowed + csp.slice(firstSemi + 1);
      } else {
        csp = csp + ' ' + allowed;
      }
    }

    return { name: header.name, value: csp };
  });
}

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (!details.responseHeaders) {
      return;
    }
    const hasCsp = details.responseHeaders.some(
      (h) => CSP_HEADER_NAMES.includes(h.name.toLowerCase())
    );
    if (!hasCsp) {
      return;
    }

    return {
      responseHeaders: relaxCspFrameSrc(details.responseHeaders),
    };
  },
  {
    urls: HOST_URL_PATTERNS,
    types: ['main_frame', 'sub_frame'],
  },
  ['responseHeaders', 'extraHeaders']
);

console.log('[AI Arena] Background service worker started');
