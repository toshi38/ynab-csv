/**
 * ConfigMatcher - Auto-matching configuration system for YNAB-CSV
 *
 * Stores and matches file configurations based on headers and filename patterns.
 * When users upload files, this module attempts to find matching saved configurations
 * and auto-apply column mappings.
 */
var ConfigMatcher = (function () {
  "use strict";

  var STORAGE_KEY = "knownConfigurations";

  // ============================================
  // Storage helpers
  // ============================================

  function getStorageData() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { configs: {} };
    }
    try {
      var parsed = JSON.parse(stored);
      return parsed && parsed.configs ? parsed : { configs: {} };
    } catch (e) {
      console.warn("ConfigMatcher: Failed to parse stored configs", e);
      return { configs: {} };
    }
  }

  function saveStorageData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn("ConfigMatcher: Failed to save configs", e);
      return false;
    }
  }

  // ============================================
  // Fingerprint generation
  // ============================================

  /**
   * Generate a simple hash from a string
   * @param {string} str - Input string
   * @returns {string} Hash string
   */
  function simpleHash(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      var char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return "fp_" + Math.abs(hash).toString(36);
  }

  /**
   * Generate a fingerprint from column headers
   * Headers are normalized (lowercase, trimmed) and sorted for consistent matching
   *
   * @param {string[]} headers - Array of column header names
   * @returns {string|null} Fingerprint string or null if invalid input
   */
  function generateFingerprint(headers) {
    if (!headers || !Array.isArray(headers) || headers.length === 0) {
      return null;
    }

    // Normalize: lowercase, trim, filter empty, sort alphabetically
    var normalized = headers
      .map(function (h) {
        return String(h || "")
          .toLowerCase()
          .trim();
      })
      .filter(function (h) {
        return h.length > 0;
      })
      .sort()
      .join("|");

    if (normalized.length === 0) {
      return null;
    }

    return simpleHash(normalized);
  }

  // ============================================
  // Filename pattern extraction
  // ============================================

  /**
   * Extract meaningful patterns from a filename
   * Removes dates, numbers, extensions, and splits into words
   *
   * @param {string} filename - File name
   * @returns {string[]} Array of extracted patterns
   */
  function extractFilenamePatterns(filename) {
    if (!filename || typeof filename !== "string") {
      return [];
    }

    // Remove extension
    var base = filename.replace(/\.(csv|xlsx?|xlsm|xlsb)$/i, "");

    // Remove dates and long numbers (4+ digits)
    base = base.replace(/[-_]?\d{4,}/g, "");

    // Remove (1), (2), etc.
    base = base.replace(/\(\d+\)/g, "");

    // Convert to lowercase
    base = base.toLowerCase();

    // Split into words on common separators
    var patterns = base
      .split(/[-_\s.]+/)
      .filter(function (p) {
        return p.length > 2; // Skip very short patterns
      })
      .slice(0, 5); // Max 5 patterns

    return patterns;
  }

  // ============================================
  // Header extraction from raw content
  // ============================================

  /**
   * Extract headers from raw CSV content at a specific row
   *
   * @param {string} content - Raw CSV content
   * @param {number} startAtRow - Row number where headers are (1-indexed)
   * @param {string} delimiter - Delimiter to use (or auto-detect)
   * @returns {string[]} Array of header names
   */
  function extractHeadersFromContent(content, startAtRow, delimiter) {
    if (!content || typeof content !== "string") {
      return [];
    }

    startAtRow = startAtRow || 1;

    // Use PapaParse with same transformHeader logic as data_object.js
    // This ensures headers match what gets saved in configs
    var existingHeaders = [];
    var config = {
      header: true,
      skipEmptyLines: true,
      preview: 1, // Only parse first row for headers
      beforeFirstChunk: function (chunk) {
        var rows = chunk.split("\n");
        var startIndex = startAtRow - 1;
        rows = rows.slice(startIndex);
        return rows.join("\n");
      },
      transformHeader: function (header) {
        if (header.trim().length === 0) {
          header = "Unnamed column";
        }
        if (existingHeaders.indexOf(header) !== -1) {
          var newHeader = header;
          var counter = 0;
          while (existingHeaders.indexOf(newHeader) !== -1) {
            counter++;
            newHeader = header + " (" + counter + ")";
          }
          header = newHeader;
        }
        existingHeaders.push(header);
        return header;
      },
    };

    if (delimiter && delimiter !== "auto") {
      config.delimiter = delimiter;
    }

    try {
      var result = Papa.parse(content, config);
      if (result && result.meta && result.meta.fields) {
        return result.meta.fields;
      }
    } catch (e) {
      console.error("Error parsing headers:", e);
    }

    return [];
  }

  // ============================================
  // Matching algorithm
  // ============================================

  /**
   * Calculate Jaccard similarity between two sets
   *
   * @param {Set} set1
   * @param {Set} set2
   * @returns {number} Similarity score 0-100
   */
  function jaccardSimilarity(set1, set2) {
    if (set1.size === 0 && set2.size === 0) {
      return 100;
    }
    if (set1.size === 0 || set2.size === 0) {
      return 0;
    }

    var intersection = 0;
    set1.forEach(function (item) {
      if (set2.has(item)) {
        intersection++;
      }
    });

    var union = new Set();
    set1.forEach(function (item) {
      union.add(item);
    });
    set2.forEach(function (item) {
      union.add(item);
    });

    return Math.round((intersection / union.size) * 100);
  }

  /**
   * Find a partial header match among saved configs
   *
   * @param {string[]} headers - Headers to match
   * @param {Object} configs - Saved configurations
   * @returns {Object|null} Match result or null
   */
  function findPartialHeaderMatch(headers, configs) {
    var normalizedHeaders = new Set(
      headers.map(function (h) {
        return String(h || "")
          .toLowerCase()
          .trim();
      }),
    );

    var bestMatch = null;
    var bestScore = 0;

    Object.keys(configs).forEach(function (id) {
      var config = configs[id];

      // Get original headers from chosenColumns values
      var configHeaders = new Set();
      Object.values(config.chosenColumns || {}).forEach(function (v) {
        if (v) {
          configHeaders.add(String(v).toLowerCase().trim());
        }
      });

      // Also include headers from the original file if stored
      if (config.originalHeaders && Array.isArray(config.originalHeaders)) {
        config.originalHeaders.forEach(function (h) {
          configHeaders.add(String(h).toLowerCase().trim());
        });
      }

      var similarity = jaccardSimilarity(normalizedHeaders, configHeaders);

      if (similarity > bestScore && similarity >= 70) {
        bestScore = similarity;
        bestMatch = {
          configId: id,
          matchType: "partial",
          confidence: similarity,
          config: config,
        };
      }
    });

    return bestMatch;
  }

  /**
   * Find a filename pattern match among saved configs
   *
   * @param {string[]} patterns - Patterns from current filename
   * @param {Object} configs - Saved configurations
   * @returns {Object|null} Match result or null
   */
  function findFilenameMatch(patterns, configs) {
    if (!patterns || patterns.length === 0) {
      return null;
    }

    var bestMatch = null;
    var bestMatchCount = 0;

    Object.keys(configs).forEach(function (id) {
      var config = configs[id];
      var configPatterns = config.filenamePatterns || [];

      if (configPatterns.length === 0) {
        return;
      }

      // Count matching patterns
      var matchCount = 0;
      patterns.forEach(function (p) {
        configPatterns.forEach(function (cp) {
          if (cp.includes(p) || p.includes(cp)) {
            matchCount++;
          }
        });
      });

      // Require at least one matching pattern and reasonable overlap
      if (matchCount > 0 && matchCount > bestMatchCount) {
        bestMatchCount = matchCount;
        bestMatch = {
          configId: id,
          matchType: "filename_only",
          confidence: 60,
          config: config,
        };
      }
    });

    return bestMatch;
  }

  /**
   * Find a matching configuration for the given headers and filename
   *
   * @param {string[]} headers - Column headers from the file
   * @param {string} filename - Name of the file
   * @returns {Object|null} Match result with configId, matchType, confidence, config
   */
  function findMatchingConfig(headers, filename) {
    var data = getStorageData();
    var configs = data.configs;

    if (Object.keys(configs).length === 0) {
      return null;
    }

    // Try exact fingerprint match first
    var fingerprint = generateFingerprint(headers);
    if (fingerprint && configs[fingerprint]) {
      return {
        configId: fingerprint,
        matchType: "exact",
        confidence: 100,
        config: configs[fingerprint],
      };
    }

    // Try partial header match
    var partialMatch = findPartialHeaderMatch(headers, configs);
    if (partialMatch && partialMatch.confidence >= 80) {
      return partialMatch;
    }

    // Try filename pattern match
    var filenamePatterns = extractFilenamePatterns(filename);
    var filenameMatch = findFilenameMatch(filenamePatterns, configs);

    // Return best available match
    if (partialMatch && partialMatch.confidence >= 70) {
      return partialMatch;
    }

    return filenameMatch;
  }

  /**
   * Find matching config trying different startAtRow values
   * This handles files where headers are not on line 1
   *
   * @param {string} content - Raw file content
   * @param {string} filename - Filename
   * @param {string} delimiter - Delimiter (or "auto")
   * @returns {Object|null} Match result with startAtRow included
   */
  function findMatchingConfigWithStartRow(content, filename, delimiter) {
    var data = getStorageData();
    var configs = data.configs;

    if (Object.keys(configs).length === 0) {
      return null;
    }

    // Collect unique startAtRow values from saved configs
    var startAtRows = new Set([1]); // Always try row 1
    Object.values(configs).forEach(function (config) {
      if (config.startAtRow && config.startAtRow > 1) {
        startAtRows.add(config.startAtRow);
      }
    });

    // Try each startAtRow value
    var bestMatch = null;

    startAtRows.forEach(function (startAtRow) {
      var headers = extractHeadersFromContent(content, startAtRow, delimiter);
      if (headers.length === 0) {
        return;
      }

      var match = findMatchingConfig(headers, filename);
      if (match) {
        // Prefer higher confidence matches
        if (
          !bestMatch ||
          match.confidence > bestMatch.confidence ||
          (match.confidence === bestMatch.confidence &&
            match.matchType === "exact")
        ) {
          bestMatch = match;
          bestMatch.detectedStartAtRow = startAtRow;
        }
      }
    });

    return bestMatch;
  }

  // ============================================
  // CRUD operations
  // ============================================

  /**
   * Generate a default name from filename
   *
   * @param {string} filename
   * @returns {string}
   */
  function generateDefaultName(filename) {
    if (!filename) {
      return "Unnamed Configuration";
    }

    var base = filename.replace(/\.(csv|xlsx?|xlsm|xlsb)$/i, "");
    base = base
      .replace(/[-_]?\d{4,}/g, "")
      .replace(/\(\d+\)/g, "")
      .trim();

    return base || "Unnamed Configuration";
  }

  /**
   * Save a new configuration
   *
   * @param {string[]} headers - Column headers
   * @param {string} filename - Original filename
   * @param {Object} settings - Settings object with columnFormat, chosenColumns, etc.
   * @param {string} [name] - Optional custom name
   * @returns {string|null} Config ID (fingerprint) or null on failure
   */
  function saveConfiguration(headers, filename, settings, name) {
    var fingerprint = generateFingerprint(headers);
    if (!fingerprint) {
      return null;
    }

    var data = getStorageData();
    var now = new Date().toISOString();
    var existingConfig = data.configs[fingerprint];

    data.configs[fingerprint] = {
      id: fingerprint,
      name:
        name ||
        (existingConfig ? existingConfig.name : generateDefaultName(filename)),
      fingerprint: fingerprint,
      filenamePatterns: extractFilenamePatterns(filename),
      originalHeaders: headers.slice(), // Store original headers for partial matching
      columnFormat: settings.columnFormat,
      chosenColumns: settings.chosenColumns,
      chosenEncoding: settings.chosenEncoding || "UTF-8",
      chosenDelimiter: settings.chosenDelimiter || "auto",
      startAtRow: settings.startAtRow || 1,
      extraRow: settings.extraRow || false,
      invertedOutflow: settings.invertedOutflow || false,
      invertedAmount: settings.invertedAmount || false,
      fixDates: settings.fixDates || false,
      createdAt: existingConfig ? existingConfig.createdAt : now,
      lastUsed: now,
      useCount: (existingConfig ? existingConfig.useCount : 0) + 1,
    };

    if (saveStorageData(data)) {
      return fingerprint;
    }
    return null;
  }

  /**
   * Update an existing configuration
   *
   * @param {string} configId - Config ID to update
   * @param {Object} updates - Fields to update
   * @returns {boolean} Success
   */
  function updateConfiguration(configId, updates) {
    var data = getStorageData();

    if (!data.configs[configId]) {
      return false;
    }

    // Merge updates
    Object.keys(updates).forEach(function (key) {
      data.configs[configId][key] = updates[key];
    });

    data.configs[configId].lastUsed = new Date().toISOString();

    return saveStorageData(data);
  }

  /**
   * Delete a configuration
   *
   * @param {string} configId - Config ID to delete
   * @returns {boolean} Success
   */
  function deleteConfiguration(configId) {
    var data = getStorageData();

    if (!data.configs[configId]) {
      return false;
    }

    delete data.configs[configId];
    return saveStorageData(data);
  }

  /**
   * Rename a configuration
   *
   * @param {string} configId - Config ID to rename
   * @param {string} newName - New name
   * @returns {boolean} Success
   */
  function renameConfiguration(configId, newName) {
    return updateConfiguration(configId, { name: newName });
  }

  /**
   * Get all saved configurations
   *
   * @returns {Object} Object with config IDs as keys
   */
  function getAllConfigurations() {
    return getStorageData().configs;
  }

  /**
   * Get a specific configuration
   *
   * @param {string} configId - Config ID
   * @returns {Object|null} Configuration or null
   */
  function getConfiguration(configId) {
    return getStorageData().configs[configId] || null;
  }

  /**
   * Increment usage count for a configuration
   *
   * @param {string} configId - Config ID
   * @returns {boolean} Success
   */
  function incrementUsageCount(configId) {
    var data = getStorageData();
    var config = data.configs[configId];

    if (!config) {
      return false;
    }

    config.useCount = (config.useCount || 0) + 1;
    config.lastUsed = new Date().toISOString();

    return saveStorageData(data);
  }

  // ============================================
  // Public API
  // ============================================

  return {
    // Fingerprint and pattern extraction
    generateFingerprint: generateFingerprint,
    extractFilenamePatterns: extractFilenamePatterns,
    extractHeadersFromContent: extractHeadersFromContent,

    // Matching
    findMatchingConfig: findMatchingConfig,
    findMatchingConfigWithStartRow: findMatchingConfigWithStartRow,

    // CRUD
    saveConfiguration: saveConfiguration,
    updateConfiguration: updateConfiguration,
    deleteConfiguration: deleteConfiguration,
    renameConfiguration: renameConfiguration,
    getAllConfigurations: getAllConfigurations,
    getConfiguration: getConfiguration,
    incrementUsageCount: incrementUsageCount,

    // For testing
    _getStorageData: getStorageData,
    _simpleHash: simpleHash,
    _jaccardSimilarity: jaccardSimilarity,
  };
})();

// Export for Node.js/testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = ConfigMatcher;
}
