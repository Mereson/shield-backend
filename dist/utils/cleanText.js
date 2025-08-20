// Advanced text cleaning function with comprehensive sanitization
export const cleanText = (text) => {
    if (!text || typeof text !== "string")
        return "";
    let cleaned = text;
    // Step 1: Remove HTML tags and scripts
    cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
    cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
    cleaned = cleaned.replace(/<[^>]+>/g, "");
    // Step 2: Decode HTML entities
    const htmlEntities = {
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&#x27;": "'",
        "&#x2F;": "/",
        "&#x60;": "`",
        "&#x3D;": "=",
        "&nbsp;": " ",
        "&ndash;": "-",
        "&mdash;": "—",
        "&lsquo;": "'",
        "&rsquo;": "'",
        "&ldquo;": '"',
        "&rdquo;": '"',
        "&hellip;": "…",
        "&copy;": "©",
        "&reg;": "®",
        "&trade;": "™",
        "&euro;": "€",
        "&pound;": "£",
        "&yen;": "¥",
        "&cent;": "¢",
    };
    // Replace common HTML entities
    Object.keys(htmlEntities).forEach((entity) => {
        const regex = new RegExp(entity, "gi");
        cleaned = cleaned.replace(regex, htmlEntities[entity]);
    });
    // Handle numeric HTML entities (&#123; or &#x1A;)
    cleaned = cleaned.replace(/&#(\d+);/g, (match, dec) => {
        try {
            return String.fromCharCode(parseInt(dec, 10));
        }
        catch {
            return "";
        }
    });
    cleaned = cleaned.replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
        try {
            return String.fromCharCode(parseInt(hex, 16));
        }
        catch {
            return "";
        }
    });
    // Step 3: Remove news-specific unwanted patterns
    const unwantedPatterns = [
        /\b\d+\s+(hours?|minutes?|days?|weeks?|months?|years?)\s+ago\b/gi,
        /\b(published|updated|posted|shared|by)\s+\d+[/-]\d+[/-]\d+/gi,
        /\b(source|photo|image|video|credit):\s*[^\n\r.]*/gi,
        /\b(reuters|ap|afp|getty|bloomberg|associated press)\s*[-–—]\s*/gi,
        /\b(read more|continue reading|full story|click here|learn more)\b.*$/gi,
        /\b(advertisement|sponsored content|promoted|ad)\b.*$/gi,
        /\|\s*[^|]*\s*$/g, // Remove trailing pipe separators (common in news titles)
        /^[^|]*\|\s*/g, // Remove leading pipe separators
        /\s*[-–—]\s*[^-–—]*\s*$/g, // Remove trailing source attribution after dash
        /^\s*[-–—]\s*/g, // Remove leading dashes
    ];
    unwantedPatterns.forEach((pattern) => {
        cleaned = cleaned.replace(pattern, "");
    });
    // Step 4: Remove common social media and web artifacts
    const webArtifacts = [
        /\b(facebook|twitter|instagram|linkedin|youtube|tiktok|share|tweet|like|follow)\b/gi,
        /\b(cookies?|privacy policy|terms of service|subscribe|newsletter)\b/gi,
        /\b(javascript|css|browser|enable|disable|update)\b.*$/gi,
        /\b(404|error|not found|page not found)\b/gi,
        /\bwww\.[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, // Remove URLs
        /\bhttps?:\/\/[^\s]+/g, // Remove full URLs
        /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, // Remove email addresses
    ];
    webArtifacts.forEach((pattern) => {
        cleaned = cleaned.replace(pattern, "");
    });
    // Step 5: Fix spacing and punctuation
    // Remove multiple spaces
    cleaned = cleaned.replace(/\s{2,}/g, " ");
    // Fix spacing around punctuation
    cleaned = cleaned.replace(/\s+([.!?,:;])/g, "$1");
    cleaned = cleaned.replace(/([.!?])\s*([a-zA-Z])/g, "$1 $2");
    // Remove orphaned punctuation at the beginning
    cleaned = cleaned.replace(/^[.,:;!?\-–—\s]+/, "");
    // Remove orphaned punctuation at the end (except proper sentence endings)
    cleaned = cleaned.replace(/[,:;\-–—\s]+$/, "");
    // Step 6: Handle quotes and formatting
    // Fix smart quotes
    cleaned = cleaned.replace(/[""]/g, '"');
    cleaned = cleaned.replace(/['']/g, "'");
    // Remove unmatched quotes at start/end
    cleaned = cleaned.replace(/^["']+|["']+$/g, "");
    // Step 7: Remove weird characters and control characters
    // Remove zero-width characters
    cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, "");
    // Remove other control characters but keep basic formatting
    cleaned = cleaned.replace(/[\r\n\t\u007F]/g, "");
    // Step 8: Handle line breaks and paragraphs
    // Convert multiple line breaks to single space
    cleaned = cleaned.replace(/\n\s*\n/g, " ");
    cleaned = cleaned.replace(/[\r\n]/g, " ");
    // Step 9: Remove numbers-only strings that are likely timestamps or IDs
    cleaned = cleaned.replace(/\b\d{10,}\b/g, ""); // Remove long number sequences
    // Step 10: Final cleanup
    // Trim and normalize
    cleaned = cleaned.trim();
    // Remove if too short or only punctuation
    if (cleaned.length < 5 || /^[^a-zA-Z0-9]*$/.test(cleaned)) {
        return "";
    }
    // Capitalize first letter if it's lowercase
    if (cleaned.length > 0 && cleaned[0] === cleaned[0].toLowerCase()) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    // Ensure proper sentence ending
    if (cleaned.length > 0 && !/[.!?]$/.test(cleaned)) {
        // Only add period if it looks like a complete sentence
        if (cleaned.split(" ").length > 3) {
            cleaned += ".";
        }
    }
    return cleaned;
};
// Enhanced version with domain-specific cleaning for news
export const cleanNewsText = (text, type = "general") => {
    let cleaned = cleanText(text);
    if (type === "title") {
        // Title-specific cleaning
        // Remove common title prefixes
        cleaned = cleaned.replace(/^(breaking|urgent|update|exclusive|alert|news|report):\s*/gi, "");
        // Remove source attribution from titles
        cleaned = cleaned.replace(/\s*[-–—]\s*(reuters|ap|afp|cnn|bbc|fox|nbc|abc|cbs).*$/gi, "");
        // Remove brackets with source info
        cleaned = cleaned.replace(/\s*\([^)]*\)\s*$/g, "");
        // Ensure title doesn't end with period (news style)
        cleaned = cleaned.replace(/\.$/, "");
    }
    else if (type === "description") {
        // Description-specific cleaning
        // Remove read more prompts
        cleaned = cleaned.replace(/\b(read more|full story|continue reading).*$/gi, "");
        // Remove bylines
        cleaned = cleaned.replace(/^by\s+[^.]*\.\s*/gi, "");
        // Remove date stamps at beginning
        cleaned = cleaned.replace(/^\w+,?\s+\w+\s+\d+,?\s+\d+\s*[-–—]?\s*/gi, "");
    }
    return cleaned;
};
// Ultra-robust version that handles edge cases
export const superCleanText = (text, options = {}) => {
    const { maxLength = 1000, minLength = 5, removeNumbers = false, preserveFormatting = false, strictMode = false, } = options;
    if (!text || typeof text !== "string")
        return "";
    let cleaned = text;
    // Apply base cleaning
    cleaned = cleanText(cleaned);
    if (strictMode) {
        // Extra strict cleaning for sensitive contexts
        // Remove any remaining suspicious patterns
        const suspiciousPatterns = [
            /\b(click|tap|swipe|scroll|download|install|buy|purchase|order|call now)\b/gi,
            /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, // Phone numbers
            /\$\d+\.?\d*/g, // Prices
            /\b(free|deal|offer|sale|discount|limited time)\b/gi,
        ];
        suspiciousPatterns.forEach((pattern) => {
            cleaned = cleaned.replace(pattern, "");
        });
    }
    if (removeNumbers) {
        cleaned = cleaned.replace(/\b\d+\b/g, "");
    }
    if (!preserveFormatting) {
        // Remove all formatting characters
        cleaned = cleaned.replace(/[*_~`]/g, "");
    }
    // Apply length constraints
    if (cleaned.length > maxLength) {
        // Smart truncation at word boundary
        cleaned = cleaned.substring(0, maxLength);
        const lastSpace = cleaned.lastIndexOf(" ");
        if (lastSpace > maxLength * 0.8) {
            cleaned = cleaned.substring(0, lastSpace);
        }
        cleaned = cleaned.trim() + "...";
    }
    if (cleaned.length < minLength) {
        return "";
    }
    return cleaned;
};
//# sourceMappingURL=cleanText.js.map