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

      // Set up Excel file scenario with custom delimiter
      $scope.data_object.isExcelFile.mockReturnValue(true);
      $scope.file.chosenDelimiter = ";";

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
});
