// see http://stackoverflow.com/questions/2897619/using-html5-javascript-to-generate-and-save-a-file
// see http://stackoverflow.com/questions/18662404/download-lengthy-data-as-a-csv-file
var encodings = [
  "UTF-8", "IBM866", "ISO-8859-1", "ISO-8859-2", "ISO-8859-3", "ISO-8859-4", "ISO-8859-5",
  "ISO-8859-6", "ISO-8859-7", "ISO-8859-8", "ISO-8859-8-I", "ISO-8859-10",
  "ISO-8859-13", "ISO-8859-14", "ISO-8859-15", "ISO-8859-16", "KOI8-R",
  "KOI8-U", "macintosh", "windows-874", "windows-1250", "windows-1251",
  "windows-1252", "windows-1253", "windows-1254", "windows-1255",
  "windows-1256", "windows-1257", "windows-1258", "x-mac-cyrillic", "GBK",
  "gb18030", "Big5", "EUC-JP", "ISO-2022-JP", "Shift_JIS", "EUC-KR",
  "replacement", "UTF-16BE", "UTF-16LE", "x-user-defined"
]
var delimiters = [
  "auto",
  ",",
  ";",
  "|"
]
var old_ynab_cols = ["Date", "Payee", "Memo", "Outflow", "Inflow"];
var new_ynab_cols = ["Date", "Payee", "Memo", "Amount"];
var defaultProfile = {
  columnFormat: old_ynab_cols,
  chosenColumns: old_ynab_cols.reduce(function (acc, val) {
    acc[val] = val;
    return acc;
  }, {}),
  chosenEncoding: "UTF-8",
  chosenDelimiter: "auto",
  startAtRow: 1,
  extraRow: false
};
var defaultProfiles = {
  "default profile": defaultProfile
};

Date.prototype.yyyymmdd = function () {
  var mm = this.getMonth() + 1; // getMonth() is zero-based
  var dd = this.getDate();

  return [this.getFullYear(),
    (mm > 9 ? '' : '0') + mm,
    (dd > 9 ? '' : '0') + dd
  ].join('');
};

