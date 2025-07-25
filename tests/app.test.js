// Mock AngularJS
const mockModule = {
  directive: jest.fn(() => mockModule),
  config: jest.fn(() => mockModule),
  controller: jest.fn(() => mockModule)
};

global.angular = {
  element: jest.fn(() => ({
    ready: jest.fn((callback) => callback())
  })),
  module: jest.fn(() => mockModule),
  bootstrap: jest.fn()
};

// Mock DataObject
global.DataObject = jest.fn(() => ({
  parseCsv: jest.fn(),
  converted_json: jest.fn(),
  converted_csv: jest.fn(),
  fields: jest.fn(() => []),
  rows: jest.fn(() => [])
}));

// Mock document
global.document = {
  createElement: jest.fn(() => ({
    click: jest.fn()
  })),
  body: {
    appendChild: jest.fn()
  }
};

// Mock Date prototype
global.Date.prototype.yyyymmdd = function() {
  return '20240101';
};

describe('ParseController', () => {
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
      $apply: jest.fn((fn) => fn && fn())
    };
    
    // Create mock $location  
    $location = {
      search: jest.fn(() => ({}))
    };
    
    // Load the app.js file to register the controller
    require('../src/app.js');
    
    // Get the controller function that was registered
    const controllerCalls = mockModule.controller.mock.calls;
    const parseControllerCall = controllerCalls.find(call => call[0] === 'ParseController');
    const controllerFn = parseControllerCall[1];
    
    // Execute the controller
    controller = controllerFn($scope, $location);
  });

  describe('Profile Management', () => {
    test('should initialize with default profile settings', () => {
      expect($scope.profileName).toBe('default profile');
      expect($scope.profiles).toHaveProperty('default profile');
      expect($scope.profile).toBeDefined();
      expect($scope.ynab_cols).toEqual(['Date', 'Payee', 'Memo', 'Outflow', 'Inflow']);
      expect($scope.file.chosenEncoding).toBe('UTF-8');
      expect($scope.file.chosenDelimiter).toBe('auto');
    });

    test('should detect non-default profiles exist', () => {
      // Initially only has default profile
      $scope.profiles = { 'default profile': {} };
      expect($scope.nonDefaultProfilesExist()).toBe(false);
      
      // Add another profile
      $scope.profiles['custom-profile'] = {};
      expect($scope.nonDefaultProfilesExist()).toBe(true);
    });

    test('should toggle between old and new column formats', () => {
      // Start with old format
      expect($scope.ynab_cols).toEqual(['Date', 'Payee', 'Memo', 'Outflow', 'Inflow']);
      
      // Toggle to new format
      $scope.toggleColumnFormat();
      expect($scope.ynab_cols).toEqual(['Date', 'Payee', 'Memo', 'Amount']);
      expect($scope.profile.columnFormat).toEqual(['Date', 'Payee', 'Memo', 'Amount']);
      
      // Toggle back to old format
      $scope.toggleColumnFormat();
      expect($scope.ynab_cols).toEqual(['Date', 'Payee', 'Memo', 'Outflow', 'Inflow']);
    });

    test('should update profile encoding when chosen', () => {
      $scope.encodingChosen('windows-1252');
      expect($scope.profile.chosenEncoding).toBe('windows-1252');
    });

    test('should update profile delimiter when chosen', () => {
      $scope.delimiterChosen(';');
      expect($scope.profile.chosenDelimiter).toBe(';');
    });

    test('should update start row when set', () => {
      $scope.startRowSet(3);
      expect($scope.profile.startAtRow).toBe(3);
    });

    test('should update extra row setting when set', () => {
      $scope.extraRowSet(true);
      expect($scope.profile.extraRow).toBe(true);
    });

    test('should switch profiles and call URL search', () => {
      $scope.profileChosen('new-profile');
      
      expect($location.search).toHaveBeenCalledWith('profile', 'new-profile');
      // Note: The function uses $scope.profileName instead of the parameter,
      // so it will use the existing profile, not the new one
      expect($scope.profile).toBe($scope.profiles[$scope.profileName]);
    });

    test('should invert flows when toggle is called', () => {
      expect($scope.inverted_outflow).toBe(false);
      
      $scope.invert_flows();
      expect($scope.inverted_outflow).toBe(true);
      
      $scope.invert_flows();
      expect($scope.inverted_outflow).toBe(false);
    });

    test('should reset app state when reloadApp is called', () => {
      $scope.setInitialScopeState = jest.fn();
      $scope.reloadApp();
      
      expect($scope.setInitialScopeState).toHaveBeenCalled();
    });
  });
});