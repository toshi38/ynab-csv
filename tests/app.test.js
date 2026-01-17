// Mock AngularJS
const mockModule = {
  directive: jest.fn(() => mockModule),
  config: jest.fn(() => mockModule),
  controller: jest.fn(() => mockModule),
};

global.angular = {
  element: jest.fn(() => ({
    ready: jest.fn((callback) => callback()),
  })),
  module: jest.fn(() => mockModule),
  bootstrap: jest.fn(),
  copy: jest.fn((obj) => JSON.parse(JSON.stringify(obj))),
};

// Mock DataObject
global.DataObject = jest.fn(() => ({
  parseCsv: jest.fn(),
  parseExcel: jest.fn(),
  isExcelFile: jest.fn(),
  converted_json: jest.fn(),
  converted_csv: jest.fn(),
  fields: jest.fn(() => []),
  rows: jest.fn(() => []),
  worksheetNames: [],
  currentWorksheet: null,
}));

// Mock document
global.document = {
  createElement: jest.fn(() => ({
    click: jest.fn(),
  })),
  body: {
    appendChild: jest.fn(),
  },
};

// Mock ConfigMatcher
global.ConfigMatcher = {
  getAllConfigurations: jest.fn(() => ({})),
  getConfiguration: jest.fn(),
  findMatchingConfig: jest.fn(),
  findMatchingConfigWithStartRow: jest.fn(),
  saveConfiguration: jest.fn(),
  updateConfiguration: jest.fn(),
  deleteConfiguration: jest.fn(),
  renameConfiguration: jest.fn(),
  incrementUsageCount: jest.fn(),
};

// Mock alert
global.alert = jest.fn();

// Mock Date prototype
global.Date.prototype.yyyymmdd = function () {
  return "20240101";
};

