// File processing utility functions
(function() {
  'use strict';

  // File extension constants
  var EXCEL_EXTENSIONS = ['xlsx', 'xls', 'xlsm', 'xlsb'];
  var BINARY_FORMAT_EXTENSIONS = ['xls', 'xlsb'];

  function getFileExtension(filename) {
    if (!filename) return '';
    return filename.toLowerCase().split('.').pop();
  }

  function isExcelFile(filename) {
    if (!filename) return false;
    var extension = getFileExtension(filename);
    return EXCEL_EXTENSIONS.includes(extension);
  }

  function getExcelReadingMethod(filename) {
    var extension = getFileExtension(filename);
    return BINARY_FORMAT_EXTENSIONS.includes(extension) ? 'arrayBuffer' : 'binaryString';
  }

  function getFileType(filename) {
    if (!filename) return '';
    var extension = getFileExtension(filename);
    if (EXCEL_EXTENSIONS.includes(extension)) {
      return extension.toUpperCase();
    }
    return 'CSV';
  }

  function getFileTypeConstants() {
    return {
      EXCEL_EXTENSIONS: EXCEL_EXTENSIONS,
      BINARY_FORMAT_EXTENSIONS: BINARY_FORMAT_EXTENSIONS
    };
  }

  // Public API
  var FileUtils = {
    getFileExtension: getFileExtension,
    isExcelFile: isExcelFile,
    getExcelReadingMethod: getExcelReadingMethod,
    getFileType: getFileType,
    constants: getFileTypeConstants
  };

  // Support both browser and Node.js environments
  if (typeof window !== 'undefined') {
    window.FileUtils = FileUtils;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileUtils;
  }
  if (typeof global !== 'undefined') {
    global.FileUtils = FileUtils;
  }
})();
