describe('FileUtils', () => {
  let FileUtils;

  beforeEach(() => {
    // Clear any cached modules to ensure clean state
    delete require.cache[require.resolve('../src/file_utils.js')];
    // Re-require the module
    FileUtils = require('../src/file_utils.js');
  });

  describe('getFileExtension', () => {
    test('should extract file extension correctly', () => {
      expect(FileUtils.getFileExtension('test.xlsx')).toBe('xlsx');
      expect(FileUtils.getFileExtension('data.csv')).toBe('csv');
      expect(FileUtils.getFileExtension('file.XLS')).toBe('xls');
      expect(FileUtils.getFileExtension('document.XLSM')).toBe('xlsm');
    });

    test('should handle edge cases', () => {
      expect(FileUtils.getFileExtension('')).toBe('');
      expect(FileUtils.getFileExtension(null)).toBe('');
      expect(FileUtils.getFileExtension(undefined)).toBe('');
      expect(FileUtils.getFileExtension('noextension')).toBe('noextension');
      expect(FileUtils.getFileExtension('file.')).toBe('');
      expect(FileUtils.getFileExtension('.hidden')).toBe('hidden');
    });

    test('should handle multiple dots', () => {
      expect(FileUtils.getFileExtension('my.file.name.xlsx')).toBe('xlsx');
      expect(FileUtils.getFileExtension('archive.tar.gz')).toBe('gz');
    });
  });

  describe('isExcelFile', () => {
    test('should identify Excel files correctly', () => {
      expect(FileUtils.isExcelFile('test.xlsx')).toBe(true);
      expect(FileUtils.isExcelFile('data.xls')).toBe(true);
      expect(FileUtils.isExcelFile('file.xlsm')).toBe(true);
      expect(FileUtils.isExcelFile('workbook.xlsb')).toBe(true);
    });

    test('should handle case insensitivity', () => {
      expect(FileUtils.isExcelFile('TEST.XLSX')).toBe(true);
      expect(FileUtils.isExcelFile('Data.XLS')).toBe(true);
      expect(FileUtils.isExcelFile('FILE.Xlsm')).toBe(true);
      expect(FileUtils.isExcelFile('WORKBOOK.xlsB')).toBe(true);
    });

    test('should reject non-Excel files', () => {
      expect(FileUtils.isExcelFile('data.csv')).toBe(false);
      expect(FileUtils.isExcelFile('document.txt')).toBe(false);
      expect(FileUtils.isExcelFile('image.png')).toBe(false);
      expect(FileUtils.isExcelFile('data.json')).toBe(false);
    });

    test('should handle edge cases', () => {
      expect(FileUtils.isExcelFile('')).toBe(false);
      expect(FileUtils.isExcelFile(null)).toBe(false);
      expect(FileUtils.isExcelFile(undefined)).toBe(false);
      expect(FileUtils.isExcelFile('noextension')).toBe(false);
      expect(FileUtils.isExcelFile('file.')).toBe(false);
    });
  });

  describe('getExcelReadingMethod', () => {
    test('should return arrayBuffer for binary formats', () => {
      expect(FileUtils.getExcelReadingMethod('data.xls')).toBe('arrayBuffer');
      expect(FileUtils.getExcelReadingMethod('workbook.xlsb')).toBe('arrayBuffer');
      expect(FileUtils.getExcelReadingMethod('FILE.XLS')).toBe('arrayBuffer');
      expect(FileUtils.getExcelReadingMethod('WORKBOOK.XLSB')).toBe('arrayBuffer');
    });

    test('should return binaryString for ZIP-based formats', () => {
      expect(FileUtils.getExcelReadingMethod('data.xlsx')).toBe('binaryString');
      expect(FileUtils.getExcelReadingMethod('workbook.xlsm')).toBe('binaryString');
      expect(FileUtils.getExcelReadingMethod('FILE.XLSX')).toBe('binaryString');
      expect(FileUtils.getExcelReadingMethod('WORKBOOK.XLSM')).toBe('binaryString');
    });

    test('should handle non-Excel files', () => {
      // Non-Excel files should default to binaryString
      expect(FileUtils.getExcelReadingMethod('data.csv')).toBe('binaryString');
      expect(FileUtils.getExcelReadingMethod('document.txt')).toBe('binaryString');
      expect(FileUtils.getExcelReadingMethod('')).toBe('binaryString');
    });
  });

  describe('getFileType', () => {
    test('should return uppercase extension for Excel files', () => {
      expect(FileUtils.getFileType('test.xlsx')).toBe('XLSX');
      expect(FileUtils.getFileType('data.xls')).toBe('XLS');
      expect(FileUtils.getFileType('file.xlsm')).toBe('XLSM');
      expect(FileUtils.getFileType('workbook.xlsb')).toBe('XLSB');
    });

    test('should handle case insensitivity for Excel files', () => {
      expect(FileUtils.getFileType('TEST.xlsx')).toBe('XLSX');
      expect(FileUtils.getFileType('Data.XLS')).toBe('XLS');
      expect(FileUtils.getFileType('FILE.Xlsm')).toBe('XLSM');
      expect(FileUtils.getFileType('WORKBOOK.xlsB')).toBe('XLSB');
    });

    test('should return CSV for non-Excel files', () => {
      expect(FileUtils.getFileType('data.csv')).toBe('CSV');
      expect(FileUtils.getFileType('document.txt')).toBe('CSV');
      expect(FileUtils.getFileType('image.png')).toBe('CSV');
      expect(FileUtils.getFileType('noextension')).toBe('CSV');
    });

    test('should handle edge cases', () => {
      expect(FileUtils.getFileType('')).toBe('');
      expect(FileUtils.getFileType(null)).toBe('');
      expect(FileUtils.getFileType(undefined)).toBe('');
    });
  });

  describe('createDataWrapper', () => {
    test('should create data wrapper with content and filename', () => {
      const content = 'test data content';
      const filename = 'test.csv';

      const wrapper = FileUtils.createDataWrapper(content, filename);

      expect(wrapper).toEqual({
        data: 'test data content',
        filename: 'test.csv'
      });
    });

    test('should handle different content types', () => {
      // Test with different data types
      const binaryData = new ArrayBuffer(8);
      const wrapper1 = FileUtils.createDataWrapper(binaryData, 'test.xlsx');
      expect(wrapper1.data).toBe(binaryData);
      expect(wrapper1.filename).toBe('test.xlsx');

      const textData = 'csv,data,here';
      const wrapper2 = FileUtils.createDataWrapper(textData, 'data.csv');
      expect(wrapper2.data).toBe(textData);
      expect(wrapper2.filename).toBe('data.csv');
    });

    test('should handle empty or null values', () => {
      const wrapper1 = FileUtils.createDataWrapper('', '');
      expect(wrapper1.data).toBe('');
      expect(wrapper1.filename).toBe('');

      const wrapper2 = FileUtils.createDataWrapper(null, null);
      expect(wrapper2.data).toBe(null);
      expect(wrapper2.filename).toBe(null);
    });
  });

  describe('constants', () => {
    test('should provide file extension constants', () => {
      const constants = FileUtils.constants();

      expect(constants.EXCEL_EXTENSIONS).toEqual(['xlsx', 'xls', 'xlsm', 'xlsb']);
      expect(constants.BINARY_FORMAT_EXTENSIONS).toEqual(['xls', 'xlsb']);
    });

    test('should return immutable constants', () => {
      const constants1 = FileUtils.constants();
      const constants2 = FileUtils.constants();

      // Should return the same arrays each time
      expect(constants1.EXCEL_EXTENSIONS).toEqual(constants2.EXCEL_EXTENSIONS);
      expect(constants1.BINARY_FORMAT_EXTENSIONS).toEqual(constants2.BINARY_FORMAT_EXTENSIONS);
    });
  });

  describe('integration tests', () => {
    test('should work together consistently', () => {
      const testFiles = [
        { name: 'data.xlsx', isExcel: true, method: 'binaryString', type: 'XLSX' },
        { name: 'workbook.xls', isExcel: true, method: 'arrayBuffer', type: 'XLS' },
        { name: 'file.xlsm', isExcel: true, method: 'binaryString', type: 'XLSM' },
        { name: 'doc.xlsb', isExcel: true, method: 'arrayBuffer', type: 'XLSB' },
        { name: 'data.csv', isExcel: false, method: 'binaryString', type: 'CSV' },
        { name: 'text.txt', isExcel: false, method: 'binaryString', type: 'CSV' }
      ];

      testFiles.forEach(testFile => {
        expect(FileUtils.isExcelFile(testFile.name)).toBe(testFile.isExcel);
        expect(FileUtils.getExcelReadingMethod(testFile.name)).toBe(testFile.method);
        expect(FileUtils.getFileType(testFile.name)).toBe(testFile.type);
      });
    });
  });
});

