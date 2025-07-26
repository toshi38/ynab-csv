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
  // Shared helper functions for file processing


  function processFile(file, scope, targetProperty, attributes) {
    var reader = new FileReader();

    reader.onload = function(loadEvent) {
      scope.$apply(function() {
        var fileData = FileUtils.createDataWrapper(loadEvent.target.result, file.name);
        scope.filename = file.name;
        scope[targetProperty] = fileData;
      });
    };

    reader.onerror = function(error) {
      console.error('FileReader error:', error);
    };
    if (FileUtils.isExcelFile(file.name)) {
      var method = FileUtils.getExcelReadingMethod(file.name);
      if (method === 'arrayBuffer') {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsBinaryString(file);
      }
    } else {
      reader.readAsText(file, attributes.encoding);
    }
  }

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
            element.bind("change", function (changeEvent) {
              var file = changeEvent.target.files[0];
              if (!file) return;

              processFile(file, scope, 'fileread', attributes);
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
            element.removeClass("dragging");
            event.preventDefault();
            event.stopPropagation();

            var file = (event.dataTransfer || event.originalEvent.dataTransfer).files[0];
            if (!file) return;

            processFile(file, scope, 'dropzone', attributes);
          });
          element.bind("paste", function (event) {
            var items = (event.clipboardData || event.originalEvent.clipboardData).items;
            var data;
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
      if (newValue && newValue.data && newValue.filename) {
        try {
          // Store filename for later use in worksheet switching
          $scope.currentFilename = newValue.filename;

          // Process file based on type
          if ($scope.data_object.isExcelFile(newValue.filename)) {
            // Parse as Excel file
            $scope.data_object.parseExcel(
              newValue.data,
              newValue.filename,
              $scope.file.chosenEncoding,
              $scope.file.startAtRow,
              $scope.profile.extraRow,
              $scope.file.chosenDelimiter == "auto" ? null : $scope.file.chosenDelimiter,
              0 // default to first worksheet
            );

            // Initialize worksheet selection for multi-sheet Excel files
            if ($scope.data_object.worksheetNames && $scope.data_object.worksheetNames.length > 0) {
              $scope.file.selectedWorksheet = 0; // Default to first worksheet (index 0)
              $scope.$evalAsync();
            }
          } else {
            // Parse as CSV file
            if ($scope.file.chosenDelimiter == "auto") {
              $scope.data_object.parseCsv(newValue.data, $scope.file.chosenEncoding, $scope.file.startAtRow, $scope.profile.extraRow);
            } else {
              $scope.data_object.parseCsv(newValue.data, $scope.file.chosenEncoding, $scope.file.startAtRow, $scope.profile.extraRow, $scope.file.chosenDelimiter);
            }
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


    // Handle worksheet selection for Excel files
    $scope.worksheetChosen = function(worksheetIndex) {
      if ($scope.currentFilename && $scope.data.source && FileUtils.isExcelFile($scope.currentFilename)) {
        try {
          // Convert to number if it's a string (from ng-value)
          var index = typeof worksheetIndex === 'string' ? parseInt(worksheetIndex, 10) : worksheetIndex;

          // Re-parse the Excel file with the selected worksheet
          $scope.data_object.parseExcel(
            $scope.data.source.data,
            $scope.currentFilename,
            $scope.file.chosenEncoding,
            $scope.file.startAtRow,
            $scope.profile.extraRow,
            $scope.file.chosenDelimiter == "auto" ? null : $scope.file.chosenDelimiter,
            index
          );

          $scope.preview = $scope.data_object.converted_json(10, $scope.ynab_cols, $scope.ynab_map, $scope.inverted_outflow);
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