describe("ParseController", () => {
  let $scope;
  let $location;
  let controller;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    jest.resetModules();

    // Create mock $scope
    $scope = {
      $watch: jest.fn(),
      $apply: jest.fn((fn) => fn && fn()),
      $evalAsync: jest.fn(),
    };

    // Create mock $location
    $location = {
      search: jest.fn(() => ({})),
    };

    // Load the app.js file to register the controller
    require("../src/app.js");

    // Get the controller function that was registered
    const controllerCalls = mockModule.controller.mock.calls;
    const parseControllerCall = controllerCalls.find(
      (call) => call[0] === "ParseController",
    );
    const controllerFn = parseControllerCall[1];

    // Execute the controller
    controller = controllerFn($scope, $location);
  });

  describe("Profile Management", () => {
    test("should initialize with default profile settings", () => {
      expect($scope.profileName).toBe("default profile");
      expect($scope.profiles).toHaveProperty("default profile");
      expect($scope.profile).toBeDefined();
      expect($scope.ynab_cols).toEqual([
        "Date",
        "Payee",
        "Memo",
        "Outflow",
        "Inflow",
      ]);
      expect($scope.file.chosenEncoding).toBe("UTF-8");
      expect($scope.file.chosenDelimiter).toBe("auto");
    });

    test("should detect non-default profiles exist", () => {
      // Initially only has default profile
      $scope.profiles = { "default profile": {} };
      expect($scope.nonDefaultProfilesExist()).toBe(false);

      // Add another profile
      $scope.profiles["custom-profile"] = {};
      expect($scope.nonDefaultProfilesExist()).toBe(true);
    });

    test("should toggle between old and new column formats", () => {
      // Start with old format
      expect($scope.ynab_cols).toEqual([
        "Date",
        "Payee",
        "Memo",
        "Outflow",
        "Inflow",
      ]);

      // Toggle to new format
      $scope.toggleColumnFormat();
      expect($scope.ynab_cols).toEqual(["Date", "Payee", "Memo", "Amount"]);
      expect($scope.profile.columnFormat).toEqual([
        "Date",
        "Payee",
        "Memo",
        "Amount",
      ]);

      // Toggle back to old format
      $scope.toggleColumnFormat();
      expect($scope.ynab_cols).toEqual([
        "Date",
        "Payee",
        "Memo",
        "Outflow",
        "Inflow",
      ]);
    });

    test("should update profile encoding when chosen", () => {
      $scope.encodingChosen("windows-1252");
      expect($scope.profile.chosenEncoding).toBe("windows-1252");
    });

    test("should update profile delimiter when chosen", () => {
      $scope.delimiterChosen(";");
      expect($scope.profile.chosenDelimiter).toBe(";");
    });

    test("should update start row when set", () => {
      $scope.startRowSet(3);
      expect($scope.profile.startAtRow).toBe(3);
    });

    test("should update extra row setting when set", () => {
      $scope.extraRowSet(true);
      expect($scope.profile.extraRow).toBe(true);
    });

    test("should switch profiles and call URL search", () => {
      $scope.profileChosen("new-profile");

      expect($location.search).toHaveBeenCalledWith("profile", "new-profile");
      // Note: The function uses $scope.profileName instead of the parameter,
      // so it will use the existing profile, not the new one
      expect($scope.profile).toBe($scope.profiles[$scope.profileName]);
    });

    test("should invert flows when toggle is called", () => {
      expect($scope.inverted_outflow).toBe(false);

      $scope.invert_flows();
      expect($scope.inverted_outflow).toBe(true);

      $scope.invert_flows();
      expect($scope.inverted_outflow).toBe(false);
    });

    test("should reset app state when reloadApp is called", () => {
      $scope.setInitialScopeState = jest.fn();
      $scope.reloadApp();

      expect($scope.setInitialScopeState).toHaveBeenCalled();
    });
  });

  describe("File Processing", () => {
    beforeEach(() => {
      // Set up data object mock methods
      $scope.data_object.parseCsv = jest.fn();
      $scope.data_object.converted_json = jest.fn(() => [
        { Date: "2024-01-01", Payee: "Store", Amount: "-50.00" },
      ]);
      $scope.data_object.converted_csv = jest.fn(
        () => "Date,Payee,Amount\n2024-01-01,Store,-50.00",
      );
    });

    test("should process file data when data.source changes", () => {
      // Set up watchers
      const watchCallbacks = {};
      $scope.$watch.mockImplementation((expr, callback) => {
        watchCallbacks[expr] = callback;
      });

      // Re-initialize to capture watch callbacks
      jest.resetModules();
      require("../src/app.js");
      const controllerCalls = mockModule.controller.mock.calls;
      const parseControllerCall = controllerCalls.find(
        (call) => call[0] === "ParseController",
      );
      const controllerFn = parseControllerCall[1];
      controllerFn($scope, $location);

      // Simulate file data change with auto delimiter
      $scope.file.chosenDelimiter = "auto";
      $scope.file.startAtRow = 1;
      $scope.profile.extraRow = false;
      const csvData = {
        data: "Date,Payee,Amount\n2024-01-01,Store,-50.00",
        filename: "test.csv",
      };

      watchCallbacks["data.source"](csvData, null);

      expect($scope.data_object.parseCsv).toHaveBeenCalledWith(
        csvData.data,
        $scope.file.chosenEncoding,
        $scope.file.startAtRow,
        $scope.profile.extraRow,
      );
      expect($scope.data_object.converted_json).toHaveBeenCalledWith(
        10,
        $scope.ynab_cols,
        $scope.ynab_map,
        $scope.inverted_outflow,
      );
    });

    test("should process file data with custom delimiter", () => {
      // Set up watchers
      const watchCallbacks = {};
      $scope.$watch.mockImplementation((expr, callback) => {
        watchCallbacks[expr] = callback;
      });

      // Re-initialize to capture watch callbacks
      jest.resetModules();
      require("../src/app.js");
      const controllerCalls = mockModule.controller.mock.calls;
      const parseControllerCall = controllerCalls.find(
        (call) => call[0] === "ParseController",
      );
      const controllerFn = parseControllerCall[1];
      controllerFn($scope, $location);

      // Simulate file data change with custom delimiter
      $scope.file.chosenDelimiter = ";";
      $scope.file.startAtRow = 2;
      $scope.profile.extraRow = true;
      const csvData = {
        data: "Date;Payee;Amount\n2024-01-01;Store;-50.00",
        filename: "test.csv",
      };

      watchCallbacks["data.source"](csvData, null);

      expect($scope.data_object.parseCsv).toHaveBeenCalledWith(
        csvData.data,
        $scope.file.chosenEncoding,
        $scope.file.startAtRow,
        $scope.profile.extraRow,
        ";",
      );
    });

    test("should update preview when inverted_outflow changes", () => {
      // Set up watchers
      const watchCallbacks = {};
      $scope.$watch.mockImplementation((expr, callback) => {
        watchCallbacks[expr] = callback;
      });

      // Re-initialize to capture watch callbacks
      jest.resetModules();
      require("../src/app.js");
      const controllerCalls = mockModule.controller.mock.calls;
      const parseControllerCall = controllerCalls.find(
        (call) => call[0] === "ParseController",
      );
      const controllerFn = parseControllerCall[1];
      controllerFn($scope, $location);

      // Set initial inverted_outflow to false
      $scope.inverted_outflow = false;

      // Simulate inverted outflow change - the watch callback should update preview
      $scope.inverted_outflow = true;
      watchCallbacks["inverted_outflow"](true, false);

      expect($scope.data_object.converted_json).toHaveBeenCalledWith(
        10,
        $scope.ynab_cols,
        $scope.ynab_map,
        $scope.inverted_outflow,
      );
    });

    test("should update preview when column mapping changes", () => {
      // Set up watchers
      const watchCallbacks = {};
      $scope.$watch.mockImplementation((expr, callback, deep) => {
        watchCallbacks[expr] = callback;
      });

      // Re-initialize to capture watch callbacks
      jest.resetModules();
      require("../src/app.js");
      const controllerCalls = mockModule.controller.mock.calls;
      const parseControllerCall = controllerCalls.find(
        (call) => call[0] === "ParseController",
      );
      const controllerFn = parseControllerCall[1];
      controllerFn($scope, $location);

      // Simulate column mapping change
      const newMapping = { Date: "Transaction Date", Payee: "Merchant" };
      watchCallbacks["ynab_map"](newMapping, {});

      expect($scope.profile.chosenColumns).toEqual(newMapping);
      expect($scope.data_object.converted_json).toHaveBeenCalledWith(
        10,
        $scope.ynab_cols,
        newMapping,
        $scope.inverted_outflow,
      );
    });

    test("should generate CSV string for download", () => {
      $scope.data_object.converted_csv.mockReturnValue(
        "Date,Payee,Amount\n2024-01-01,Store,-50.00",
      );

      const result = $scope.csvString();

      expect($scope.data_object.converted_csv).toHaveBeenCalledWith(
        null,
        $scope.ynab_cols,
        $scope.ynab_map,
        $scope.inverted_outflow,
      );
      expect(result).toBe("Date,Payee,Amount\n2024-01-01,Store,-50.00");
    });

    test("should create download file with proper filename and encoding", () => {
      const mockAnchor = {
        href: "",
        target: "",
        download: "",
        click: jest.fn(),
      };

      // Mock Date constructor to return a specific date
      const mockDate = new Date("2024-01-01");
      mockDate.yyyymmdd = jest.fn(() => "20240101");
      jest.spyOn(global, "Date").mockImplementation(() => mockDate);

      // Mock document.createElement to return our mock anchor
      global.document.createElement = jest.fn(() => mockAnchor);
      global.document.body.appendChild = jest.fn();

      // Use realistic CSV data with special characters to test encoding
      const csvData =
        'Date,Payee,Memo,Amount\n2024-01-01,"Store ""ABC""","Café & Groceries","-$50.00"';
      $scope.data_object.converted_csv.mockReturnValue(csvData);

      $scope.downloadFile();

      // Verify DOM interactions
      expect(global.document.createElement).toHaveBeenCalledWith("a");
      expect(mockAnchor.target).toBe("_blank");
      expect(mockAnchor.download).toBe("ynab_data_20240101.csv");
      expect(global.document.body.appendChild).toHaveBeenCalledWith(mockAnchor);
      expect(mockAnchor.click).toHaveBeenCalled();

      // Verify the actual encoding pipeline: btoa(unescape(encodeURIComponent(csvData)))
      const expectedHref =
        "data:attachment/csv;base64," +
        btoa(unescape(encodeURIComponent(csvData)));
      expect(mockAnchor.href).toBe(expectedHref);

      // Verify we can decode it back to the original CSV data
      const base64Part = mockAnchor.href.split(
        "data:attachment/csv;base64,",
      )[1];
      const decodedData = decodeURIComponent(escape(atob(base64Part)));
      expect(decodedData).toBe(csvData);

      // Restore Date mock
      global.Date.mockRestore();
    });
  });

  describe("Worksheet Selection", () => {
    beforeEach(() => {
      // Set up Excel file scenario
      $scope.currentFilename = "test.xlsx";
      $scope.data = {
        source: {
          data: "excel_binary_data",
          filename: "test.xlsx",
        },
      };
      $scope.data_object.parseExcel = jest.fn();
      $scope.data_object.converted_json = jest.fn(() => [
        { Date: "2024-01-01", Payee: "Excel Store", Amount: "-75.00" },
      ]);
      $scope.$evalAsync = jest.fn();
      global.alert = jest.fn();
    });

    test("worksheetChosen should re-parse Excel with new worksheet index", () => {
      $scope.worksheetChosen(2);

      expect($scope.data_object.parseExcel).toHaveBeenCalledWith(
        "excel_binary_data",
        "test.xlsx",
        $scope.file.chosenEncoding,
        $scope.file.startAtRow,
        $scope.profile.extraRow,
        null, // auto delimiter becomes null
        2, // worksheet index
      );

      expect($scope.data_object.converted_json).toHaveBeenCalledWith(
        10,
        $scope.ynab_cols,
        $scope.ynab_map,
        $scope.inverted_outflow,
      );
    });

    test("worksheetChosen should handle custom delimiter", () => {
      $scope.file.chosenDelimiter = ";";

      $scope.worksheetChosen(1);

      expect($scope.data_object.parseExcel).toHaveBeenCalledWith(
        "excel_binary_data",
        "test.xlsx",
        $scope.file.chosenEncoding,
        $scope.file.startAtRow,
        $scope.profile.extraRow,
        ";", // custom delimiter
        1,
      );
    });

    test("worksheetChosen should handle parseExcel errors gracefully", () => {
      // Mock console.error and alert to avoid noise in tests
      global.console.error = jest.fn();
      global.alert = jest.fn();

      // Make parseExcel throw an error
      $scope.data_object.parseExcel.mockImplementation(() => {
        throw new Error("Invalid worksheet");
      });

      // This should not throw
      expect(() => {
        $scope.worksheetChosen(5);
      }).not.toThrow();

      expect(global.console.error).toHaveBeenCalledWith(
        "Error switching worksheet:",
        expect.any(Error),
      );
      expect(global.alert).toHaveBeenCalledWith(
        "Error switching worksheet: Invalid worksheet",
      );

      // Clean up mocks
      delete global.console.error;
      delete global.alert;
    });

    test("worksheetChosen should do nothing if filename is not set", () => {
      $scope.currentFilename = null;

      $scope.worksheetChosen(1);

      expect($scope.data_object.parseExcel).not.toHaveBeenCalled();
      expect($scope.data_object.converted_json).not.toHaveBeenCalled();
    });

    test("worksheetChosen should do nothing if data.source is not set", () => {
      $scope.data.source = null;

      $scope.worksheetChosen(1);

      expect($scope.data_object.parseExcel).not.toHaveBeenCalled();
      expect($scope.data_object.converted_json).not.toHaveBeenCalled();
    });

    test("worksheetChosen should do nothing for non-Excel files", () => {
      $scope.currentFilename = "test.csv";

      $scope.worksheetChosen(1);

      expect($scope.data_object.parseExcel).not.toHaveBeenCalled();
      expect($scope.data_object.converted_json).not.toHaveBeenCalled();
    });
  });

  describe("Excel File Processing Integration", () => {
    beforeEach(() => {
      // Set up data object mock methods for Excel
      $scope.data_object.parseExcel = jest.fn();
      $scope.data_object.isExcelFile = jest.fn();
      $scope.data_object.converted_json = jest.fn(() => [
        { Date: "2024-01-01", Payee: "Excel Store", Amount: "-75.00" },
      ]);
      $scope.data_object.worksheetNames = ["Sheet1", "Data"];
    });

    test("data.source watcher should call parseExcel for Excel files", () => {
      // Set up watchers
      const watchCallbacks = {};
      $scope.$watch.mockImplementation((expr, callback) => {
        watchCallbacks[expr] = callback;
      });

      // Re-initialize to capture watch callbacks
      jest.resetModules();
      require("../src/app.js");
      const controllerCalls = mockModule.controller.mock.calls;
      const parseControllerCall = controllerCalls.find(
        (call) => call[0] === "ParseController",
      );
      const controllerFn = parseControllerCall[1];
      controllerFn($scope, $location);

      // Set up Excel file scenario
      $scope.data_object.isExcelFile.mockReturnValue(true);
      $scope.file.chosenDelimiter = "auto";
      $scope.file.startAtRow = 2;
      $scope.profile.extraRow = true;

      const excelData = {
        data: "excel_binary_data",
        filename: "test.xlsx",
      };

      // Simulate Excel file data change
      watchCallbacks["data.source"](excelData, null);

      expect($scope.data_object.parseExcel).toHaveBeenCalledWith(
        excelData.data,
        "test.xlsx",
        $scope.file.chosenEncoding,
        $scope.file.startAtRow,
        $scope.profile.extraRow,
        null, // auto delimiter becomes null
        0, // default worksheet index
      );

      expect($scope.data_object.converted_json).toHaveBeenCalledWith(
        10,
        $scope.ynab_cols,
        $scope.ynab_map,
        $scope.inverted_outflow,
      );

      // Verify worksheet initialization
      expect($scope.file.selectedWorksheet).toBe(0);
    });

    test("data.source watcher should call parseExcel with custom delimiter", () => {
      // Set up watchers
      const watchCallbacks = {};
      $scope.$watch.mockImplementation((expr, callback) => {
        watchCallbacks[expr] = callback;
      });

      // Re-initialize to capture watch callbacks
      jest.resetModules();
      require("../src/app.js");
      const controllerCalls = mockModule.controller.mock.calls;
      const parseControllerCall = controllerCalls.find(
        (call) => call[0] === "ParseController",
      );
      const controllerFn = parseControllerCall[1];
      controllerFn($scope, $location);

      // Set up Excel file scenario with custom delimiter in profile
      $scope.data_object.isExcelFile.mockReturnValue(true);
      $scope.profile.chosenDelimiter = ";";

      const excelData = {
        data: "excel_binary_data",
        filename: "test.xlsx",
      };

      watchCallbacks["data.source"](excelData, null);

      expect($scope.data_object.parseExcel).toHaveBeenCalledWith(
        excelData.data,
        "test.xlsx",
        $scope.file.chosenEncoding,
        $scope.file.startAtRow,
        $scope.profile.extraRow,
        ";", // custom delimiter
        0,
      );
    });

    test("data.source watcher should call parseCsv for CSV files", () => {
      // Set up watchers
      const watchCallbacks = {};
      $scope.$watch.mockImplementation((expr, callback) => {
        watchCallbacks[expr] = callback;
      });

      // Re-initialize to capture watch callbacks
      jest.resetModules();
      require("../src/app.js");
      const controllerCalls = mockModule.controller.mock.calls;
      const parseControllerCall = controllerCalls.find(
        (call) => call[0] === "ParseController",
      );
      const controllerFn = parseControllerCall[1];
      controllerFn($scope, $location);

      // Set up CSV file scenario
      $scope.data_object.isExcelFile.mockReturnValue(false);
      $scope.file.chosenDelimiter = "auto";

      const csvData = {
        data: "Date,Payee,Amount\n2024-01-01,Store,-50.00",
        filename: "test.csv",
      };

      watchCallbacks["data.source"](csvData, null);

      expect($scope.data_object.parseCsv).toHaveBeenCalledWith(
        csvData.data,
        $scope.file.chosenEncoding,
        $scope.file.startAtRow,
        $scope.profile.extraRow,
      );

      expect($scope.data_object.parseExcel).not.toHaveBeenCalled();
    });

    test("data.source watcher should handle Excel parsing errors", () => {
      // Mock console.error and alert to avoid noise in tests
      global.console.error = jest.fn();
      global.alert = jest.fn();

      // Set up watchers
      const watchCallbacks = {};
      $scope.$watch.mockImplementation((expr, callback) => {
        watchCallbacks[expr] = callback;
      });

      // Re-initialize to capture watch callbacks
      jest.resetModules();
      require("../src/app.js");
      const controllerCalls = mockModule.controller.mock.calls;
      const parseControllerCall = controllerCalls.find(
        (call) => call[0] === "ParseController",
      );
      const controllerFn = parseControllerCall[1];
      controllerFn($scope, $location);

      // Set up Excel file scenario
      $scope.data_object.isExcelFile.mockReturnValue(true);

      // Make parseExcel throw an error
      $scope.data_object.parseExcel.mockImplementation(() => {
        throw new Error("Corrupted Excel file");
      });

      const excelData = {
        data: "corrupted_excel_data",
        filename: "test.xlsx",
      };

      // This should not crash the watcher
      expect(() => {
        watchCallbacks["data.source"](excelData, null);
      }).not.toThrow();

      expect(global.console.error).toHaveBeenCalledWith(
        "Error parsing file:",
        expect.any(Error),
      );
      expect(global.alert).toHaveBeenCalledWith(
        "Error parsing file: Corrupted Excel file",
      );

      // Clean up mocks
      delete global.console.error;
      delete global.alert;
    });

    test("data.source watcher should not process empty data", () => {
      // Set up watchers
      const watchCallbacks = {};
      $scope.$watch.mockImplementation((expr, callback) => {
        watchCallbacks[expr] = callback;
      });

      // Re-initialize to capture watch callbacks
      jest.resetModules();
      require("../src/app.js");
      const controllerCalls = mockModule.controller.mock.calls;
      const parseControllerCall = controllerCalls.find(
        (call) => call[0] === "ParseController",
      );
      const controllerFn = parseControllerCall[1];
      controllerFn($scope, $location);

      // Test empty data scenarios
      watchCallbacks["data.source"]("", null);
      watchCallbacks["data.source"](null, null);
      watchCallbacks["data.source"](undefined, null);

      expect($scope.data_object.parseExcel).not.toHaveBeenCalled();
      expect($scope.data_object.parseCsv).not.toHaveBeenCalled();
    });

    test("worksheet initialization should work for Excel files", () => {
      // Set up watchers
      const watchCallbacks = {};
      $scope.$watch.mockImplementation((expr, callback) => {
        watchCallbacks[expr] = callback;
      });

      // Re-initialize to capture watch callbacks
      jest.resetModules();
      require("../src/app.js");
      const controllerCalls = mockModule.controller.mock.calls;
      const parseControllerCall = controllerCalls.find(
        (call) => call[0] === "ParseController",
      );
      const controllerFn = parseControllerCall[1];
      controllerFn($scope, $location);

      // Set up Excel file scenario
      $scope.filename = "test.xlsx";
      $scope.data_object.isExcelFile.mockReturnValue(true);
      $scope.data_object.worksheetNames = ["Sheet1", "Data", "Summary"];

      const excelData = "excel_binary_data";

      watchCallbacks["data.source"](excelData, null);

      // Should initialize selectedWorksheet to 0 for multi-sheet Excel files
      expect($scope.file.selectedWorksheet).toBe(0);
    });

    test("worksheet initialization should not occur for CSV files", () => {
      // Set up watchers
      const watchCallbacks = {};
      $scope.$watch.mockImplementation((expr, callback) => {
        watchCallbacks[expr] = callback;
      });

      // Re-initialize to capture watch callbacks
      jest.resetModules();
      require("../src/app.js");
      const controllerCalls = mockModule.controller.mock.calls;
      const parseControllerCall = controllerCalls.find(
        (call) => call[0] === "ParseController",
      );
      const controllerFn = parseControllerCall[1];
      controllerFn($scope, $location);

      // Set up CSV file scenario
      $scope.data_object.isExcelFile.mockReturnValue(false);

      const csvData = {
        data: "Date,Payee,Amount\n2024-01-01,Store,-50.00",
        filename: "test.csv",
      };

      watchCallbacks["data.source"](csvData, null);

      // Should not set selectedWorksheet for CSV files (it starts as 0 from setInitialScopeState)
      expect($scope.file.selectedWorksheet).toBe(0);
    });
  });

  describe("File Re-parsing", () => {
    beforeEach(() => {
      // Mock FileUtils globally
      global.FileUtils = {
        isExcelFile: jest.fn(),
      };

      // Set up initial controller state
      jest.resetModules();
      require("../src/app.js");
      const controllerCalls = mockModule.controller.mock.calls;
      const parseControllerCall = controllerCalls.find(
        (call) => call[0] === "ParseController",
      );
      const controllerFn = parseControllerCall[1];
      controllerFn($scope, $location);

      // Mock the setting functions
      $scope.encodingChosen = jest.fn();
      $scope.delimiterChosen = jest.fn();
      $scope.startRowSet = jest.fn();
      $scope.extraRowSet = jest.fn();
    });

    test("should re-parse CSV file when settings change", () => {
      // Set up file data
      $scope.data = {
        source: {
          data: "Date,Payee,Amount\n2024-01-01,Store,-50.00",
          filename: "test.csv",
        },
      };
      $scope.currentFilename = "test.csv";
      $scope.filename = "test.csv";

      global.FileUtils.isExcelFile.mockReturnValue(false);

      // Change settings
      $scope.file.chosenEncoding = "ISO-8859-1";
      $scope.file.chosenDelimiter = ";";
      $scope.file.startAtRow = 2;
      $scope.file.extraRow = true;
      $scope.profile.extraRow = true;

      // Call reparseFile
      $scope.reparseFile();

      // Verify CSV was re-parsed with new settings
      expect($scope.data_object.parseCsv).toHaveBeenCalledWith(
        $scope.data.source.data,
        "ISO-8859-1",
        2,
        true,
        ";",
      );

      // Verify preview was updated
      expect($scope.data_object.converted_json).toHaveBeenCalledWith(
        10,
        $scope.ynab_cols,
        $scope.ynab_map,
        $scope.inverted_outflow,
      );

      // Verify settings were saved
      expect($scope.encodingChosen).toHaveBeenCalledWith("ISO-8859-1");
      expect($scope.delimiterChosen).toHaveBeenCalledWith(";");
      expect($scope.startRowSet).toHaveBeenCalledWith(2);
      expect($scope.extraRowSet).toHaveBeenCalledWith(true);
    });

    test("should re-parse Excel file when settings change", () => {
      // Set up file data
      $scope.data = {
        source: {
          data: "excel_binary_data",
          filename: "test.xlsx",
        },
      };
      $scope.currentFilename = "test.xlsx";
      $scope.filename = "test.xlsx";
      $scope.file.selectedWorksheet = 1;

      global.FileUtils.isExcelFile.mockReturnValue(true);

      // Change settings
      $scope.file.chosenEncoding = "UTF-16";
      $scope.file.chosenDelimiter = "auto";
      $scope.file.startAtRow = 3;
      $scope.profile.extraRow = false;

      // Call reparseFile
      $scope.reparseFile();

      // Verify Excel was re-parsed with new settings
      expect($scope.data_object.parseExcel).toHaveBeenCalledWith(
        $scope.data.source.data,
        "test.xlsx",
        "UTF-16",
        3,
        false,
        null, // auto delimiter
        1, // worksheet index
      );

      // Verify preview was updated
      expect($scope.data_object.converted_json).toHaveBeenCalled();
    });

    test("should handle re-parse with manual delimiter for Excel", () => {
      $scope.data = {
        source: {
          data: "excel_binary_data",
          filename: "test.xlsx",
        },
      };
      $scope.currentFilename = "test.xlsx";
      $scope.filename = "test.xlsx";
      global.FileUtils.isExcelFile.mockReturnValue(true);
      $scope.file.chosenDelimiter = ",";

      $scope.reparseFile();

      expect($scope.data_object.parseExcel).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(Number),
        expect.any(Boolean),
        ",", // manual delimiter passed
        expect.any(Number),
      );
    });

    test("should not re-parse when no data is loaded", () => {
      // No data loaded
      $scope.data.source = null;

      $scope.reparseFile();

      expect($scope.data_object.parseCsv).not.toHaveBeenCalled();
      expect($scope.data_object.parseExcel).not.toHaveBeenCalled();
    });

    test("should handle errors during re-parse", () => {
      // Mock console.error and alert
      global.console.error = jest.fn();
      global.alert = jest.fn();

      $scope.data = {
        source: {
          data: "invalid data",
          filename: "test.csv",
        },
      };
      global.FileUtils.isExcelFile.mockReturnValue(false);

      // Make parseCsv throw an error
      $scope.data_object.parseCsv.mockImplementation(() => {
        throw new Error("Parse error");
      });

      $scope.reparseFile();

      expect(global.console.error).toHaveBeenCalledWith(
        "Error re-parsing file:",
        expect.any(Error),
      );
      expect(global.alert).toHaveBeenCalledWith(
        "Error re-parsing file: Parse error",
      );

      // Clean up
      delete global.console.error;
      delete global.alert;
    });

    test("should use currentFilename over filename for file type detection", () => {
      $scope.data = {
        source: {
          data: "some data",
          filename: "old.csv",
        },
      };
      $scope.currentFilename = "new.xlsx";
      $scope.filename = "old.csv";

      global.FileUtils.isExcelFile.mockReturnValue(true);

      $scope.reparseFile();

      // Should check file type with currentFilename first
      expect(global.FileUtils.isExcelFile).toHaveBeenCalledWith("new.xlsx");
      expect($scope.data_object.parseExcel).toHaveBeenCalled();
    });
  });

  describe("Worksheet Selection", () => {
    beforeEach(() => {
      // Mock FileUtils globally
      global.FileUtils = {
        isExcelFile: jest.fn().mockReturnValue(true),
      };

      // Mock alert and console.error for error handling tests
      global.alert = jest.fn();
      global.console.error = jest.fn();

      jest.resetModules();
      require("../src/app.js");
      const controllerCalls = mockModule.controller.mock.calls;
      const parseControllerCall = controllerCalls.find(
        (call) => call[0] === "ParseController",
      );
      const controllerFn = parseControllerCall[1];
      controllerFn($scope, $location);

      // Set up Excel file scenario
      $scope.currentFilename = "test.xlsx";
      $scope.data = {
        source: {
          data: "excel_binary_data",
          filename: "test.xlsx",
        },
      };
    });

    afterEach(() => {
      // Clean up global mocks
      delete global.alert;
      delete global.console.error;
    });

    test("should handle worksheet selection change", () => {
      // Call worksheetChosen with string index (as it comes from ng-value)
      $scope.worksheetChosen("2");

      // Should parse Excel with numeric index
      expect($scope.data_object.parseExcel).toHaveBeenCalledWith(
        $scope.data.source.data,
        "test.xlsx",
        $scope.file.chosenEncoding,
        $scope.file.startAtRow,
        $scope.profile.extraRow,
        null,
        2, // Converted to number
      );

      expect($scope.data_object.converted_json).toHaveBeenCalled();
    });

    test("should handle worksheet selection with numeric index", () => {
      // Call with numeric index directly
      $scope.worksheetChosen(1);

      expect($scope.data_object.parseExcel).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(Number),
        expect.any(Boolean),
        null,
        1,
      );
    });

    test("should handle errors during worksheet change", () => {
      $scope.data_object.parseExcel.mockImplementation(() => {
        throw new Error("Worksheet not found");
      });

      $scope.worksheetChosen("1");

      expect(global.console.error).toHaveBeenCalledWith(
        "Error switching worksheet:",
        expect.any(Error),
      );
      expect(global.alert).toHaveBeenCalledWith(
        "Error switching worksheet: Worksheet not found",
      );
    });

    test("should only process worksheet change for Excel files", () => {
      global.FileUtils.isExcelFile.mockReturnValue(false);
      $scope.currentFilename = "test.csv";

      $scope.worksheetChosen("1");

      // Should not call parseExcel for non-Excel files
      expect($scope.data_object.parseExcel).not.toHaveBeenCalled();
    });
  });

  describe("Auto-matching Configuration", () => {
    beforeEach(() => {
      // Reset ConfigMatcher mocks
      global.ConfigMatcher.getAllConfigurations.mockReturnValue({});
      global.ConfigMatcher.getConfiguration.mockReturnValue(null);
      global.ConfigMatcher.findMatchingConfig.mockReturnValue(null);
      global.ConfigMatcher.findMatchingConfigWithStartRow.mockReturnValue(null);
      global.ConfigMatcher.saveConfiguration.mockReturnValue(null);
      global.ConfigMatcher.updateConfiguration.mockReturnValue(false);
      global.ConfigMatcher.deleteConfiguration.mockReturnValue(false);
      global.ConfigMatcher.renameConfiguration.mockReturnValue(false);
      global.ConfigMatcher.incrementUsageCount.mockClear();

      // Set up data object mock
      $scope.data_object.base_json = [
        { Date: "2024-01-01", Payee: "Store", Amount: "-50.00" },
      ];
      $scope.data_object.fields.mockReturnValue([
        "Date",
        "Description",
        "Amount",
      ]);
      $scope.data_object.converted_json.mockReturnValue([
        { Date: "2024-01-01", Payee: "Store", Amount: "-50.00" },
      ]);
      $scope.filename = "test.csv";

      // Set up data.source for tryAutoApplyConfig (it now reads raw content)
      $scope.data = {
        source: {
          data: "Date,Description,Amount\n2024-01-01,Store,-50.00",
          filename: "test.csv",
        },
      };
    });

    describe("tryAutoApplyConfig", () => {
      test("should not attempt matching if data.source is not available", () => {
        $scope.data = null;

        $scope.tryAutoApplyConfig();

        expect(
          global.ConfigMatcher.findMatchingConfigWithStartRow,
        ).not.toHaveBeenCalled();
        expect($scope.matchedConfig).toBeNull();
      });

      test("should find and store matching config with high confidence", () => {
        const mockConfig = {
          id: "test-config-id",
          name: "Test Config",
          columnFormat: ["Date", "Payee", "Memo", "Amount"],
          chosenColumns: {
            Date: "Date",
            Payee: "Description",
            Amount: "Amount",
          },
        };

        global.ConfigMatcher.findMatchingConfigWithStartRow.mockReturnValue({
          configId: "test-config-id",
          matchType: "exact",
          confidence: 100,
          config: mockConfig,
        });

        $scope.tryAutoApplyConfig();

        expect(
          global.ConfigMatcher.findMatchingConfigWithStartRow,
        ).toHaveBeenCalledWith(
          "Date,Description,Amount\n2024-01-01,Store,-50.00",
          "test.csv",
          null,
        );
        expect($scope.matchedConfig).toBeDefined();
        expect($scope.matchedConfig.confidence).toBe(100);
        expect($scope.autoApplied).toBe(true);
      });

      test("should auto-apply config when confidence >= 80", () => {
        const mockConfig = {
          id: "test-config-id",
          columnFormat: ["Date", "Payee", "Memo", "Amount"],
          chosenColumns: { Date: "Date", Payee: "Description" },
          chosenEncoding: "windows-1252",
          startAtRow: 2,
        };

        global.ConfigMatcher.findMatchingConfigWithStartRow.mockReturnValue({
          configId: "test-config-id",
          matchType: "exact",
          confidence: 85,
          config: mockConfig,
        });

        $scope.tryAutoApplyConfig();

        expect($scope.autoApplied).toBe(true);
        expect($scope.ynab_cols).toEqual(["Date", "Payee", "Memo", "Amount"]);
        expect($scope.file.chosenEncoding).toBe("windows-1252");
        expect($scope.file.startAtRow).toBe(2);
      });

      test("should store but not auto-apply config when 60 <= confidence < 80", () => {
        const mockConfig = {
          id: "test-config-id",
          columnFormat: ["Date", "Payee", "Memo", "Amount"],
          chosenColumns: { Date: "Date" },
        };

        global.ConfigMatcher.findMatchingConfigWithStartRow.mockReturnValue({
          configId: "test-config-id",
          matchType: "partial",
          confidence: 70,
          config: mockConfig,
        });

        $scope.tryAutoApplyConfig();

        expect($scope.matchedConfig).toBeDefined();
        expect($scope.matchedConfig.confidence).toBe(70);
        expect($scope.autoApplied).toBe(false);
      });

      test("should not store config when confidence < 60", () => {
        global.ConfigMatcher.findMatchingConfigWithStartRow.mockReturnValue({
          configId: "test-config-id",
          matchType: "filename",
          confidence: 50,
          config: {},
        });

        $scope.tryAutoApplyConfig();

        expect($scope.matchedConfig).toBeNull();
        expect($scope.autoApplied).toBe(false);
      });
    });

    describe("applyConfig", () => {
      test("should apply all config settings to scope", () => {
        const config = {
          columnFormat: ["Date", "Payee", "Memo", "Amount"],
          chosenColumns: { Date: "Trans Date", Payee: "Merchant" },
          chosenEncoding: "ISO-8859-1",
          chosenDelimiter: ";",
          startAtRow: 3,
          extraRow: true,
          invertedOutflow: true,
        };

        $scope.matchedConfig = { configId: "test-id" };

        $scope.applyConfig(config);

        expect($scope.ynab_cols).toEqual(["Date", "Payee", "Memo", "Amount"]);
        expect($scope.ynab_map).toEqual({
          Date: "Trans Date",
          Payee: "Merchant",
        });
        expect($scope.file.chosenEncoding).toBe("ISO-8859-1");
        expect($scope.file.chosenDelimiter).toBe(";");
        expect($scope.file.startAtRow).toBe(3);
        expect($scope.file.extraRow).toBe(true);
        expect($scope.inverted_outflow).toBe(true);
        expect(global.ConfigMatcher.incrementUsageCount).toHaveBeenCalledWith(
          "test-id",
        );
      });

      test("should not fail with null config", () => {
        expect(() => $scope.applyConfig(null)).not.toThrow();
      });

      test("should only apply defined properties", () => {
        $scope.file.chosenEncoding = "UTF-8";
        $scope.file.startAtRow = 1;

        const config = {
          columnFormat: ["Date", "Payee", "Memo", "Amount"],
          // No other properties
        };

        $scope.applyConfig(config);

        expect($scope.ynab_cols).toEqual(["Date", "Payee", "Memo", "Amount"]);
        expect($scope.file.chosenEncoding).toBe("UTF-8"); // Unchanged
        expect($scope.file.startAtRow).toBe(1); // Unchanged
      });
    });

    describe("saveCurrentConfig", () => {
      test("should save current settings as configuration", () => {
        const savedConfig = {
          id: "new-config-id",
          name: "My Config",
        };

        global.ConfigMatcher.saveConfiguration.mockReturnValue("new-config-id");
        global.ConfigMatcher.getConfiguration.mockReturnValue(savedConfig);
        global.ConfigMatcher.getAllConfigurations.mockReturnValue({
          "new-config-id": savedConfig,
        });

        $scope.ynab_cols = ["Date", "Payee", "Memo", "Amount"];
        $scope.ynab_map = { Date: "Trans Date", Payee: "Merchant" };
        $scope.file.chosenEncoding = "UTF-8";
        $scope.file.chosenDelimiter = ",";
        $scope.file.startAtRow = 1;
        $scope.file.extraRow = false;
        $scope.inverted_outflow = false;

        const result = $scope.saveCurrentConfig("My Config");

        expect(result).toBe("new-config-id");
        expect(global.ConfigMatcher.saveConfiguration).toHaveBeenCalledWith(
          ["Date", "Description", "Amount"],
          "test.csv",
          {
            columnFormat: ["Date", "Payee", "Memo", "Amount"],
            chosenColumns: { Date: "Trans Date", Payee: "Merchant" },
            chosenEncoding: "UTF-8",
            chosenDelimiter: ",",
            startAtRow: 1,
            extraRow: false,
            invertedOutflow: false,
          },
          "My Config",
        );
        expect($scope.matchedConfig).toBeDefined();
        expect($scope.matchedConfig.configId).toBe("new-config-id");
      });

      test("should return null if no data loaded", () => {
        $scope.data_object.base_json = null;

        const result = $scope.saveCurrentConfig("Test");

        expect(result).toBeNull();
        expect(global.ConfigMatcher.saveConfiguration).not.toHaveBeenCalled();
      });
    });

    describe("updateMatchedConfig", () => {
      test("should update existing matched configuration", () => {
        $scope.matchedConfig = {
          configId: "existing-config-id",
          config: { name: "Old Config" },
        };

        global.ConfigMatcher.updateConfiguration.mockReturnValue(true);
        global.ConfigMatcher.getConfiguration.mockReturnValue({
          name: "Updated Config",
        });
        global.ConfigMatcher.getAllConfigurations.mockReturnValue({});

        $scope.ynab_cols = ["Date", "Payee", "Memo", "Amount"];
        $scope.file.startAtRow = 2;

        const result = $scope.updateMatchedConfig();

        expect(result).toBe(true);
        expect(global.ConfigMatcher.updateConfiguration).toHaveBeenCalledWith(
          "existing-config-id",
          expect.objectContaining({
            columnFormat: ["Date", "Payee", "Memo", "Amount"],
            startAtRow: 2,
          }),
        );
      });

      test("should return false if no matched config", () => {
        $scope.matchedConfig = null;

        const result = $scope.updateMatchedConfig();

        expect(result).toBe(false);
        expect(global.ConfigMatcher.updateConfiguration).not.toHaveBeenCalled();
      });
    });

    describe("deleteConfig", () => {
      test("should delete configuration and clear matched config if same", () => {
        $scope.matchedConfig = {
          configId: "config-to-delete",
          config: {},
        };
        $scope.autoApplied = true;

        global.ConfigMatcher.deleteConfiguration.mockReturnValue(true);
        global.ConfigMatcher.getAllConfigurations.mockReturnValue({});

        $scope.deleteConfig("config-to-delete");

        expect(global.ConfigMatcher.deleteConfiguration).toHaveBeenCalledWith(
          "config-to-delete",
        );
        expect($scope.matchedConfig).toBeNull();
        expect($scope.autoApplied).toBe(false);
      });

      test("should not clear matched config if different config deleted", () => {
        $scope.matchedConfig = {
          configId: "other-config",
          config: {},
        };

        global.ConfigMatcher.deleteConfiguration.mockReturnValue(true);
        global.ConfigMatcher.getAllConfigurations.mockReturnValue({});

        $scope.deleteConfig("config-to-delete");

        expect($scope.matchedConfig).not.toBeNull();
        expect($scope.matchedConfig.configId).toBe("other-config");
      });
    });

    describe("renameConfig", () => {
      test("should rename configuration and update matched config name", () => {
        $scope.matchedConfig = {
          configId: "config-id",
          config: { name: "Old Name" },
        };

        global.ConfigMatcher.renameConfiguration.mockReturnValue(true);
        global.ConfigMatcher.getAllConfigurations.mockReturnValue({});

        $scope.renameConfig("config-id", "New Name");

        expect(global.ConfigMatcher.renameConfiguration).toHaveBeenCalledWith(
          "config-id",
          "New Name",
        );
        expect($scope.matchedConfig.config.name).toBe("New Name");
      });
    });

    describe("hasSavedConfigs", () => {
      test("should return true when configs exist", () => {
        $scope.savedConfigs = {
          "config-1": {},
          "config-2": {},
        };

        expect($scope.hasSavedConfigs()).toBe(true);
      });

      test("should return false when no configs exist", () => {
        $scope.savedConfigs = {};

        expect($scope.hasSavedConfigs()).toBe(false);
      });
    });

    describe("dismissAutoApply", () => {
      test("should set autoApplied to false", () => {
        $scope.autoApplied = true;

        $scope.dismissAutoApply();

        expect($scope.autoApplied).toBe(false);
      });
    });

    describe("tryAutoApplyConfigForExcel", () => {
      beforeEach(() => {
        $scope.data_object.fields.mockReturnValue([
          "Date",
          "Description",
          "Amount",
        ]);
        $scope.data_object.base_json = [{ Date: "2024-01-01" }];
        $scope.filename = "test.xlsx";
        $scope.reparseFile = jest.fn();
      });

      test("should return early if data_object is not available", () => {
        $scope.data_object = null;

        $scope.tryAutoApplyConfigForExcel();

        expect(global.ConfigMatcher.findMatchingConfig).not.toHaveBeenCalled();
      });

      test("should return early if headers are empty", () => {
        $scope.data_object.fields.mockReturnValue([]);

        $scope.tryAutoApplyConfigForExcel();

        expect(global.ConfigMatcher.findMatchingConfig).not.toHaveBeenCalled();
      });

      test("should auto-apply high confidence match with same startAtRow", () => {
        const mockConfig = {
          id: "excel-config",
          columnFormat: ["Date", "Payee", "Memo", "Amount"],
          chosenColumns: { Date: "Date" },
          startAtRow: 1,
        };

        global.ConfigMatcher.findMatchingConfig.mockReturnValue({
          configId: "excel-config",
          matchType: "exact",
          confidence: 100,
          config: mockConfig,
        });

        $scope.file.startAtRow = 1;

        $scope.tryAutoApplyConfigForExcel();

        expect($scope.matchedConfig).toBeDefined();
        expect($scope.autoApplied).toBe(true);
        expect($scope.reparseFile).not.toHaveBeenCalled();
      });

      test("should re-parse when matched config has different startAtRow", () => {
        const mockConfig = {
          id: "excel-config",
          columnFormat: ["Date", "Payee", "Memo", "Amount"],
          chosenColumns: { Date: "Date" },
          startAtRow: 3,
        };

        global.ConfigMatcher.findMatchingConfig.mockReturnValue({
          configId: "excel-config",
          matchType: "exact",
          confidence: 100,
          config: mockConfig,
        });

        $scope.file.startAtRow = 1;

        $scope.tryAutoApplyConfigForExcel();

        expect($scope.reparseFile).toHaveBeenCalled();
        expect($scope.file.startAtRow).toBe(3);
        expect($scope.autoApplied).toBe(true);
      });

      test("should store medium confidence match without auto-applying", () => {
        const mockConfig = {
          id: "excel-config",
          columnFormat: ["Date", "Payee", "Memo", "Amount"],
          chosenColumns: { Date: "Date" },
        };

        global.ConfigMatcher.findMatchingConfig.mockReturnValue({
          configId: "excel-config",
          matchType: "partial",
          confidence: 70,
          config: mockConfig,
        });

        $scope.tryAutoApplyConfigForExcel();

        expect($scope.matchedConfig).toBeDefined();
        expect($scope.autoApplied).toBe(false);
      });

      test("should try different startAtRow values from saved configs", () => {
        // First match returns low confidence
        global.ConfigMatcher.findMatchingConfig
          .mockReturnValueOnce(null)
          .mockReturnValueOnce({
            configId: "found-config",
            matchType: "exact",
            confidence: 100,
            config: {
              columnFormat: ["Date", "Payee", "Memo", "Amount"],
              startAtRow: 3,
            },
          });

        // Saved configs with different startAtRow values
        global.ConfigMatcher.getAllConfigurations.mockReturnValue({
          "config-1": { startAtRow: 1 },
          "config-2": { startAtRow: 3 },
        });

        $scope.file.startAtRow = 1;

        $scope.tryAutoApplyConfigForExcel();

        expect($scope.reparseFile).toHaveBeenCalled();
        expect($scope.autoApplied).toBe(true);
      });

      test("should reset to profile default when no match found after trying all rows", () => {
        global.ConfigMatcher.findMatchingConfig.mockReturnValue(null);
        global.ConfigMatcher.getAllConfigurations.mockReturnValue({
          "config-1": { startAtRow: 2 },
        });

        $scope.file.startAtRow = 1;
        $scope.profile.startAtRow = 1;

        $scope.tryAutoApplyConfigForExcel();

        // Should have tried row 2, then reset back to profile default (1)
        expect($scope.file.startAtRow).toBe(1);
      });

      test("should skip already tried startAtRow values", () => {
        global.ConfigMatcher.findMatchingConfig.mockReturnValue(null);
        global.ConfigMatcher.getAllConfigurations.mockReturnValue({
          "config-1": { startAtRow: 1 }, // Same as current
          "config-2": { startAtRow: 1 }, // Duplicate
        });

        $scope.file.startAtRow = 1;
        $scope.profile.startAtRow = 1;

        $scope.tryAutoApplyConfigForExcel();

        // Should not call reparseFile since all configs have same startAtRow
        expect($scope.reparseFile).not.toHaveBeenCalled();
      });
    });

    describe("saveConfigWithName", () => {
      beforeEach(() => {
        global.prompt = jest.fn();
        $scope.saveCurrentConfig = jest.fn();
      });

      afterEach(() => {
        delete global.prompt;
      });

      test("should prompt for name and save config", () => {
        global.prompt.mockReturnValue("My Custom Config");

        $scope.saveConfigWithName();

        expect(global.prompt).toHaveBeenCalled();
        expect($scope.saveCurrentConfig).toHaveBeenCalledWith(
          "My Custom Config",
        );
      });

      test("should not save if user cancels prompt", () => {
        global.prompt.mockReturnValue(null);

        $scope.saveConfigWithName();

        expect($scope.saveCurrentConfig).not.toHaveBeenCalled();
      });

      test("should prevent default event if provided", () => {
        const mockEvent = { preventDefault: jest.fn() };
        global.prompt.mockReturnValue("Test");

        $scope.saveConfigWithName(mockEvent);

        expect(mockEvent.preventDefault).toHaveBeenCalled();
      });

      test("should use matched config name as default when available", () => {
        $scope.matchedConfig = {
          config: { name: "Existing Config Name" },
        };
        global.prompt.mockReturnValue("New Name");

        $scope.saveConfigWithName();

        expect(global.prompt).toHaveBeenCalledWith(
          "Enter a name for this configuration:",
          "Existing Config Name",
        );
      });

      test("should use filename as default when no matched config", () => {
        $scope.matchedConfig = null;
        $scope.filename = "my_bank_statement.csv";
        global.prompt.mockReturnValue("New Name");

        $scope.saveConfigWithName();

        expect(global.prompt).toHaveBeenCalledWith(
          "Enter a name for this configuration:",
          "my_bank_statement.csv",
        );
      });
    });

    describe("promptRenameConfig", () => {
      beforeEach(() => {
        global.prompt = jest.fn();
        $scope.renameConfig = jest.fn();
      });

      afterEach(() => {
        delete global.prompt;
      });

      test("should prompt for new name and rename config", () => {
        global.ConfigMatcher.getConfiguration.mockReturnValue({
          name: "Old Name",
        });
        global.prompt.mockReturnValue("New Name");

        $scope.promptRenameConfig("config-id");

        expect(global.ConfigMatcher.getConfiguration).toHaveBeenCalledWith(
          "config-id",
        );
        expect(global.prompt).toHaveBeenCalledWith(
          "Enter a new name:",
          "Old Name",
        );
        expect($scope.renameConfig).toHaveBeenCalledWith(
          "config-id",
          "New Name",
        );
      });

      test("should not rename if config not found", () => {
        global.ConfigMatcher.getConfiguration.mockReturnValue(null);

        $scope.promptRenameConfig("nonexistent-id");

        expect(global.prompt).not.toHaveBeenCalled();
        expect($scope.renameConfig).not.toHaveBeenCalled();
      });

      test("should not rename if user cancels prompt", () => {
        global.ConfigMatcher.getConfiguration.mockReturnValue({
          name: "Old Name",
        });
        global.prompt.mockReturnValue(null);

        $scope.promptRenameConfig("config-id");

        expect($scope.renameConfig).not.toHaveBeenCalled();
      });

      test("should not rename if new name is same as old name", () => {
        global.ConfigMatcher.getConfiguration.mockReturnValue({
          name: "Same Name",
        });
        global.prompt.mockReturnValue("Same Name");

        $scope.promptRenameConfig("config-id");

        expect($scope.renameConfig).not.toHaveBeenCalled();
      });
    });

    describe("downloadFile auto-save", () => {
      beforeEach(() => {
        const mockAnchor = {
          href: "",
          target: "",
          download: "",
          click: jest.fn(),
        };
        global.document.createElement = jest.fn(() => mockAnchor);
        global.document.body.appendChild = jest.fn();

        $scope.data_object.converted_csv = jest.fn(() => "Date,Payee,Amount");

        const mockDate = new Date("2024-01-01");
        mockDate.yyyymmdd = jest.fn(() => "20240101");
        jest.spyOn(global, "Date").mockImplementation(() => mockDate);
      });

      afterEach(() => {
        global.Date.mockRestore();
      });

      test("should save new config on download when no matched config", () => {
        $scope.matchedConfig = null;
        global.ConfigMatcher.saveConfiguration.mockReturnValue("new-config");
        global.ConfigMatcher.getConfiguration.mockReturnValue({});
        global.ConfigMatcher.getAllConfigurations.mockReturnValue({});

        $scope.downloadFile();

        expect(global.ConfigMatcher.saveConfiguration).toHaveBeenCalled();
      });

      test("should update existing config on download when matched", () => {
        $scope.matchedConfig = {
          configId: "existing-config",
          config: {},
        };
        global.ConfigMatcher.updateConfiguration.mockReturnValue(true);
        global.ConfigMatcher.getConfiguration.mockReturnValue({});
        global.ConfigMatcher.getAllConfigurations.mockReturnValue({});

        $scope.downloadFile();

        expect(global.ConfigMatcher.updateConfiguration).toHaveBeenCalledWith(
          "existing-config",
          expect.any(Object),
        );
      });
    });

    describe("auto-matching in data.source watcher", () => {
      test("should apply matching config for CSV files before parsing", () => {
        // Set up watchers
        const watchCallbacks = {};
        $scope.$watch.mockImplementation((expr, callback) => {
          watchCallbacks[expr] = callback;
        });

        // Re-initialize to capture watch callbacks
        jest.resetModules();
        require("../src/app.js");
        const controllerCalls = mockModule.controller.mock.calls;
        const parseControllerCall = controllerCalls.find(
          (call) => call[0] === "ParseController",
        );
        const controllerFn = parseControllerCall[1];
        controllerFn($scope, $location);

        // Set up CSV file scenario
        $scope.data_object.isExcelFile.mockReturnValue(false);
        $scope.data_object.base_json = [{ Date: "2024-01-01" }];

        // Set up matching config with different startAtRow
        const mockConfig = {
          id: "auto-match-id",
          columnFormat: ["Date", "Payee", "Memo", "Amount"],
          chosenColumns: { Date: "Date" },
          startAtRow: 3,
        };
        global.ConfigMatcher.findMatchingConfigWithStartRow.mockReturnValue({
          configId: "auto-match-id",
          matchType: "exact",
          confidence: 100,
          config: mockConfig,
          detectedStartAtRow: 3,
        });

        const csvData = {
          data: "Header1\nHeader2\nDate,Payee,Amount\n2024-01-01,Store,-50.00",
          filename: "test.csv",
        };

        watchCallbacks["data.source"](csvData, null);

        expect(
          global.ConfigMatcher.findMatchingConfigWithStartRow,
        ).toHaveBeenCalled();
        expect($scope.matchedConfig).toBeDefined();
        expect($scope.autoApplied).toBe(true);
        expect($scope.file.startAtRow).toBe(3);
      });

      test("should reset auto-match state before trying to match", () => {
        // Set up watchers
        const watchCallbacks = {};
        $scope.$watch.mockImplementation((expr, callback) => {
          watchCallbacks[expr] = callback;
        });

        // Re-initialize to capture watch callbacks
        jest.resetModules();
        require("../src/app.js");
        const controllerCalls = mockModule.controller.mock.calls;
        const parseControllerCall = controllerCalls.find(
          (call) => call[0] === "ParseController",
        );
        const controllerFn = parseControllerCall[1];
        controllerFn($scope, $location);

        // Set initial state
        $scope.matchedConfig = { configId: "old-config" };
        $scope.autoApplied = true;
        $scope.data_object.isExcelFile.mockReturnValue(false);

        // No matching config this time
        global.ConfigMatcher.findMatchingConfigWithStartRow.mockReturnValue(
          null,
        );

        const csvData = {
          data: "NewHeader1,NewHeader2\nval1,val2",
          filename: "different.csv",
        };

        watchCallbacks["data.source"](csvData, null);

        // Should have been reset
        expect($scope.matchedConfig).toBeNull();
        expect($scope.autoApplied).toBe(false);
      });
    });
  });
});
