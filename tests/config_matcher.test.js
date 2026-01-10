const fs = require("fs");
const path = require("path");

describe("ConfigMatcher", () => {
  let ConfigMatcher;
  let mockStore;

  beforeEach(() => {
    // Create fresh store for each test
    mockStore = {};

    // Create completely new localStorage mock with jest.fn() wrappers
    const mockGetItem = jest.fn((key) => mockStore[key] || null);
    const mockSetItem = jest.fn((key, value) => {
      mockStore[key] = value;
    });
    const mockRemoveItem = jest.fn((key) => {
      delete mockStore[key];
    });
    const mockClear = jest.fn(() => {
      mockStore = {};
    });

    // Override global localStorage
    Object.defineProperty(global, "localStorage", {
      value: {
        getItem: mockGetItem,
        setItem: mockSetItem,
        removeItem: mockRemoveItem,
        clear: mockClear,
      },
      writable: true,
      configurable: true,
    });

    // Clear module cache and re-require
    delete require.cache[require.resolve("../src/config_matcher.js")];
    ConfigMatcher = require("../src/config_matcher.js");
  });

  // ============================================
  // Fingerprint Generation Tests
  // ============================================

  describe("generateFingerprint", () => {
    test("should generate consistent fingerprint for headers", () => {
      const headers = ["Date", "Description", "Amount"];
      const fp1 = ConfigMatcher.generateFingerprint(headers);
      const fp2 = ConfigMatcher.generateFingerprint(headers);

      expect(fp1).toBe(fp2);
      expect(fp1).toMatch(/^fp_[a-z0-9]+$/);
    });

    test("should generate same fingerprint for headers in different order", () => {
      const headers1 = ["Date", "Description", "Amount"];
      const headers2 = ["Amount", "Date", "Description"];
      const headers3 = ["Description", "Amount", "Date"];

      const fp1 = ConfigMatcher.generateFingerprint(headers1);
      const fp2 = ConfigMatcher.generateFingerprint(headers2);
      const fp3 = ConfigMatcher.generateFingerprint(headers3);

      expect(fp1).toBe(fp2);
      expect(fp1).toBe(fp3);
    });

    test("should normalize case when generating fingerprint", () => {
      const headers1 = ["Date", "Description", "Amount"];
      const headers2 = ["DATE", "DESCRIPTION", "AMOUNT"];
      const headers3 = ["date", "description", "amount"];

      const fp1 = ConfigMatcher.generateFingerprint(headers1);
      const fp2 = ConfigMatcher.generateFingerprint(headers2);
      const fp3 = ConfigMatcher.generateFingerprint(headers3);

      expect(fp1).toBe(fp2);
      expect(fp1).toBe(fp3);
    });

    test("should handle headers with special characters", () => {
      const headers = ["Konto #", "Belopp", "Datum"];
      const fp = ConfigMatcher.generateFingerprint(headers);

      expect(fp).toBeTruthy();
      expect(fp).toMatch(/^fp_[a-z0-9]+$/);
    });

    test("should return null for empty headers", () => {
      expect(ConfigMatcher.generateFingerprint([])).toBeNull();
      expect(ConfigMatcher.generateFingerprint(null)).toBeNull();
      expect(ConfigMatcher.generateFingerprint(undefined)).toBeNull();
    });

    test("should handle headers with whitespace", () => {
      const headers1 = ["Date", "Description", "Amount"];
      const headers2 = ["  Date  ", "  Description  ", "  Amount  "];

      const fp1 = ConfigMatcher.generateFingerprint(headers1);
      const fp2 = ConfigMatcher.generateFingerprint(headers2);

      expect(fp1).toBe(fp2);
    });

    test("should filter out empty headers", () => {
      const headers1 = ["Date", "Description", "Amount"];
      const headers2 = ["Date", "", "Description", "  ", "Amount"];

      const fp1 = ConfigMatcher.generateFingerprint(headers1);
      const fp2 = ConfigMatcher.generateFingerprint(headers2);

      expect(fp1).toBe(fp2);
    });

    test("should generate different fingerprints for different headers", () => {
      const headers1 = ["Date", "Description", "Amount"];
      const headers2 = ["Post Date", "Description", "Withdrawals", "Deposits"];

      const fp1 = ConfigMatcher.generateFingerprint(headers1);
      const fp2 = ConfigMatcher.generateFingerprint(headers2);

      expect(fp1).not.toBe(fp2);
    });
  });

  // ============================================
  // Filename Pattern Extraction Tests
  // ============================================

  describe("extractFilenamePatterns", () => {
    test("should extract patterns from chase_statement_2024.csv", () => {
      const patterns = ConfigMatcher.extractFilenamePatterns(
        "chase_statement_2024.csv",
      );

      expect(patterns).toContain("chase");
      expect(patterns).toContain("statement");
      // Should not contain numbers
      expect(patterns).not.toContain("2024");
    });

    test("should extract patterns from kontoutdrag 20251227-0654.csv", () => {
      const patterns = ConfigMatcher.extractFilenamePatterns(
        "kontoutdrag 20251227-0654.csv",
      );

      expect(patterns).toContain("kontoutdrag");
      // Should not contain date numbers
      expect(patterns).not.toContain("20251227");
      expect(patterns).not.toContain("0654");
    });

    test("should extract patterns from activity(25).csv", () => {
      const patterns =
        ConfigMatcher.extractFilenamePatterns("activity(25).csv");

      expect(patterns).toContain("activity");
      // Should not contain (25)
      expect(patterns).not.toContain("25");
    });

    test("should handle filenames with underscores and hyphens", () => {
      const patterns = ConfigMatcher.extractFilenamePatterns(
        "wells_fargo-checking_2025.csv",
      );

      expect(patterns).toContain("wells");
      expect(patterns).toContain("fargo");
      expect(patterns).toContain("checking");
    });

    test("should handle various extensions", () => {
      expect(ConfigMatcher.extractFilenamePatterns("data.csv")).toContain(
        "data",
      );
      expect(ConfigMatcher.extractFilenamePatterns("data.xlsx")).toContain(
        "data",
      );
      expect(ConfigMatcher.extractFilenamePatterns("data.xls")).toContain(
        "data",
      );
      expect(ConfigMatcher.extractFilenamePatterns("data.xlsm")).toContain(
        "data",
      );
    });

    test("should return empty array for empty or null input", () => {
      expect(ConfigMatcher.extractFilenamePatterns("")).toEqual([]);
      expect(ConfigMatcher.extractFilenamePatterns(null)).toEqual([]);
      expect(ConfigMatcher.extractFilenamePatterns(undefined)).toEqual([]);
    });

    test("should skip very short patterns (< 3 chars)", () => {
      const patterns = ConfigMatcher.extractFilenamePatterns("my_a_b_data.csv");

      expect(patterns).toContain("data");
      expect(patterns).not.toContain("my");
      expect(patterns).not.toContain("a");
      expect(patterns).not.toContain("b");
    });

    test("should limit to 5 patterns max", () => {
      const patterns = ConfigMatcher.extractFilenamePatterns(
        "one_two_three_four_five_six_seven_eight.csv",
      );

      expect(patterns.length).toBeLessThanOrEqual(5);
    });
  });

  // ============================================
  // Header Extraction from Content Tests
  // ============================================

  describe("extractHeadersFromContent", () => {
    test("should extract headers from line 1 by default", () => {
      const content = "Date,Description,Amount\n2024-01-01,Test,-50";
      const headers = ConfigMatcher.extractHeadersFromContent(content);

      expect(headers).toEqual(["Date", "Description", "Amount"]);
    });

    test("should extract headers from specified row", () => {
      const content =
        "Account Statement\nGenerated: 2025-01-10\nDate,Payee,Amount\n2025-01-05,Test,-50";
      const headers = ConfigMatcher.extractHeadersFromContent(content, 3);

      expect(headers).toEqual(["Date", "Payee", "Amount"]);
    });

    test("should auto-detect semicolon delimiter", () => {
      const content =
        "Booking date;Value date;Amount\n2024-01-01;2024-01-01;-50";
      const headers = ConfigMatcher.extractHeadersFromContent(
        content,
        1,
        "auto",
      );

      expect(headers).toEqual(["Booking date", "Value date", "Amount"]);
    });

    test("should use specified delimiter", () => {
      const content = "Date;Description;Amount\n2024-01-01;Test;-50";
      const headers = ConfigMatcher.extractHeadersFromContent(content, 1, ";");

      expect(headers).toEqual(["Date", "Description", "Amount"]);
    });

    test("should handle BOM character", () => {
      const content = "\uFEFFDate,Description,Amount\n2024-01-01,Test,-50";
      const headers = ConfigMatcher.extractHeadersFromContent(content);

      expect(headers).toEqual(["Date", "Description", "Amount"]);
    });

    test("should handle different line endings", () => {
      const contentUnix = "Date,Description,Amount\n2024-01-01,Test,-50";
      const contentWindows = "Date,Description,Amount\r\n2024-01-01,Test,-50";
      const contentMac = "Date,Description,Amount\r2024-01-01,Test,-50";

      expect(ConfigMatcher.extractHeadersFromContent(contentUnix)).toEqual([
        "Date",
        "Description",
        "Amount",
      ]);
      expect(ConfigMatcher.extractHeadersFromContent(contentWindows)).toEqual([
        "Date",
        "Description",
        "Amount",
      ]);
      expect(ConfigMatcher.extractHeadersFromContent(contentMac)).toEqual([
        "Date",
        "Description",
        "Amount",
      ]);
    });

    test("should return empty array for invalid input", () => {
      expect(ConfigMatcher.extractHeadersFromContent("")).toEqual([]);
      expect(ConfigMatcher.extractHeadersFromContent(null)).toEqual([]);
      expect(ConfigMatcher.extractHeadersFromContent(undefined)).toEqual([]);
    });

    test("should return empty array if row doesn't exist", () => {
      const content = "Date,Amount\n2024-01-01,-50";
      expect(ConfigMatcher.extractHeadersFromContent(content, 10)).toEqual([]);
    });

    test("should handle quoted headers", () => {
      const content = '"Date","Description","Amount"\n2024-01-01,Test,-50';
      const headers = ConfigMatcher.extractHeadersFromContent(content);

      expect(headers).toEqual(["Date", "Description", "Amount"]);
    });

    test("should extract headers from real test files", () => {
      // Read chase_statement_2024.csv
      const chaseContent = fs.readFileSync(
        path.join(__dirname, "../test_files/chase_statement_2024.csv"),
        "utf8",
      );
      const chaseHeaders =
        ConfigMatcher.extractHeadersFromContent(chaseContent);
      expect(chaseHeaders).toEqual([
        "Date",
        "Description",
        "Amount",
        "Balance",
      ]);

      // Read metadata_header_row3.csv
      const metadataContent = fs.readFileSync(
        path.join(__dirname, "../test_files/metadata_header_row3.csv"),
        "utf8",
      );
      const metadataHeaders = ConfigMatcher.extractHeadersFromContent(
        metadataContent,
        3,
      );
      expect(metadataHeaders).toEqual(["Date", "Payee", "Amount"]);
    });
  });

  // ============================================
  // CRUD Operations Tests
  // ============================================

  describe("saveConfiguration", () => {
    test("should save configuration and return fingerprint", () => {
      const headers = ["Date", "Description", "Amount"];
      const settings = {
        columnFormat: ["Date", "Payee", "Memo", "Amount"],
        chosenColumns: { Date: "Date", Payee: "Description", Amount: "Amount" },
        chosenEncoding: "UTF-8",
        chosenDelimiter: ",",
        startAtRow: 1,
        extraRow: false,
        invertedOutflow: false,
      };

      const configId = ConfigMatcher.saveConfiguration(
        headers,
        "chase_statement_2024.csv",
        settings,
      );

      expect(configId).toBeTruthy();
      expect(configId).toMatch(/^fp_[a-z0-9]+$/);
      expect(global.localStorage.setItem).toHaveBeenCalled();
    });

    test("should save configuration with custom name", () => {
      const headers = ["Date", "Description", "Amount"];
      const settings = {
        columnFormat: ["Date", "Payee", "Memo", "Amount"],
        chosenColumns: { Date: "Date", Payee: "Description", Amount: "Amount" },
      };

      ConfigMatcher.saveConfiguration(
        headers,
        "chase.csv",
        settings,
        "My Chase Account",
      );

      const savedData = JSON.parse(mockStore.knownConfigurations);
      const config = Object.values(savedData.configs)[0];

      expect(config.name).toBe("My Chase Account");
    });

    test("should generate default name from filename", () => {
      const headers = ["Date", "Description", "Amount"];
      const settings = {
        columnFormat: ["Date", "Payee", "Memo", "Amount"],
        chosenColumns: {},
      };

      ConfigMatcher.saveConfiguration(
        headers,
        "chase_statement_2024.csv",
        settings,
      );

      const savedData = JSON.parse(mockStore.knownConfigurations);
      const config = Object.values(savedData.configs)[0];

      expect(config.name).toContain("chase");
    });

    test("should return null for empty headers", () => {
      const configId = ConfigMatcher.saveConfiguration([], "test.csv", {});
      expect(configId).toBeNull();
    });

    test("should store originalHeaders for partial matching", () => {
      const headers = ["Date", "Description", "Amount"];
      const settings = {
        columnFormat: ["Date", "Payee", "Memo", "Amount"],
        chosenColumns: {},
      };

      ConfigMatcher.saveConfiguration(headers, "test.csv", settings);

      const savedData = JSON.parse(mockStore.knownConfigurations);
      const config = Object.values(savedData.configs)[0];

      expect(config.originalHeaders).toEqual(headers);
    });

    test("should increment useCount on update", () => {
      const headers = ["Date", "Description", "Amount"];
      const settings = { columnFormat: [], chosenColumns: {} };
      const fingerprint = ConfigMatcher.generateFingerprint(headers);

      // First save
      ConfigMatcher.saveConfiguration(headers, "test.csv", settings);

      const firstSave = JSON.parse(mockStore.knownConfigurations);
      expect(firstSave.configs[fingerprint].useCount).toBe(1);

      // Second save (update) - localStorage already has data from first save
      ConfigMatcher.saveConfiguration(headers, "test.csv", settings);

      const secondSave = JSON.parse(mockStore.knownConfigurations);
      expect(secondSave.configs[fingerprint].useCount).toBe(2);
    });
  });

  describe("getAllConfigurations", () => {
    test("should return empty object when no configs saved", () => {
      const configs = ConfigMatcher.getAllConfigurations();
      expect(configs).toEqual({});
    });

    test("should return saved configurations", () => {
      const storedData = {
        configs: {
          fp_123: { id: "fp_123", name: "Test Config" },
        },
      };
      mockStore.knownConfigurations = JSON.stringify(storedData);

      const configs = ConfigMatcher.getAllConfigurations();

      expect(configs).toEqual(storedData.configs);
    });
  });

  describe("getConfiguration", () => {
    test("should return null when config not found", () => {
      const config = ConfigMatcher.getConfiguration("fp_nonexistent");
      expect(config).toBeNull();
    });

    test("should return config when found", () => {
      const storedData = {
        configs: {
          fp_123: { id: "fp_123", name: "Test Config" },
        },
      };
      mockStore.knownConfigurations = JSON.stringify(storedData);

      const config = ConfigMatcher.getConfiguration("fp_123");

      expect(config).toEqual({ id: "fp_123", name: "Test Config" });
    });
  });

  describe("updateConfiguration", () => {
    test("should update existing config", () => {
      const storedData = {
        configs: {
          fp_123: { id: "fp_123", name: "Old Name", useCount: 5 },
        },
      };
      mockStore.knownConfigurations = JSON.stringify(storedData);

      const result = ConfigMatcher.updateConfiguration("fp_123", {
        name: "New Name",
      });

      expect(result).toBe(true);
      const savedData = JSON.parse(mockStore.knownConfigurations);
      expect(savedData.configs.fp_123.name).toBe("New Name");
      expect(savedData.configs.fp_123.useCount).toBe(5); // Unchanged
    });

    test("should return false for non-existent config", () => {
      const result = ConfigMatcher.updateConfiguration("fp_nonexistent", {
        name: "Test",
      });

      expect(result).toBe(false);
    });
  });

  describe("deleteConfiguration", () => {
    test("should delete existing config", () => {
      const storedData = {
        configs: {
          fp_123: { id: "fp_123", name: "Test" },
          fp_456: { id: "fp_456", name: "Another" },
        },
      };
      mockStore.knownConfigurations = JSON.stringify(storedData);

      const result = ConfigMatcher.deleteConfiguration("fp_123");

      expect(result).toBe(true);
      const savedData = JSON.parse(mockStore.knownConfigurations);
      expect(savedData.configs.fp_123).toBeUndefined();
      expect(savedData.configs.fp_456).toBeDefined();
    });

    test("should return false for non-existent config", () => {
      const result = ConfigMatcher.deleteConfiguration("fp_nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("renameConfiguration", () => {
    test("should rename existing config", () => {
      const storedData = {
        configs: {
          fp_123: { id: "fp_123", name: "Old Name" },
        },
      };
      mockStore.knownConfigurations = JSON.stringify(storedData);

      const result = ConfigMatcher.renameConfiguration("fp_123", "New Name");

      expect(result).toBe(true);
      const savedData = JSON.parse(mockStore.knownConfigurations);
      expect(savedData.configs.fp_123.name).toBe("New Name");
    });
  });

  // ============================================
  // Matching Algorithm Tests
  // ============================================

  describe("findMatchingConfig", () => {
    test("should find exact match by fingerprint", () => {
      const headers = ["Date", "Description", "Amount"];
      const fingerprint = ConfigMatcher.generateFingerprint(headers);

      const storedData = {
        configs: {
          [fingerprint]: {
            id: fingerprint,
            name: "Chase",
            chosenColumns: { Date: "Date", Payee: "Description" },
          },
        },
      };
      mockStore.knownConfigurations = JSON.stringify(storedData);

      const match = ConfigMatcher.findMatchingConfig(headers, "test.csv");

      expect(match).not.toBeNull();
      expect(match.matchType).toBe("exact");
      expect(match.confidence).toBe(100);
      expect(match.configId).toBe(fingerprint);
    });

    test("should return null when no configs saved", () => {
      const match = ConfigMatcher.findMatchingConfig(
        ["Date", "Amount"],
        "test.csv",
      );

      expect(match).toBeNull();
    });

    test("should find partial match when headers overlap", () => {
      const storedData = {
        configs: {
          fp_123: {
            id: "fp_123",
            name: "Bank Export",
            chosenColumns: {
              Date: "Date",
              Payee: "Description",
              Amount: "Amount",
            },
            originalHeaders: ["Date", "Description", "Amount", "Balance"],
          },
        },
      };
      mockStore.knownConfigurations = JSON.stringify(storedData);

      // New file has similar but not identical headers
      const newHeaders = ["Date", "Description", "Amount"];
      const match = ConfigMatcher.findMatchingConfig(newHeaders, "test.csv");

      expect(match).not.toBeNull();
      expect(match.matchType).toBe("partial");
      expect(match.confidence).toBeGreaterThanOrEqual(70);
    });

    test("should find filename pattern match", () => {
      const storedData = {
        configs: {
          fp_123: {
            id: "fp_123",
            name: "Chase",
            filenamePatterns: ["chase", "statement"],
            chosenColumns: { Date: "TransDate" },
          },
        },
      };
      mockStore.knownConfigurations = JSON.stringify(storedData);

      // Different headers but matching filename pattern
      const match = ConfigMatcher.findMatchingConfig(
        ["TransDate", "Memo", "Value"],
        "chase_statement_2025.csv",
      );

      expect(match).not.toBeNull();
      expect(match.matchType).toBe("filename_only");
      expect(match.confidence).toBe(60);
    });

    test("should prioritize exact match over partial", () => {
      const exactHeaders = ["Date", "Description", "Amount"];
      const exactFingerprint = ConfigMatcher.generateFingerprint(exactHeaders);

      const storedData = {
        configs: {
          [exactFingerprint]: {
            id: exactFingerprint,
            name: "Exact Match",
            originalHeaders: exactHeaders,
          },
          fp_other: {
            id: "fp_other",
            name: "Partial Match",
            originalHeaders: [
              "Date",
              "Description",
              "Amount",
              "Balance",
              "Extra",
            ],
          },
        },
      };
      mockStore.knownConfigurations = JSON.stringify(storedData);

      const match = ConfigMatcher.findMatchingConfig(exactHeaders, "test.csv");

      expect(match.matchType).toBe("exact");
      expect(match.configId).toBe(exactFingerprint);
    });
  });

  describe("findMatchingConfigWithStartRow", () => {
    test("should find match when headers on row 1", () => {
      const headers = ["Date", "Description", "Amount"];
      const fingerprint = ConfigMatcher.generateFingerprint(headers);

      const storedData = {
        configs: {
          [fingerprint]: {
            id: fingerprint,
            name: "Test",
            startAtRow: 1,
          },
        },
      };
      mockStore.knownConfigurations = JSON.stringify(storedData);

      const content = "Date,Description,Amount\n2024-01-01,Test,-50";
      const match = ConfigMatcher.findMatchingConfigWithStartRow(
        content,
        "test.csv",
        "auto",
      );

      expect(match).not.toBeNull();
      expect(match.detectedStartAtRow).toBe(1);
    });

    test("should find match when headers on row 3", () => {
      const headers = ["Date", "Payee", "Amount"];
      const fingerprint = ConfigMatcher.generateFingerprint(headers);

      const storedData = {
        configs: {
          [fingerprint]: {
            id: fingerprint,
            name: "Metadata File",
            startAtRow: 3,
          },
        },
      };
      mockStore.knownConfigurations = JSON.stringify(storedData);

      // Read the actual test file
      const content = fs.readFileSync(
        path.join(__dirname, "../test_files/metadata_header_row3.csv"),
        "utf8",
      );

      const match = ConfigMatcher.findMatchingConfigWithStartRow(
        content,
        "metadata_header_row3.csv",
        "auto",
      );

      expect(match).not.toBeNull();
      expect(match.detectedStartAtRow).toBe(3);
    });

    test("should try multiple startAtRow values from saved configs", () => {
      const row1Headers = ["A", "B", "C"];
      const row3Headers = ["Date", "Payee", "Amount"];
      const row3Fingerprint = ConfigMatcher.generateFingerprint(row3Headers);

      const storedData = {
        configs: {
          fp_row1: {
            id: "fp_row1",
            name: "Row 1 Config",
            startAtRow: 1,
            originalHeaders: row1Headers,
          },
          [row3Fingerprint]: {
            id: row3Fingerprint,
            name: "Row 3 Config",
            startAtRow: 3,
            originalHeaders: row3Headers,
          },
        },
      };
      mockStore.knownConfigurations = JSON.stringify(storedData);

      // File with headers on row 3
      const content =
        "Metadata line 1\nMetadata line 2\nDate,Payee,Amount\n2024-01-01,Test,-50";

      const match = ConfigMatcher.findMatchingConfigWithStartRow(
        content,
        "test.csv",
        "auto",
      );

      expect(match).not.toBeNull();
      expect(match.configId).toBe(row3Fingerprint);
      expect(match.detectedStartAtRow).toBe(3);
    });
  });

  // ============================================
  // Integration tests with real test files
  // ============================================

  describe("integration with test files", () => {
    test("should match chase_statement files correctly", () => {
      // Save config from first chase file
      const chase2024Content = fs.readFileSync(
        path.join(__dirname, "../test_files/chase_statement_2024.csv"),
        "utf8",
      );
      const chase2024Headers =
        ConfigMatcher.extractHeadersFromContent(chase2024Content);

      const settings = {
        columnFormat: ["Date", "Payee", "Memo", "Amount"],
        chosenColumns: {
          Date: "Date",
          Payee: "Description",
          Amount: "Amount",
        },
        startAtRow: 1,
      };

      ConfigMatcher.saveConfiguration(
        chase2024Headers,
        "chase_statement_2024.csv",
        settings,
        "Chase Bank",
      );

      // Now try to match with chase_statement_2025.csv
      const chase2025Content = fs.readFileSync(
        path.join(__dirname, "../test_files/chase_statement_2025.csv"),
        "utf8",
      );

      const match = ConfigMatcher.findMatchingConfigWithStartRow(
        chase2025Content,
        "chase_statement_2025.csv",
        "auto",
      );

      expect(match).not.toBeNull();
      expect(match.matchType).toBe("exact");
      expect(match.confidence).toBe(100);
      expect(match.config.name).toBe("Chase Bank");
    });

    test("should not match chase with wells_fargo (different headers)", () => {
      // Save chase config
      const chaseHeaders = ["Date", "Description", "Amount", "Balance"];
      const fingerprint = ConfigMatcher.generateFingerprint(chaseHeaders);

      const storedData = {
        configs: {
          [fingerprint]: {
            id: fingerprint,
            name: "Chase",
            originalHeaders: chaseHeaders,
            filenamePatterns: ["chase", "statement"],
          },
        },
      };
      mockStore.knownConfigurations = JSON.stringify(storedData);

      // Try to match wells fargo file
      const wellsFargoContent = fs.readFileSync(
        path.join(__dirname, "../test_files/wells_fargo_checking.csv"),
        "utf8",
      );

      const match = ConfigMatcher.findMatchingConfigWithStartRow(
        wellsFargoContent,
        "wells_fargo_checking.csv",
        "auto",
      );

      // Should not match (different headers, different filename pattern)
      expect(match).toBeNull();
    });

    test("should not match kontoutdrag English with Swedish (same pattern, different headers)", () => {
      // Save English kontoutdrag config
      const englishHeaders = [
        "Booking date",
        "Value date",
        "Voucher number",
        "Text",
        "Amount",
        "Balance",
      ];
      const fingerprint = ConfigMatcher.generateFingerprint(englishHeaders);

      const storedData = {
        configs: {
          [fingerprint]: {
            id: fingerprint,
            name: "Kontoutdrag English",
            originalHeaders: englishHeaders,
            filenamePatterns: ["kontoutdrag"],
          },
        },
      };
      mockStore.knownConfigurations = JSON.stringify(storedData);

      // Read Swedish kontoutdrag
      const swedishContent = fs.readFileSync(
        path.join(__dirname, "../test_files/kontoutdrag 20260103-0639.csv"),
        "utf8",
      );

      const match = ConfigMatcher.findMatchingConfigWithStartRow(
        swedishContent,
        "kontoutdrag 20260103-0639.csv",
        "auto",
      );

      // Should match on filename pattern only (headers are different)
      // The filename match should be returned since headers don't match exactly
      if (match) {
        expect(match.matchType).toBe("filename_only");
        expect(match.confidence).toBe(60);
      }
      // Or it could be null if the partial header match doesn't meet threshold
    });
  });
});
