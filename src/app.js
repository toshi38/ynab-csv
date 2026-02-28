// see http://stackoverflow.com/questions/2897619/using-html5-javascript-to-generate-and-save-a-file
// see http://stackoverflow.com/questions/18662404/download-lengthy-data-as-a-csv-file
var encodings = [
  "UTF-8",
  "IBM866",
  "ISO-8859-1",
  "ISO-8859-2",
  "ISO-8859-3",
  "ISO-8859-4",
  "ISO-8859-5",
  "ISO-8859-6",
  "ISO-8859-7",
  "ISO-8859-8",
  "ISO-8859-8-I",
  "ISO-8859-10",
  "ISO-8859-13",
  "ISO-8859-14",
  "ISO-8859-15",
  "ISO-8859-16",
  "KOI8-R",
  "KOI8-U",
  "macintosh",
  "windows-874",
  "windows-1250",
  "windows-1251",
  "windows-1252",
  "windows-1253",
  "windows-1254",
  "windows-1255",
  "windows-1256",
  "windows-1257",
  "windows-1258",
  "x-mac-cyrillic",
  "GBK",
  "gb18030",
  "Big5",
  "EUC-JP",
  "ISO-2022-JP",
  "Shift_JIS",
  "EUC-KR",
  "replacement",
  "UTF-16BE",
  "UTF-16LE",
  "x-user-defined",
];
var delimiters = ["auto", ",", ";", "|"];
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
  extraRow: false,
};
var defaultProfiles = {
  "default profile": defaultProfile,
};

Date.prototype.yyyymmdd = function () {
  var mm = this.getMonth() + 1; // getMonth() is zero-based
  var dd = this.getDate();

  return [
    this.getFullYear(),
    (mm > 9 ? "" : "0") + mm,
    (dd > 9 ? "" : "0") + dd,
  ].join("");
};

