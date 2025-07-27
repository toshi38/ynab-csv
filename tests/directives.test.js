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

describe("AngularJS Directives", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Load the app.js file to register the directives
    require("../src/app.js");
  });

  describe("fileread directive", () => {
    let directiveFactory;
    let mockElement;
    let mockScope;
    let mockAttributes;

    beforeEach(() => {
      // Get the fileread directive factory
      const directiveCalls = mockModule.directive.mock.calls;
      const filereadCall = directiveCalls.find(
        (call) => call[0] === "fileread",
      );
      // The directive is defined as an array with the function as the last element
      directiveFactory = filereadCall[1][0];

      // Create mocks
      mockScope = {
        fileread: null,
        $apply: jest.fn((fn) => fn && fn()),
      };

      mockElement = {
        bind: jest.fn(),
      };

      mockAttributes = {
        encoding: "UTF-8",
      };
    });

    test("should register fileread directive", () => {
      expect(directiveFactory).toBeDefined();
      expect(typeof directiveFactory).toBe("function");
    });

    test("should configure directive with correct scope", () => {
      const directiveConfig = directiveFactory();

      expect(directiveConfig.scope).toEqual({
        fileread: "=",
        filename: "=",
      });
    });

    test("should bind change event to element", () => {
      const directiveConfig = directiveFactory();
      directiveConfig.link(mockScope, mockElement, mockAttributes);

      expect(mockElement.bind).toHaveBeenCalledWith(
        "change",
        expect.any(Function),
      );
    });

    test("should process file when change event occurs", () => {
      const directiveConfig = directiveFactory();
      directiveConfig.link(mockScope, mockElement, mockAttributes);

      // Get the change event handler
      const changeHandler = mockElement.bind.mock.calls[0][1];

      // Mock FileReader
      const mockReader = {
        onload: null,
        readAsText: jest.fn(),
      };
      global.FileReader = jest.fn(() => mockReader);

      // Mock event
      const mockEvent = {
        target: {
          files: [{ name: "test.csv", size: 100 }],
        },
      };

      // Execute change handler
      changeHandler(mockEvent);

      expect(global.FileReader).toHaveBeenCalled();
      expect(mockReader.readAsText).toHaveBeenCalledWith(
        mockEvent.target.files[0],
        "UTF-8",
      );
    });

    test("should update scope when file is loaded", () => {
      const directiveConfig = directiveFactory();
      directiveConfig.link(mockScope, mockElement, mockAttributes);

      const changeHandler = mockElement.bind.mock.calls[0][1];

      const mockReader = {
        onload: null,
        readAsText: jest.fn(),
      };
      global.FileReader = jest.fn(() => mockReader);

      const mockEvent = {
        target: { files: [{ name: "test.csv" }] },
      };

      changeHandler(mockEvent);

      // Simulate file load
      const loadEvent = {
        target: { result: "csv,data\ntest,value" },
      };
      mockReader.onload(loadEvent);

      expect(mockScope.$apply).toHaveBeenCalled();
      // For CSV files, the data is wrapped in an object with filename
      expect(mockScope.fileread).toEqual({
        data: "csv,data\ntest,value",
        filename: "test.csv",
      });
    });
  });

  describe("dropzone directive", () => {
    let directiveFactory;
    let mockElement;
    let mockScope;
    let mockAttributes;

    beforeEach(() => {
      // Get the dropzone directive factory
      const directiveCalls = mockModule.directive.mock.calls;
      const dropzoneCall = directiveCalls.find(
        (call) => call[0] === "dropzone",
      );
      // The directive is defined as an array with the function as the last element
      directiveFactory = dropzoneCall[1][0];

      mockScope = {
        dropzone: null,
        $apply: jest.fn((fn) => fn && fn()),
      };

      mockElement = {
        bind: jest.fn(),
        addClass: jest.fn(),
        removeClass: jest.fn(),
      };

      mockAttributes = {
        encoding: "UTF-8",
      };
    });

    test("should register dropzone directive", () => {
      expect(directiveFactory).toBeDefined();
      expect(typeof directiveFactory).toBe("function");
    });

    test("should configure directive correctly", () => {
      const directiveConfig = directiveFactory();

      expect(directiveConfig.transclude).toBe(true);
      expect(directiveConfig.replace).toBe(true);
      expect(directiveConfig.template).toBe(
        '<div class="dropzone"><div ng-transclude></div></div>',
      );
      expect(directiveConfig.scope).toEqual({
        dropzone: "=",
        filename: "=",
      });
    });

    test("should bind drag and drop events", () => {
      const directiveConfig = directiveFactory();
      directiveConfig.link(mockScope, mockElement, mockAttributes);

      const expectedEvents = [
        "dragenter",
        "dragover",
        "dragleave",
        "drop",
        "paste",
      ];
      expectedEvents.forEach((eventName) => {
        expect(mockElement.bind).toHaveBeenCalledWith(
          eventName,
          expect.any(Function),
        );
      });
    });

    test("should handle dragenter event", () => {
      const directiveConfig = directiveFactory();
      directiveConfig.link(mockScope, mockElement, mockAttributes);

      // Get the dragenter handler
      const bindCalls = mockElement.bind.mock.calls;
      const dragenterCall = bindCalls.find((call) => call[0] === "dragenter");
      const dragenterHandler = dragenterCall[1];

      const mockEvent = {
        preventDefault: jest.fn(),
      };

      dragenterHandler(mockEvent);

      expect(mockElement.addClass).toHaveBeenCalledWith("dragging");
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    test("should handle dragover event", () => {
      const directiveConfig = directiveFactory();
      directiveConfig.link(mockScope, mockElement, mockAttributes);

      const bindCalls = mockElement.bind.mock.calls;
      const dragoverCall = bindCalls.find((call) => call[0] === "dragover");
      const dragoverHandler = dragoverCall[1];

      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        dataTransfer: {
          effectAllowed: "move",
          dropEffect: null,
        },
      };

      dragoverHandler(mockEvent);

      expect(mockElement.addClass).toHaveBeenCalledWith("dragging");
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(mockEvent.dataTransfer.dropEffect).toBe("move");
    });

    test("should handle dragleave event", () => {
      const directiveConfig = directiveFactory();
      directiveConfig.link(mockScope, mockElement, mockAttributes);

      const bindCalls = mockElement.bind.mock.calls;
      const dragleaveCall = bindCalls.find((call) => call[0] === "dragleave");
      const dragleaveHandler = dragleaveCall[1];

      const mockEvent = {
        preventDefault: jest.fn(),
      };

      dragleaveHandler(mockEvent);

      expect(mockElement.removeClass).toHaveBeenCalledWith("dragging");
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    test("should handle drop event", () => {
      const directiveConfig = directiveFactory();
      directiveConfig.link(mockScope, mockElement, mockAttributes);

      const bindCalls = mockElement.bind.mock.calls;
      const dropCall = bindCalls.find((call) => call[0] === "drop");
      const dropHandler = dropCall[1];

      const mockReader = {
        onload: null,
        readAsText: jest.fn(),
      };
      global.FileReader = jest.fn(() => mockReader);

      // Mock the global 'file' variable that's used in the directive
      global.file = null;

      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        dataTransfer: {
          files: [{ name: "dropped.csv", size: 200 }],
        },
      };

      dropHandler(mockEvent);

      expect(mockElement.removeClass).toHaveBeenCalledWith("dragging");
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(global.FileReader).toHaveBeenCalled();
      expect(mockReader.readAsText).toHaveBeenCalledWith(
        mockEvent.dataTransfer.files[0],
        "UTF-8",
      );
    });

    test("should handle paste event with text data", () => {
      const directiveConfig = directiveFactory();
      directiveConfig.link(mockScope, mockElement, mockAttributes);

      const bindCalls = mockElement.bind.mock.calls;
      const pasteCall = bindCalls.find((call) => call[0] === "paste");
      const pasteHandler = pasteCall[1];

      // Mock the global 'data' variable that's used in the directive
      global.data = null;

      const mockDataItem = {
        type: "text/plain",
        getAsString: jest.fn((callback) =>
          callback("pasted,csv,data\nrow1,row2,row3"),
        ),
      };

      const mockEvent = {
        clipboardData: {
          items: [mockDataItem],
        },
      };

      pasteHandler(mockEvent);

      expect(mockDataItem.getAsString).toHaveBeenCalledWith(
        expect.any(Function),
      );
      expect(mockScope.$apply).toHaveBeenCalled();
      expect(mockScope.dropzone).toBe("pasted,csv,data\nrow1,row2,row3");
    });

    test("should handle paste event with no text data", () => {
      const directiveConfig = directiveFactory();
      directiveConfig.link(mockScope, mockElement, mockAttributes);

      const bindCalls = mockElement.bind.mock.calls;
      const pasteCall = bindCalls.find((call) => call[0] === "paste");
      const pasteHandler = pasteCall[1];

      // Mock the global 'data' variable that's used in the directive
      global.data = null;

      const mockEvent = {
        clipboardData: {
          items: [{ type: "image/png" }, { type: "application/json" }],
        },
      };

      pasteHandler(mockEvent);

      // Should not call $apply since no text/plain data found
      expect(mockScope.$apply).not.toHaveBeenCalled();
    });
  });

  describe("fileParsingSettings directive", () => {
    let directiveFactory;
    let mockScope;
    let mockElement;
    let mockAttributes;

    beforeEach(() => {
      // Get the fileParsingSettings directive factory
      const directiveCalls = mockModule.directive.mock.calls;
      const fileParsingSettingsCall = directiveCalls.find(
        (call) => call[0] === "fileParsingSettings",
      );
      // The directive is defined as an array with the function as the last element
      directiveFactory = fileParsingSettingsCall[1][0];

      mockScope = {
        file: {
          encodings: ["UTF-8", "ISO-8859-1"],
          delimiters: ["auto", ",", ";"],
          chosenEncoding: "UTF-8",
          chosenDelimiter: "auto",
          startAtRow: 1,
          extraRow: false,
        },
        profiles: { "default profile": {} },
        profileName: "default profile",
        onEncodingChange: jest.fn(),
        onDelimiterChange: jest.fn(),
        onStartRowChange: jest.fn(),
        onExtraRowChange: jest.fn(),
        onProfileChange: jest.fn(),
        showProfiles: false,
        worksheetNames: null,
        selectedWorksheet: 0,
        onWorksheetChange: jest.fn(),
      };

      mockElement = {};
      mockAttributes = {};
    });

    test("should register fileParsingSettings directive", () => {
      expect(directiveFactory).toBeDefined();
      expect(typeof directiveFactory).toBe("function");
    });

    test("should configure directive correctly", () => {
      const directiveConfig = directiveFactory();

      expect(directiveConfig.restrict).toBe("E");
      expect(directiveConfig.scope).toEqual({
        file: "=",
        profiles: "=",
        profileName: "=",
        onEncodingChange: "&",
        onDelimiterChange: "&",
        onStartRowChange: "&",
        onExtraRowChange: "&",
        onProfileChange: "&",
        showProfiles: "=",
        worksheetNames: "=",
        selectedWorksheet: "=",
        onWorksheetChange: "&",
      });
      expect(typeof directiveConfig.template).toBe("string");
      expect(directiveConfig.template).toContain("file-parsing-settings");
    });

    test("should generate unique ID in link function", () => {
      const directiveConfig = directiveFactory();
      const scope = { ...mockScope };

      directiveConfig.link(scope, mockElement, mockAttributes);

      expect(scope.uniqueId).toBeDefined();
      expect(typeof scope.uniqueId).toBe("string");
      expect(scope.uniqueId).toMatch(/^fps-[a-z0-9]{9}$/);
    });

    test("should render all form elements in template", () => {
      const directiveConfig = directiveFactory();
      const template = directiveConfig.template;

      // Check for encoding select
      expect(template).toContain("Character encoding");
      expect(template).toContain('ng-model="file.chosenEncoding"');
      expect(template).toContain('data-testid="encoding-select"');

      // Check for delimiter select
      expect(template).toContain("Cell delimiter");
      expect(template).toContain('ng-model="file.chosenDelimiter"');
      expect(template).toContain('data-testid="delimiter-select"');

      // Check for start row input
      expect(template).toContain("Start at row");
      expect(template).toContain('ng-model="file.startAtRow"');
      expect(template).toContain('data-testid="start-row-input"');

      // Check for extra row checkbox
      expect(template).toContain("Fill header row from first line");
      expect(template).toContain('ng-model="file.extraRow"');
      expect(template).toContain('data-testid="extra-row-checkbox"');

      // Check for profile select (conditional)
      expect(template).toContain("Bank profile");
      expect(template).toContain('ng-if="showProfiles"');
      expect(template).toContain('data-testid="profile-select"');

      // Check for worksheet select (conditional)
      expect(template).toContain("Excel worksheet");
      expect(template).toContain(
        'ng-if="worksheetNames && worksheetNames.length > 1"',
      );
      expect(template).toContain('data-testid="worksheet-select"');
    });

    test("should bind callbacks correctly", () => {
      const directiveConfig = directiveFactory();
      const template = directiveConfig.template;

      // Check encoding change callback
      expect(template).toContain(
        'ng-change="onEncodingChange({encoding: file.chosenEncoding})"',
      );

      // Check delimiter change callback
      expect(template).toContain(
        'ng-change="onDelimiterChange({delimiter: file.chosenDelimiter})"',
      );

      // Check start row change callback
      expect(template).toContain(
        'ng-change="onStartRowChange({row: file.startAtRow})"',
      );

      // Check extra row change callback
      expect(template).toContain(
        'ng-change="onExtraRowChange({extraRow: file.extraRow})"',
      );

      // Check profile change callback
      expect(template).toContain(
        'ng-change="onProfileChange({profileName: profileName})"',
      );

      // Check worksheet change callback
      expect(template).toContain(
        'ng-change="onWorksheetChange({worksheet: selectedWorksheet})"',
      );
    });

    test("should use unique IDs for form elements", () => {
      const directiveConfig = directiveFactory();
      const template = directiveConfig.template;

      // Check that all form elements use unique ID pattern
      expect(template).toContain('id="{{::uniqueId}}-encoding"');
      expect(template).toContain('for="{{::uniqueId}}-encoding"');
      expect(template).toContain('id="{{::uniqueId}}-delimiter"');
      expect(template).toContain('for="{{::uniqueId}}-delimiter"');
      expect(template).toContain('id="{{::uniqueId}}-start-row"');
      expect(template).toContain('for="{{::uniqueId}}-start-row"');
      expect(template).toContain('id="{{::uniqueId}}-extra-row"');
      expect(template).toContain('for="{{::uniqueId}}-extra-row"');
      expect(template).toContain('id="{{::uniqueId}}-profile"');
      expect(template).toContain('for="{{::uniqueId}}-profile"');
      expect(template).toContain('id="{{::uniqueId}}-worksheet"');
      expect(template).toContain('for="{{::uniqueId}}-worksheet"');
    });
  });

  // TODO: Add Excel directive tests (currently complex due to sophisticated file handling logic)
});