angular.element(document).ready(function () {
  angular.module("app", []);
  angular.module("app").directive("fileread", [
    function () {
      return {
        scope: {
          fileread: "=",
          filename: "="
        },
        link: function (scope, element, attributes) {
          try {
            return element.bind("change", function (changeEvent) {
            var reader;
            var file = changeEvent.target.files[0];
            if (!file) return;
            
            reader = new FileReader();
            reader.onload = function (loadEvent) {
              return scope.$apply(function () {
                // Create a data object with both content and filename
                var dataWithFilename = loadEvent.target.result;
                
                // Attach filename as a property to the data (works for both ArrayBuffer and string)
                if (dataWithFilename instanceof ArrayBuffer) {
                  // For ArrayBuffer, create a wrapper object
                  dataWithFilename = {
                    data: loadEvent.target.result,
                    filename: file.name,
                    isArrayBuffer: true
                  };
                } else if (typeof dataWithFilename === 'string') {
                  // For string data, add filename property
                  try {
                    Object.defineProperty(dataWithFilename, '_filename', {
                      value: file.name,
                      writable: false,
                      enumerable: false
                    });
                  } catch (e) {
                    // Fallback: create wrapper object for strings that can't have properties
                    dataWithFilename = {
                      data: loadEvent.target.result,
                      filename: file.name,
                      isString: true
                    };
                  }
                }
                
                // Set both filename and data
                scope.filename = file.name;
                scope.fileread = dataWithFilename;
              });
            };
            reader.onerror = function (error) {
              console.error('FileReader error:', error);
            };
            
            // Check if it's an Excel file - use appropriate reading method based on format
            // Fallback for test environment where DataObject might not be available
            var isExcel = false;
            var extension = file.name.toLowerCase().split('.').pop();
            
            if (window.DataObject) {
              var dataObject = new window.DataObject();
              isExcel = dataObject.isExcelFile(file.name);
            } else {
              // Simple fallback for testing
              isExcel = ['xlsx', 'xls', 'xlsm', 'xlsb'].includes(extension);
            }
            
            if (isExcel) {
              // Use different reading methods for different Excel formats
              if (['xls', 'xlsb'].includes(extension)) {
                // XLS and XLSB files use OLE2 format, read as ArrayBuffer
                reader.readAsArrayBuffer(file);
              } else {
                // XLSX and XLSM files are ZIP-based, read as binary string
                reader.readAsBinaryString(file);
              }
            } else {
              reader.readAsText(file, attributes.encoding);
            }
          });
          } catch (error) {
            console.error('Error in fileread directive:', error);
          }
        }
      };
    }
  ]);
  angular.module("app").directive("dropzone", [
    function () {
      return {
        transclude: true,
        replace: true,
        template: '<div class="dropzone"><div ng-transclude></div></div>',
        scope: {
          dropzone: "=",
          filename: "="
        },
        link: function (scope, element, attributes) {
          element.bind("dragenter", function (event) {
            element.addClass("dragging");
            event.preventDefault();
          });
          element.bind("dragover", function (event) {
            var efct;
            element.addClass("dragging");
            event.preventDefault();
            event.stopPropagation();
            var dataTransfer;
            dataTransfer = (event.dataTransfer || event.originalEvent.dataTransfer)
            efct = dataTransfer.effectAllowed;
            dataTransfer.dropEffect =
              "move" === efct || "linkMove" === efct ? "move" : "copy";
          });
          element.bind("dragleave", function (event) {
            element.removeClass("dragging");
            event.preventDefault();
          });
          element.bind("drop", function (event) {
            var reader;
            element.removeClass("dragging");
            event.preventDefault();
            event.stopPropagation();
            
            var file = (event.dataTransfer || event.originalEvent.dataTransfer).files[0];
            if (!file) return;
            
            reader = new FileReader();
            reader.onload = function (loadEvent) {
              scope.$apply(function () {
                // Create a data object with both content and filename
                var dataWithFilename = loadEvent.target.result;
                
                // Attach filename as a property to the data (works for both ArrayBuffer and string)
                if (dataWithFilename instanceof ArrayBuffer) {
                  // For ArrayBuffer, create a wrapper object
                  dataWithFilename = {
                    data: loadEvent.target.result,
                    filename: file.name,
                    isArrayBuffer: true
                  };
                } else if (typeof dataWithFilename === 'string') {
                  // For string data, add filename property
                  try {
                    Object.defineProperty(dataWithFilename, '_filename', {
                      value: file.name,
                      writable: false,
                      enumerable: false
                    });
                  } catch (e) {
                    // Fallback: create wrapper object for strings that can't have properties
                    dataWithFilename = {
                      data: loadEvent.target.result,
                      filename: file.name,
                      isString: true
                    };
                  }
                }
                
                // Set both filename and data
                scope.filename = file.name;
                scope.dropzone = dataWithFilename;
              });
            };
            
            // Check if it's an Excel file - use appropriate reading method based on format
            // Fallback for test environment where DataObject might not be available
            var isExcel = false;
            var extension = file.name.toLowerCase().split('.').pop();
            
            if (window.DataObject) {
              var dataObject = new window.DataObject();
              isExcel = dataObject.isExcelFile(file.name);
            } else {
              // Simple fallback for testing
              isExcel = ['xlsx', 'xls', 'xlsm', 'xlsb'].includes(extension);
            }
            
            if (isExcel) {
              // Use different reading methods for different Excel formats
              if (['xls', 'xlsb'].includes(extension)) {
                // XLS and XLSB files use OLE2 format, read as ArrayBuffer
                reader.readAsArrayBuffer(file);
              } else {
                // XLSX and XLSM files are ZIP-based, read as binary string
                reader.readAsBinaryString(file);
              }
            } else {
              reader.readAsText(file, attributes.encoding);
            }
          });
          element.bind("paste", function (event) {
            var items = (event.clipboardData || event.originalEvent.clipboardData).items;
            for (var i = 0; i < items.length; i++) {
              if (items[i].type == 'text/plain') {
                data = items[i];
                break;
              }
            }
            if (!data) return;

            data.getAsString(function(text) {
              scope.$apply(function () {
                scope.dropzone = text;
              });
            });
          });
        }
      };
    }
  ]);
  // Application code
  angular.module("app")
  .config(function($locationProvider) {
    $locationProvider.html5Mode({
      enabled: true,
      requireBase: false,
    }).hashPrefix('!');
  })
  .controller("ParseController", function ($scope, $location) {
    $scope.angular_loaded = true;

    $scope.setInitialScopeState = function () {
      $scope.profileName = ($location.search().profile || localStorage.getItem('profileName') || 'default profile').toLowerCase();
      $scope.profiles = JSON.parse(localStorage.getItem('profiles')) || defaultProfiles;
      if(!$scope.profiles[$scope.profileName]) {
        $scope.profiles[$scope.profileName] = defaultProfile;
      }
      $scope.profile = $scope.profiles[$scope.profileName];
      $scope.ynab_cols = $scope.profile.columnFormat;
      $scope.data = {};
      $scope.ynab_map = $scope.profile.chosenColumns
      $scope.inverted_outflow = false;
      $scope.file = {
        encodings: encodings,
        delimiters: delimiters,
        chosenEncoding: $scope.profile.chosenEncoding || "UTF-8",
        chosenDelimiter: $scope.profile.chosenDelimiter || "auto",
        startAtRow: $scope.profile.startAtRow,
        extraRow: $scope.profile.extraRow || false,
        selectedWorksheet: 0  // Use index as source of truth
      };
      $scope.data_object = new DataObject();
      $scope.filename = null;
    }

    $scope.setInitialScopeState();
    $scope.profileChosen = function (profileName) {
      $location.search('profile', profileName);
      $scope.profile = $scope.profiles[$scope.profileName];
      $scope.ynab_cols = $scope.profile.columnFormat;
      $scope.ynab_map = $scope.profile.chosenColumns;
      localStorage.setItem('profileName', profileName);
    };
    $scope.encodingChosen = function (encoding) {
      $scope.profile.chosenEncoding = encoding;
      localStorage.setItem('profiles', JSON.stringify($scope.profiles));
    };
    $scope.delimiterChosen = function (delimiter) {
      $scope.profile.chosenDelimiter = delimiter;
      localStorage.setItem('profiles', JSON.stringify($scope.profiles));
    };
    $scope.startRowSet = function (startAtRow) {
      $scope.profile.startAtRow = startAtRow;
      localStorage.setItem('profiles', JSON.stringify($scope.profiles));
    };
    $scope.extraRowSet = function (extraRow) {
      $scope.profile.extraRow = extraRow;
      localStorage.setItem('profiles', JSON.stringify($scope.profiles));
    };
    $scope.nonDefaultProfilesExist = function() {
      return Object.keys($scope.profiles).length > 1;
    };
    $scope.toggleColumnFormat = function () {
      if ($scope.ynab_cols == new_ynab_cols) {
        $scope.ynab_cols = old_ynab_cols;
      } else {
        $scope.ynab_cols = new_ynab_cols;
      }
      $scope.profile.columnFormat = $scope.ynab_cols
      localStorage.setItem('profiles', JSON.stringify($scope.profiles));
    };
    
    $scope.$watch("data.source", function (newValue, oldValue) {
      var filename = $scope.filename;
      var actualData = newValue;
      
      if (newValue) {
        // Check if data has embedded filename
        if (newValue.isArrayBuffer && newValue.filename) {
          // Excel data with embedded filename
          filename = newValue.filename;
          actualData = newValue.data;
        } else if (typeof newValue === 'string' && newValue._filename) {
          // CSV data with embedded filename
          filename = newValue._filename;
        } else if (typeof newValue === 'object' && newValue.data) {
          // Wrapper objects (for strings that couldn't have properties added, or other wrapper types)
          filename = newValue.filename || filename;
          actualData = newValue.data;
        }
      }
      
      // Handle both string (CSV) and ArrayBuffer (Excel) data
      if (actualData && ((typeof actualData === 'string' && actualData.length > 0) || (actualData instanceof ArrayBuffer && actualData.byteLength > 0))) {
        try {
          // Check if this is an Excel file using the extracted filename
          if (filename && $scope.data_object.isExcelFile(filename)) {
            // Store the original filename for later use in worksheet switching
            $scope.originalFilename = filename;
            // Parse as Excel file using the actual data
            $scope.data_object.parseExcel(
              actualData, 
              filename, 
              $scope.file.chosenEncoding, 
              $scope.file.startAtRow, 
              $scope.profile.extraRow, 
              $scope.file.chosenDelimiter == "auto" ? null : $scope.file.chosenDelimiter,
              0 // default to first worksheet
            );
          } else {
            // Parse as CSV file (existing logic) using actualData
            if ($scope.file.chosenDelimiter == "auto") {
              $scope.data_object.parseCsv(actualData, $scope.file.chosenEncoding, $scope.file.startAtRow, $scope.profile.extraRow);
            } else {
              $scope.data_object.parseCsv(actualData, $scope.file.chosenEncoding, $scope.file.startAtRow, $scope.profile.extraRow, $scope.file.chosenDelimiter);
            }
          }
          
          // Initialize worksheet selection for Excel files
          if ($scope.filename && $scope.isExcelFile($scope.filename) && $scope.data_object.worksheetNames && $scope.data_object.worksheetNames.length > 0) {
            $scope.file.selectedWorksheet = 0; // Default to first worksheet (index 0)
            // Force Angular to update the binding
            $scope.$evalAsync();
          }
          
          $scope.preview = $scope.data_object.converted_json(10, $scope.ynab_cols, $scope.ynab_map, $scope.inverted_outflow);
        } catch (error) {
          console.error('Error parsing file:', error);
          alert('Error parsing file: ' + error.message);
        }
      }
    });
    $scope.$watch("inverted_outflow", function (newValue, oldValue) {
      if (newValue != oldValue) {
        $scope.preview = $scope.data_object.converted_json(10, $scope.ynab_cols, $scope.ynab_map, $scope.inverted_outflow);
      }
    });
    $scope.$watch(
      "ynab_map",
      function (newValue, oldValue) {
        $scope.profile.chosenColumns = newValue;
        localStorage.setItem('profiles', JSON.stringify($scope.profiles));
        $scope.preview = $scope.data_object.converted_json(10, $scope.ynab_cols, newValue, $scope.inverted_outflow);
      },
      true
    );
    $scope.csvString = function () {
      return $scope.data_object.converted_csv(null, $scope.ynab_cols, $scope.ynab_map, $scope.inverted_outflow);
    };
    $scope.reloadApp = function () {
      $scope.setInitialScopeState();
    }
    $scope.invert_flows = function () {
      $scope.inverted_outflow = !$scope.inverted_outflow;
    }
    
    // Helper methods for file type detection and display
    $scope.isExcelFile = function(filename) {
      if (!filename) return false;
      var extension = filename.toLowerCase().split('.').pop();
      return ['xlsx', 'xls', 'xlsm', 'xlsb'].includes(extension);
    };
    
    $scope.getFileType = function(filename) {
      if (!filename) return '';
      var extension = filename.toLowerCase().split('.').pop();
      if (['xlsx', 'xls', 'xlsm', 'xlsb'].includes(extension)) {
        return extension.toUpperCase();
      }
      return 'CSV';
    };

    // Handle worksheet selection for Excel files
    $scope.worksheetChosen = function(worksheetIndex) {
      if (($scope.filename || $scope.originalFilename) && $scope.data.source && $scope.isExcelFile($scope.filename || $scope.originalFilename)) {
        try {
          var actualData = $scope.data.source;

          // Extract actual data from wrapper objects (same logic as in $watch)
          if ($scope.data.source.isArrayBuffer && $scope.data.source.data) {
            actualData = $scope.data.source.data;
          } else if ($scope.data.source.isString && $scope.data.source.data) {
            actualData = $scope.data.source.data;
          } else if (typeof $scope.data.source === 'object' && $scope.data.source.data) {
            actualData = $scope.data.source.data;
          }

          // Convert to number if it's a string (from ng-value)
          var index = typeof worksheetIndex === 'string' ? parseInt(worksheetIndex, 10) : worksheetIndex;

          // Re-parse the Excel file with the selected worksheet
          $scope.data_object.parseExcel(
            actualData,
            $scope.filename || $scope.originalFilename,
            $scope.file.chosenEncoding,
            $scope.file.startAtRow,
            $scope.profile.extraRow,
            $scope.file.chosenDelimiter == "auto" ? null : $scope.file.chosenDelimiter,
            index
          );

          $scope.preview = $scope.data_object.converted_json(10, $scope.ynab_cols, $scope.ynab_map, $scope.inverted_outflow);
          // Force Angular to update the view
          $scope.$evalAsync();
        } catch (error) {
          console.error('Error switching worksheet:', error);
          alert('Error switching worksheet: ' + error.message);
        }
      }
    };
    $scope.downloadFile = function () {
      var a;
      var date = new Date();
      a = document.createElement("a");
      a.href =
        "data:attachment/csv;base64," +
        btoa(unescape(encodeURIComponent($scope.csvString())));
      a.target = "_blank";
      a.download = `ynab_data_${date.yyyymmdd()}.csv`;
      document.body.appendChild(a);
      a.click();
    };
  });
  angular.bootstrap(document, ["app"]);
});