angular.element(document).ready(function () {
  // Shared helper functions for file processing

  function processFile(file, scope, targetProperty, attributes) {
    var reader = new FileReader();

    reader.onload = function (loadEvent) {
      scope.$apply(function () {
        var fileData = FileUtils.createDataWrapper(
          loadEvent.target.result,
          file.name,
        );
        scope.filename = file.name;
        scope[targetProperty] = fileData;
      });
    };

    reader.onerror = function (error) {
      console.error("FileReader error:", error);
    };
    if (FileUtils.isExcelFile(file.name)) {
      var method = FileUtils.getExcelReadingMethod(file.name);
      if (method === "arrayBuffer") {
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
          filename: "=",
        },
        link: function (scope, element, attributes) {
          try {
            element.bind("change", function (changeEvent) {
              var file = changeEvent.target.files[0];
              if (!file) return;

              processFile(file, scope, "fileread", attributes);
            });
          } catch (error) {
            console.error("Error in fileread directive:", error);
          }
        },
      };
    },
  ]);
  angular.module("app").directive("fileParsingSettings", [
    function () {
      return {
        restrict: "E",
        scope: {
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
        },
        template:
          '<div class="file-parsing-settings">' +
          '  <div class="form-group input-group-sm">' +
          '    <label for="{{::uniqueId}}-encoding">Character encoding</label>' +
          '    <select id="{{::uniqueId}}-encoding" ' +
          '            ng-model="file.chosenEncoding" ' +
          '            ng-options="enc for enc in file.encodings track by enc" ' +
          '            ng-change="onEncodingChange({encoding: file.chosenEncoding})" ' +
          '            ng-click="$event.stopPropagation()" ' +
          '            class="form-control" ' +
          '            data-testid="encoding-select">' +
          "    </select>" +
          "  </div>" +
          '  <div class="form-group">' +
          '    <label for="{{::uniqueId}}-delimiter">Cell delimiter</label>' +
          '    <select id="{{::uniqueId}}-delimiter" ' +
          '            ng-model="file.chosenDelimiter" ' +
          '            ng-options="enc for enc in file.delimiters track by enc" ' +
          '            ng-change="onDelimiterChange({delimiter: file.chosenDelimiter})" ' +
          '            ng-click="$event.stopPropagation()" ' +
          '            class="form-control" ' +
          '            data-testid="delimiter-select">' +
          "    </select>" +
          "  </div>" +
          '  <div class="form-group" ng-if="worksheetNames && worksheetNames.length > 1">' +
          '    <label for="{{::uniqueId}}-worksheet">Excel worksheet</label>' +
          '    <select id="{{::uniqueId}}-worksheet" ' +
          '            ng-model="selectedWorksheet" ' +
          '            ng-change="onWorksheetChange({worksheet: selectedWorksheet})" ' +
          '            class="form-control" ' +
          '            data-testid="worksheet-select">' +
          '      <option ng-repeat="name in worksheetNames track by $index" ' +
          '              ng-value="$index" ' +
          '              ng-selected="$index == selectedWorksheet">' +
          "        {{name}}" +
          "      </option>" +
          "    </select>" +
          "  </div>" +
          '  <div class="form-group">' +
          '    <label for="{{::uniqueId}}-start-row">Start at row</label>' +
          '    <input id="{{::uniqueId}}-start-row" ' +
          '           type="number" ' +
          '           min="1" ' +
          '           ng-model="file.startAtRow" ' +
          '           ng-change="onStartRowChange({row: file.startAtRow})" ' +
          '           class="form-control" ' +
          '           data-testid="start-row-input" />' +
          "  </div>" +
          '  <div class="form-check" style="margin-bottom: 12px">' +
          '    <input id="{{::uniqueId}}-extra-row" ' +
          '           type="checkbox" ' +
          '           ng-model="file.extraRow" ' +
          '           ng-change="onExtraRowChange({extraRow: file.extraRow})" ' +
          '           class="form-check-input" ' +
          '           value="" ' +
          '           data-testid="extra-row-checkbox" />' +
          '    <label for="{{::uniqueId}}-extra-row" class="form-check-label">' +
          "      Fill header row from first line" +
          "    </label>" +
          "  </div>" +
          '  <div class="form-group" ng-if="showProfiles">' +
          '    <label for="{{::uniqueId}}-profile">Bank profile</label>' +
          '    <select id="{{::uniqueId}}-profile" ' +
          '            name="ngvalueselect" ' +
          '            ng-model="profileName" ' +
          '            class="form-control" ' +
          '            ng-click="$event.stopPropagation()" ' +
          '            ng-change="onProfileChange({profileName: profileName})" ' +
          '            data-testid="profile-select">' +
          '      <option ng-repeat="(name,profile) in profiles" ng-value="name">' +
          "        {{name}}" +
          "      </option>" +
          "    </select>" +
          "  </div>" +
          "</div>",
        link: function (scope, element, attrs) {
          // Generate unique ID for form elements to avoid conflicts
          scope.uniqueId = "fps-" + Math.random().toString(36).substr(2, 9);
        },
      };
    },
  ]);
  angular.module("app").directive("dropzone", [
    function () {
      return {
        transclude: true,
        replace: true,
        template: '<div class="dropzone"><div ng-transclude></div></div>',
        scope: {
          dropzone: "=",
          filename: "=",
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
            dataTransfer =
              event.dataTransfer || event.originalEvent.dataTransfer;
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

            var file = (event.dataTransfer || event.originalEvent.dataTransfer)
              .files[0];
            if (!file) return;

            processFile(file, scope, "dropzone", attributes);
          });
          element.bind("paste", function (event) {
            var items = (
              event.clipboardData || event.originalEvent.clipboardData
            ).items;
            var data;
            for (var i = 0; i < items.length; i++) {
              if (items[i].type == "text/plain") {
                data = items[i];
                break;
              }
            }
            if (!data) return;

            data.getAsString(function (text) {
              scope.$apply(function () {
                scope.dropzone = text;
              });
            });
          });
        },
      };
    },
  ]);
  // Application code
  angular
    .module("app")
    .config(function ($locationProvider) {
      $locationProvider
        .html5Mode({
          enabled: true,
          requireBase: false,
        })
        .hashPrefix("!");
    })
    .controller("ParseController", function ($scope, $location) {
      $scope.angular_loaded = true;

      $scope.setInitialScopeState = function () {
        $scope.profileName = (
          $location.search().profile ||
          localStorage.getItem("profileName") ||
          "default profile"
        ).toLowerCase();
        $scope.profiles =
          JSON.parse(localStorage.getItem("profiles")) || defaultProfiles;
        if (!$scope.profiles[$scope.profileName]) {
          $scope.profiles[$scope.profileName] = defaultProfile;
        }
        $scope.profile = $scope.profiles[$scope.profileName];
        $scope.ynab_cols = $scope.profile.columnFormat;
        $scope.data = {};
        $scope.ynab_map = $scope.profile.chosenColumns;
        $scope.inverted_outflow = false;
        $scope.inverted_amount = false;
        $scope.fix_dates = false;
        $scope.file = {
          encodings: encodings,
          delimiters: delimiters,
          chosenEncoding: $scope.profile.chosenEncoding || "UTF-8",
          chosenDelimiter: $scope.profile.chosenDelimiter || "auto",
          startAtRow: $scope.profile.startAtRow,
          extraRow: $scope.profile.extraRow || false,
          selectedWorksheet: 0, // Use index as source of truth
        };
        $scope.data_object = new DataObject();
        $scope.filename = null;

        // Auto-matching configuration state
        $scope.matchedConfig = null;
        $scope.autoApplied = false;
        $scope.savedConfigs = ConfigMatcher.getAllConfigurations();
      };

      $scope.setInitialScopeState();

      // Make FileUtils available in templates
      $scope.FileUtils = FileUtils;

      $scope.profileChosen = function (profileName) {
        $location.search("profile", profileName);
        $scope.profile = $scope.profiles[$scope.profileName];
        $scope.ynab_cols = $scope.profile.columnFormat;
        $scope.ynab_map = $scope.profile.chosenColumns;
        localStorage.setItem("profileName", profileName);
      };
      $scope.encodingChosen = function (encoding) {
        $scope.profile.chosenEncoding = encoding;
        localStorage.setItem("profiles", JSON.stringify($scope.profiles));
      };
      $scope.delimiterChosen = function (delimiter) {
        $scope.profile.chosenDelimiter = delimiter;
        localStorage.setItem("profiles", JSON.stringify($scope.profiles));
      };
      $scope.startRowSet = function (startAtRow) {
        $scope.profile.startAtRow = startAtRow;
        localStorage.setItem("profiles", JSON.stringify($scope.profiles));
      };
      $scope.extraRowSet = function (extraRow) {
        $scope.profile.extraRow = extraRow;
        localStorage.setItem("profiles", JSON.stringify($scope.profiles));
      };
      $scope.reparseFile = function () {
        // Only reparse if we have data loaded
        if ($scope.data.source && $scope.data.source.data) {
          try {
            if (
              FileUtils.isExcelFile($scope.currentFilename || $scope.filename)
            ) {
              // Re-parse Excel file with current settings
              $scope.data_object.parseExcel(
                $scope.data.source.data,
                $scope.currentFilename || $scope.filename,
                $scope.file.chosenEncoding,
                $scope.file.startAtRow,
                $scope.profile.extraRow,
                $scope.file.chosenDelimiter == "auto"
                  ? null
                  : $scope.file.chosenDelimiter,
                $scope.file.selectedWorksheet || 0,
              );
            } else {
              // Re-parse CSV file with current settings
              if ($scope.file.chosenDelimiter == "auto") {
                $scope.data_object.parseCsv(
                  $scope.data.source.data,
                  $scope.file.chosenEncoding,
                  $scope.file.startAtRow,
                  $scope.profile.extraRow,
                );
              } else {
                $scope.data_object.parseCsv(
                  $scope.data.source.data,
                  $scope.file.chosenEncoding,
                  $scope.file.startAtRow,
                  $scope.profile.extraRow,
                  $scope.file.chosenDelimiter,
                );
              }
            }

            // Update preview
            $scope.preview = $scope.data_object.converted_json(
              10,
              $scope.ynab_cols,
              $scope.ynab_map,
              $scope.inverted_outflow,
              $scope.inverted_amount,
              $scope.fix_dates,
            );

            // Save settings to profile
            $scope.encodingChosen($scope.file.chosenEncoding);
            $scope.delimiterChosen($scope.file.chosenDelimiter);
            $scope.startRowSet($scope.file.startAtRow);
            $scope.extraRowSet($scope.file.extraRow);
          } catch (error) {
            console.error("Error re-parsing file:", error);
            alert("Error re-parsing file: " + error.message);
          }
        }
      };
      $scope.nonDefaultProfilesExist = function () {
        return Object.keys($scope.profiles).length > 1;
      };
      $scope.toggleColumnFormat = function () {
        if ($scope.ynab_cols == new_ynab_cols) {
          $scope.ynab_cols = old_ynab_cols;
        } else {
          $scope.ynab_cols = new_ynab_cols;
        }
        $scope.profile.columnFormat = $scope.ynab_cols;
        localStorage.setItem("profiles", JSON.stringify($scope.profiles));
      };

      // ============================================
      // Auto-matching configuration methods
      // ============================================

      // Try to auto-apply a matching configuration
      $scope.tryAutoApplyConfig = function () {
        if (!$scope.data || !$scope.data.source || !$scope.data.source.data) {
          return;
        }

        // Use findMatchingConfigWithStartRow to try multiple header rows
        var match = ConfigMatcher.findMatchingConfigWithStartRow(
          $scope.data.source.data,
          $scope.filename,
          $scope.file.chosenDelimiter === "auto"
            ? null
            : $scope.file.chosenDelimiter,
        );

        if (match && match.confidence >= 60) {
          $scope.matchedConfig = match;

          // Auto-apply if confidence is high enough
          if (match.confidence >= 80) {
            // Re-parse if startAtRow differs from current setting
            var detectedRow =
              match.detectedStartAtRow || match.config.startAtRow;
            if (detectedRow && detectedRow !== $scope.file.startAtRow) {
              $scope.file.startAtRow = detectedRow;
              $scope.reparseFile();
            }
            $scope.applyConfig(match.config);
            $scope.autoApplied = true;
          }
        }
      };

      // Try to auto-apply config for Excel files using already-parsed headers
      // (Excel binary data can't be pre-parsed like CSV text)
      $scope.tryAutoApplyConfigForExcel = function () {
        if (!$scope.data_object || !$scope.data_object.fields) {
          return;
        }

        var headers = $scope.data_object.fields();
        if (!headers || headers.length === 0) {
          return;
        }

        // Try matching with current parsed headers
        var match = ConfigMatcher.findMatchingConfig(headers, $scope.filename);

        if (match && match.confidence >= 60) {
          $scope.matchedConfig = match;

          // Auto-apply if confidence is high enough
          if (match.confidence >= 80) {
            var configStartAtRow = match.config.startAtRow || 1;

            // If the matched config has a different startAtRow, we need to re-parse
            if (configStartAtRow !== $scope.file.startAtRow) {
              $scope.file.startAtRow = configStartAtRow;
              $scope.reparseFile();
            }

            $scope.applyConfig(match.config);
            $scope.autoApplied = true;
            return;
          }
        }

        // No high-confidence match with current startAtRow
        // Try other saved startAtRow values
        var allConfigs = ConfigMatcher.getAllConfigurations();
        var triedRows = new Set([$scope.file.startAtRow]);

        for (var configId in allConfigs) {
          var config = allConfigs[configId];
          var configRow = config.startAtRow || 1;

          if (triedRows.has(configRow)) {
            continue;
          }
          triedRows.add(configRow);

          // Re-parse with this startAtRow
          $scope.file.startAtRow = configRow;
          $scope.reparseFile();

          // Try matching again with new headers
          headers = $scope.data_object.fields();
          match = ConfigMatcher.findMatchingConfig(headers, $scope.filename);

          if (match && match.confidence >= 80) {
            $scope.matchedConfig = match;
            $scope.applyConfig(match.config);
            $scope.autoApplied = true;
            return;
          }
        }

        // No match found - reset to profile default if we changed it
        var profileStartAtRow = $scope.profile.startAtRow || 1;
        if ($scope.file.startAtRow !== profileStartAtRow) {
          $scope.file.startAtRow = profileStartAtRow;
          $scope.reparseFile();
        }
      };

      // Apply a configuration to current settings
      $scope.applyConfig = function (config) {
        if (!config) return;

        // Apply column format
        if (config.columnFormat) {
          $scope.ynab_cols = config.columnFormat;
        }

        // Apply column mappings
        if (config.chosenColumns) {
          $scope.ynab_map = angular.copy(config.chosenColumns);
        }

        // Apply file settings
        if (config.chosenEncoding) {
          $scope.file.chosenEncoding = config.chosenEncoding;
        }
        if (config.chosenDelimiter) {
          $scope.file.chosenDelimiter = config.chosenDelimiter;
        }
        if (config.startAtRow) {
          $scope.file.startAtRow = config.startAtRow;
        }
        if (typeof config.extraRow !== "undefined") {
          $scope.file.extraRow = config.extraRow;
        }
        if (typeof config.invertedOutflow !== "undefined") {
          $scope.inverted_outflow = config.invertedOutflow;
        }
        if (typeof config.invertedAmount !== "undefined") {
          $scope.inverted_amount = config.invertedAmount;
        }
        if (typeof config.fixDates !== "undefined") {
          $scope.fix_dates = config.fixDates;
        }

        // Update preview
        $scope.preview = $scope.data_object.converted_json(
          10,
          $scope.ynab_cols,
          $scope.ynab_map,
          $scope.inverted_outflow,
          $scope.inverted_amount,
          $scope.fix_dates,
        );

        // Increment usage count
        if ($scope.matchedConfig && $scope.matchedConfig.configId) {
          ConfigMatcher.incrementUsageCount($scope.matchedConfig.configId);
        }
      };

      // Save current settings as a configuration
      $scope.saveCurrentConfig = function (name) {
        if (!$scope.data_object || !$scope.data_object.base_json) {
          return null;
        }

        var headers = $scope.data_object.fields();
        var settings = {
          columnFormat: $scope.ynab_cols,
          chosenColumns: $scope.ynab_map,
          chosenEncoding: $scope.file.chosenEncoding,
          chosenDelimiter: $scope.file.chosenDelimiter,
          startAtRow: $scope.file.startAtRow,
          extraRow: $scope.file.extraRow,
          invertedOutflow: $scope.inverted_outflow,
          invertedAmount: $scope.inverted_amount,
          fixDates: $scope.fix_dates,
        };

        var configId = ConfigMatcher.saveConfiguration(
          headers,
          $scope.filename,
          settings,
          name,
        );

        if (configId) {
          $scope.matchedConfig = {
            configId: configId,
            matchType: "exact",
            confidence: 100,
            config: ConfigMatcher.getConfiguration(configId),
          };
          $scope.refreshSavedConfigs();
        }

        return configId;
      };

      // Update the currently matched configuration
      $scope.updateMatchedConfig = function () {
        if (!$scope.matchedConfig || !$scope.matchedConfig.configId) {
          return false;
        }

        var result = ConfigMatcher.updateConfiguration(
          $scope.matchedConfig.configId,
          {
            columnFormat: $scope.ynab_cols,
            chosenColumns: $scope.ynab_map,
            chosenEncoding: $scope.file.chosenEncoding,
            chosenDelimiter: $scope.file.chosenDelimiter,
            startAtRow: $scope.file.startAtRow,
            extraRow: $scope.file.extraRow,
            invertedOutflow: $scope.inverted_outflow,
            invertedAmount: $scope.inverted_amount,
            fixDates: $scope.fix_dates,
          },
        );

        if (result) {
          $scope.matchedConfig.config = ConfigMatcher.getConfiguration(
            $scope.matchedConfig.configId,
          );
          $scope.refreshSavedConfigs();
        }

        return result;
      };

      // Refresh the saved configurations list
      $scope.refreshSavedConfigs = function () {
        $scope.savedConfigs = ConfigMatcher.getAllConfigurations();
      };

      // Delete a saved configuration
      $scope.deleteConfig = function (configId) {
        if (ConfigMatcher.deleteConfiguration(configId)) {
          if (
            $scope.matchedConfig &&
            $scope.matchedConfig.configId === configId
          ) {
            $scope.matchedConfig = null;
            $scope.autoApplied = false;
          }
          $scope.refreshSavedConfigs();
        }
      };

      // Rename a saved configuration
      $scope.renameConfig = function (configId, newName) {
        if (ConfigMatcher.renameConfiguration(configId, newName)) {
          if (
            $scope.matchedConfig &&
            $scope.matchedConfig.configId === configId
          ) {
            $scope.matchedConfig.config.name = newName;
          }
          $scope.refreshSavedConfigs();
        }
      };

      // Save config with user-provided name (shows prompt)
      $scope.saveConfigWithName = function ($event) {
        if ($event) $event.preventDefault();

        var name = prompt(
          "Enter a name for this configuration:",
          $scope.matchedConfig
            ? $scope.matchedConfig.config.name
            : $scope.filename || "My Configuration",
        );

        if (name) {
          $scope.saveCurrentConfig(name);
        }
      };

      // Prompt to rename an existing configuration
      $scope.promptRenameConfig = function (configId) {
        var config = ConfigMatcher.getConfiguration(configId);
        if (!config) return;

        var newName = prompt("Enter a new name:", config.name);
        if (newName && newName !== config.name) {
          $scope.renameConfig(configId, newName);
        }
      };

      // Dismiss the auto-apply notification
      $scope.dismissAutoApply = function () {
        $scope.autoApplied = false;
      };

      // Check if any saved configs exist
      $scope.hasSavedConfigs = function () {
        return Object.keys($scope.savedConfigs).length > 0;
      };

      $scope.$watch("data.source", function (newValue, oldValue) {
        if (newValue && newValue.data && newValue.filename) {
          try {
            // Store filename for later use in worksheet switching
            $scope.currentFilename = newValue.filename;
            $scope.filename = newValue.filename;

            // Reset auto-match state first
            $scope.matchedConfig = null;
            $scope.autoApplied = false;

            // Use profile defaults as baseline for matching, but preserve current
            // file settings if no match is found
            var profileStartAtRow = $scope.profile.startAtRow || 1;
            var profileDelimiter = $scope.profile.chosenDelimiter || "auto";

            // Try to find matching config BEFORE parsing (handles different startAtRow)
            // Only for CSV files - Excel requires parsing first
            if (!$scope.data_object.isExcelFile(newValue.filename)) {
              var match = ConfigMatcher.findMatchingConfigWithStartRow(
                newValue.data,
                newValue.filename,
                profileDelimiter === "auto" ? null : profileDelimiter,
              );

              if (match && match.confidence >= 80) {
                $scope.matchedConfig = match;
                // Use detected settings from matching config
                $scope.file.startAtRow =
                  match.detectedStartAtRow ||
                  match.config.startAtRow ||
                  profileStartAtRow;
                $scope.file.chosenDelimiter =
                  match.config.chosenDelimiter || profileDelimiter;
                $scope.file.chosenEncoding =
                  match.config.chosenEncoding || $scope.file.chosenEncoding;
              } else {
                // No match found - reset to profile defaults for fresh file
                $scope.file.startAtRow = profileStartAtRow;
                // Keep current delimiter if explicitly set, otherwise use profile
                if (
                  $scope.file.chosenDelimiter === "auto" ||
                  !$scope.file.chosenDelimiter
                ) {
                  $scope.file.chosenDelimiter = profileDelimiter;
                }
              }
            }

            // Process file based on type
            if ($scope.data_object.isExcelFile(newValue.filename)) {
              // For Excel files, reset to profile defaults BEFORE parsing
              // (we can't pre-detect headers from binary Excel data)
              $scope.file.startAtRow = profileStartAtRow;
              $scope.file.chosenDelimiter = profileDelimiter;

              // Parse as Excel file with profile defaults
              $scope.data_object.parseExcel(
                newValue.data,
                newValue.filename,
                $scope.file.chosenEncoding,
                $scope.file.startAtRow,
                $scope.profile.extraRow,
                $scope.file.chosenDelimiter == "auto"
                  ? null
                  : $scope.file.chosenDelimiter,
                0, // default to first worksheet
              );

              // Initialize worksheet selection for multi-sheet Excel files
              if (
                $scope.data_object.worksheetNames &&
                $scope.data_object.worksheetNames.length > 0
              ) {
                $scope.file.selectedWorksheet = 0; // Default to first worksheet (index 0)
                $scope.$evalAsync();
              }

              // For Excel files, try auto-matching after parsing using parsed headers
              $scope.tryAutoApplyConfigForExcel();
            } else {
              // Parse as CSV file with detected settings
              if ($scope.file.chosenDelimiter == "auto") {
                $scope.data_object.parseCsv(
                  newValue.data,
                  $scope.file.chosenEncoding,
                  $scope.file.startAtRow,
                  $scope.profile.extraRow,
                );
              } else {
                $scope.data_object.parseCsv(
                  newValue.data,
                  $scope.file.chosenEncoding,
                  $scope.file.startAtRow,
                  $scope.profile.extraRow,
                  $scope.file.chosenDelimiter,
                );
              }

              // Apply matched config after parsing (for CSV)
              if (
                $scope.matchedConfig &&
                $scope.matchedConfig.confidence >= 80
              ) {
                $scope.applyConfig($scope.matchedConfig.config);
                $scope.autoApplied = true;
              }
            }

            // Auto-detect short year dates after file load
            if ($scope.ynab_map && $scope.ynab_map.Date) {
              if ($scope.data_object.hasShortYearDates($scope.ynab_map.Date)) {
                $scope.fix_dates = true;
              }
            }

            $scope.preview = $scope.data_object.converted_json(
              10,
              $scope.ynab_cols,
              $scope.ynab_map,
              $scope.inverted_outflow,
              $scope.inverted_amount,
              $scope.fix_dates,
            );
          } catch (error) {
            console.error("Error parsing file:", error);
            alert("Error parsing file: " + error.message);
          }
        }
      });
      $scope.$watch("inverted_outflow", function (newValue, oldValue) {
        if (newValue != oldValue) {
          $scope.preview = $scope.data_object.converted_json(
            10,
            $scope.ynab_cols,
            $scope.ynab_map,
            $scope.inverted_outflow,
            $scope.inverted_amount,
            $scope.fix_dates,
          );
        }
      });
      $scope.$watch("inverted_amount", function (newValue, oldValue) {
        if (newValue != oldValue) {
          $scope.preview = $scope.data_object.converted_json(
            10,
            $scope.ynab_cols,
            $scope.ynab_map,
            $scope.inverted_outflow,
            $scope.inverted_amount,
            $scope.fix_dates,
          );
        }
      });
      $scope.$watch("fix_dates", function (newValue, oldValue) {
        if (newValue != oldValue) {
          $scope.preview = $scope.data_object.converted_json(
            10,
            $scope.ynab_cols,
            $scope.ynab_map,
            $scope.inverted_outflow,
            $scope.inverted_amount,
            $scope.fix_dates,
          );
        }
      });
      $scope.$watch(
        "ynab_map",
        function (newValue, oldValue) {
          $scope.profile.chosenColumns = newValue;
          localStorage.setItem("profiles", JSON.stringify($scope.profiles));
          // Auto-detect short year dates when Date mapping changes
          if (
            newValue &&
            newValue.Date &&
            (!oldValue || newValue.Date !== oldValue.Date)
          ) {
            if (
              $scope.data_object.hasShortYearDates &&
              $scope.data_object.hasShortYearDates(newValue.Date)
            ) {
              $scope.fix_dates = true;
            }
          }
          $scope.preview = $scope.data_object.converted_json(
            10,
            $scope.ynab_cols,
            newValue,
            $scope.inverted_outflow,
            $scope.inverted_amount,
            $scope.fix_dates,
          );
        },
        true,
      );
      $scope.csvString = function () {
        return $scope.data_object.converted_csv(
          null,
          $scope.ynab_cols,
          $scope.ynab_map,
          $scope.inverted_outflow,
          $scope.inverted_amount,
          $scope.fix_dates,
        );
      };
      $scope.reloadApp = function () {
        $scope.setInitialScopeState();
      };
      $scope.invert_flows = function () {
        $scope.inverted_outflow = !$scope.inverted_outflow;
      };
      $scope.invert_amount = function () {
        $scope.inverted_amount = !$scope.inverted_amount;
      };
      $scope.toggle_fix_dates = function () {
        $scope.fix_dates = !$scope.fix_dates;
      };

      // Handle worksheet selection for Excel files
      $scope.worksheetChosen = function (worksheetIndex) {
        if (
          $scope.currentFilename &&
          $scope.data.source &&
          FileUtils.isExcelFile($scope.currentFilename)
        ) {
          try {
            // Convert to number if it's a string (from ng-value)
            var index =
              typeof worksheetIndex === "string"
                ? parseInt(worksheetIndex, 10)
                : worksheetIndex;

            // Re-parse the Excel file with the selected worksheet
            $scope.data_object.parseExcel(
              $scope.data.source.data,
              $scope.currentFilename,
              $scope.file.chosenEncoding,
              $scope.file.startAtRow,
              $scope.profile.extraRow,
              $scope.file.chosenDelimiter == "auto"
                ? null
                : $scope.file.chosenDelimiter,
              index,
            );

            $scope.preview = $scope.data_object.converted_json(
              10,
              $scope.ynab_cols,
              $scope.ynab_map,
              $scope.inverted_outflow,
              $scope.inverted_amount,
              $scope.fix_dates,
            );
            $scope.$evalAsync();
          } catch (error) {
            console.error("Error switching worksheet:", error);
            alert("Error switching worksheet: " + error.message);
          }
        }
      };
      $scope.downloadFile = function () {
        // Auto-save configuration on download
        if ($scope.data_object && $scope.data_object.base_json) {
          if ($scope.matchedConfig) {
            // Update existing configuration
            $scope.updateMatchedConfig();
          } else {
            // Save as new configuration
            $scope.saveCurrentConfig();
          }
        }

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
