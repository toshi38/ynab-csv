// Mock PapaParse
global.Papa = {
  parse: jest.fn()
};

// Import DataObject after mocking Papa
require('../src/data_object.js');

describe('DataObject', () => {
  let dataObject;

  beforeEach(() => {
    dataObject = new window.DataObject();
    jest.clearAllMocks();
  });

  describe('CSV Parsing', () => {
    test('should parse CSV with default parameters', () => {
      const csvData = 'header1,header2\nvalue1,value2';
      const mockParsedData = {
        data: [{ header1: 'value1', header2: 'value2' }],
        meta: { fields: ['header1', 'header2'] }
      };
      
      global.Papa.parse.mockReturnValue(mockParsedData);
      
      const result = dataObject.parseCsv(csvData, 'UTF-8');
      
      expect(global.Papa.parse).toHaveBeenCalledWith(csvData, expect.objectContaining({
        header: true,
        skipEmptyLines: true
      }));
      expect(result).toEqual(mockParsedData);
      expect(dataObject.base_json).toEqual(mockParsedData);
    });

    test('should parse CSV starting at specific row', () => {
      const csvData = 'skip1\nskip2\nheader1,header2\nvalue1,value2';
      
      global.Papa.parse.mockImplementation((data, config) => {
        const transformed = config.beforeFirstChunk(data);
        expect(transformed).toBe('header1,header2\nvalue1,value2');
        return { data: [], meta: { fields: [] } };
      });
      
      dataObject.parseCsv(csvData, 'UTF-8', 3);
      
      expect(global.Papa.parse).toHaveBeenCalled();
    });

    test('should duplicate first data row when extraRow is true', () => {
      const csvData = 'header1,header2\nvalue1,value2\nvalue3,value4';
      
      global.Papa.parse.mockImplementation((data, config) => {
        const transformed = config.beforeFirstChunk(data);
        const lines = transformed.split('\n');
        expect(lines[0]).toBe('header1,header2');
        expect(lines[1]).toBe('header1,header2'); // Duplicated
        expect(lines[2]).toBe('value1,value2');
        return { data: [], meta: { fields: [] } };
      });
      
      dataObject.parseCsv(csvData, 'UTF-8', 1, true);
      
      expect(global.Papa.parse).toHaveBeenCalled();
    });

    test('should use custom delimiter when specified', () => {
      const csvData = 'header1;header2\nvalue1;value2';
      
      global.Papa.parse.mockReturnValue({ data: [], meta: { fields: [] } });
      
      dataObject.parseCsv(csvData, 'UTF-8', 1, false, ';');
      
      expect(global.Papa.parse).toHaveBeenCalledWith(csvData, expect.objectContaining({
        delimiter: ';'
      }));
    });

    test('should handle empty headers', () => {
      const csvData = ',header2\nvalue1,value2';
      
      global.Papa.parse.mockImplementation((data, config) => {
        const transformedHeader = config.transformHeader('  ');
        expect(transformedHeader).toBe('Unnamed column');
        return { data: [], meta: { fields: [] } };
      });
      
      dataObject.parseCsv(csvData, 'UTF-8');
      
      expect(global.Papa.parse).toHaveBeenCalled();
    });

    test('should handle duplicate headers', () => {
      const csvData = 'header1,header1,header1\nvalue1,value2,value3';
      
      global.Papa.parse.mockImplementation((data, config) => {
        // Simulate header transformation
        const headers = [];
        headers.push(config.transformHeader('header1')); // 'header1'
        headers.push(config.transformHeader('header1')); // 'header1 (1)'
        headers.push(config.transformHeader('header1')); // 'header1 (2)'
        
        expect(headers).toEqual(['header1', 'header1 (1)', 'header1 (2)']);
        return { data: [], meta: { fields: headers } };
      });
      
      dataObject.parseCsv(csvData, 'UTF-8');
      
      expect(global.Papa.parse).toHaveBeenCalled();
    });
  });

  describe('Data Access Methods', () => {
    test('fields() should return parsed fields', () => {
      const mockFields = ['field1', 'field2', 'field3'];
      dataObject.base_json = { meta: { fields: mockFields } };
      
      expect(dataObject.fields()).toEqual(mockFields);
    });

    test('rows() should return parsed data', () => {
      const mockRows = [
        { col1: 'val1', col2: 'val2' },
        { col1: 'val3', col2: 'val4' }
      ];
      dataObject.base_json = { data: mockRows };
      
      expect(dataObject.rows()).toEqual(mockRows);
    });
  });

  describe('Data Conversion - converted_json()', () => {
    beforeEach(() => {
      dataObject.base_json = {
        data: [
          { 'Date': '2024-01-01', 'Description': 'Purchase', 'Amount': '-50.00', 'Notes': 'Groceries' },
          { 'Date': '2024-01-02', 'Description': 'Salary', 'Amount': '1000.00', 'Notes': 'Monthly pay' },
          { 'Date': '2024-01-03', 'Description': 'Refund', 'Amount': '25.50', 'Notes': 'Return' }
        ],
        meta: { fields: ['Date', 'Description', 'Amount', 'Notes'] }
      };
    });

    test('should convert to old YNAB format with separate Inflow/Outflow', () => {
      const ynab_cols = ['Date', 'Payee', 'Memo', 'Outflow', 'Inflow'];
      const lookup = {
        'Date': 'Date',
        'Payee': 'Description',
        'Memo': 'Notes',
        'Outflow': 'Amount',
        'Inflow': 'Amount'
      };
      
      const result = dataObject.converted_json(null, ynab_cols, lookup);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        'Date': '2024-01-01',
        'Payee': 'Purchase',
        'Memo': 'Groceries',
        'Outflow': '50.00',
        'Inflow': ''
      });
      expect(result[1]).toEqual({
        'Date': '2024-01-02',
        'Payee': 'Salary',
        'Memo': 'Monthly pay',
        'Outflow': '',
        'Inflow': '1000.00'
      });
    });

    test('should convert to new YNAB format with combined Amount column', () => {
      const ynab_cols = ['Date', 'Payee', 'Memo', 'Amount'];
      const lookup = {
        'Date': 'Date',
        'Payee': 'Description',
        'Memo': 'Notes',
        'Amount': 'Amount'
      };
      
      const result = dataObject.converted_json(null, ynab_cols, lookup);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        'Date': '2024-01-01',
        'Payee': 'Purchase',
        'Memo': 'Groceries',
        'Amount': '-50.00'
      });
      expect(result[1]).toEqual({
        'Date': '2024-01-02',
        'Payee': 'Salary',
        'Memo': 'Monthly pay',
        'Amount': '1000.00'
      });
    });

    test('should handle inverted outflow logic', () => {
      const ynab_cols = ['Date', 'Payee', 'Memo', 'Outflow', 'Inflow'];
      const lookup = {
        'Date': 'Date',
        'Payee': 'Description',
        'Memo': 'Notes',
        'Outflow': 'Amount',
        'Inflow': 'Amount'
      };
      
      const result = dataObject.converted_json(null, ynab_cols, lookup, true);
      
      expect(result[0]).toEqual({
        'Date': '2024-01-01',
        'Payee': 'Purchase',
        'Memo': 'Groceries',
        'Outflow': '',
        'Inflow': '50.00'
      });
      expect(result[1]).toEqual({
        'Date': '2024-01-02',
        'Payee': 'Salary',
        'Memo': 'Monthly pay',
        'Outflow': '1000.00',
        'Inflow': ''
      });
    });

    test('should respect limit parameter for preview', () => {
      const ynab_cols = ['Date', 'Payee', 'Memo', 'Amount'];
      const lookup = {
        'Date': 'Date',
        'Payee': 'Description',
        'Memo': 'Notes',
        'Amount': 'Amount'
      };
      
      const result = dataObject.converted_json(2, ynab_cols, lookup);
      
      expect(result).toHaveLength(2);
      expect(result[0].Payee).toBe('Purchase');
      expect(result[1].Payee).toBe('Salary');
    });

    test('should handle missing fields gracefully', () => {
      const ynab_cols = ['Date', 'Payee', 'Memo', 'Category'];
      const lookup = {
        'Date': 'Date',
        'Payee': 'Description',
        'Memo': 'Notes',
        'Category': 'NonExistentField'
      };
      
      const result = dataObject.converted_json(1, ynab_cols, lookup);
      
      expect(result[0]).toEqual({
        'Date': '2024-01-01',
        'Payee': 'Purchase',
        'Memo': 'Groceries'
        // Category is undefined, so not included
      });
    });

    test('should handle separate Outflow/Inflow columns correctly', () => {
      dataObject.base_json = {
        data: [
          { 'Date': '2024-01-01', 'Payee': 'Store', 'Out': '50.00', 'In': '' },
          { 'Date': '2024-01-02', 'Payee': 'Work', 'Out': '', 'In': '1000.00' }
        ],
        meta: { fields: ['Date', 'Payee', 'Out', 'In'] }
      };
      
      const ynab_cols = ['Date', 'Payee', 'Outflow', 'Inflow'];
      const lookup = {
        'Date': 'Date',
        'Payee': 'Payee',
        'Outflow': 'Out',
        'Inflow': 'In'
      };
      
      const result = dataObject.converted_json(null, ynab_cols, lookup);
      
      expect(result[0]).toEqual({
        'Date': '2024-01-01',
        'Payee': 'Store',
        'Outflow': '50.00'
        // Inflow is empty string, so not included in result
      });
      expect(result[1]).toEqual({
        'Date': '2024-01-02',
        'Payee': 'Work',
        'Inflow': '1000.00'
        // Outflow is empty string, so not included in result
      });
    });

    test('should return null if base_json is null', () => {
      dataObject.base_json = null;
      
      const result = dataObject.converted_json(null, [], {});
      
      expect(result).toBeNull();
    });
  });

  describe('CSV Export - converted_csv()', () => {
    beforeEach(() => {
      dataObject.base_json = {
        data: [
          { 'Date': '2024-01-01', 'Description': 'Purchase', 'Amount': '-50.00', 'Notes': 'Groceries' },
          { 'Date': '2024-01-02', 'Description': 'Salary', 'Amount': '1000.00', 'Notes': 'Monthly pay' }
        ],
        meta: { fields: ['Date', 'Description', 'Amount', 'Notes'] }
      };
    });

    test('should export to CSV format with old YNAB columns', () => {
      const ynab_cols = ['Date', 'Payee', 'Memo', 'Outflow', 'Inflow'];
      const lookup = {
        'Date': 'Date',
        'Payee': 'Description',
        'Memo': 'Notes',
        'Outflow': 'Amount',
        'Inflow': 'Amount'
      };
      
      const result = dataObject.converted_csv(null, ynab_cols, lookup);
      
      const lines = result.trim().split('\n');
      expect(lines).toHaveLength(3); // header + 2 data rows
      expect(lines[0]).toBe('"Date","Payee","Memo","Outflow","Inflow"');
      expect(lines[1]).toBe('"2024-01-01","Purchase","Groceries","50.00",""');
      expect(lines[2]).toBe('"2024-01-02","Salary","Monthly pay","","1000.00"');
    });

    test('should export to CSV format with new YNAB columns', () => {
      const ynab_cols = ['Date', 'Payee', 'Memo', 'Amount'];
      const lookup = {
        'Date': 'Date',
        'Payee': 'Description',
        'Memo': 'Notes',
        'Amount': 'Amount'
      };
      
      const result = dataObject.converted_csv(null, ynab_cols, lookup);
      
      const lines = result.trim().split('\n');
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('"Date","Payee","Memo","Amount"');
      expect(lines[1]).toBe('"2024-01-01","Purchase","Groceries","-50.00"');
      expect(lines[2]).toBe('"2024-01-02","Salary","Monthly pay","1000.00"');
    });

    test('should properly escape quotes in values', () => {
      dataObject.base_json = {
        data: [
          { 'Date': '2024-01-01', 'Description': 'Store "ABC"', 'Amount': '-50.00', 'Notes': 'Bought "stuff"' }
        ],
        meta: { fields: ['Date', 'Description', 'Amount', 'Notes'] }
      };
      
      const ynab_cols = ['Date', 'Payee', 'Memo', 'Amount'];
      const lookup = {
        'Date': 'Date',
        'Payee': 'Description',
        'Memo': 'Notes',
        'Amount': 'Amount'
      };
      
      const result = dataObject.converted_csv(null, ynab_cols, lookup);
      
      const lines = result.trim().split('\n');
      expect(lines[1]).toBe('"2024-01-01","Store ""ABC""","Bought ""stuff""","-50.00"');
    });

    test('should trim values', () => {
      dataObject.base_json = {
        data: [
          { 'Date': '  2024-01-01  ', 'Description': '  Purchase  ', 'Amount': '  -50.00  ', 'Notes': '  Groceries  ' }
        ],
        meta: { fields: ['Date', 'Description', 'Amount', 'Notes'] }
      };
      
      const ynab_cols = ['Date', 'Payee', 'Memo', 'Amount'];
      const lookup = {
        'Date': 'Date',
        'Payee': 'Description',
        'Memo': 'Notes',
        'Amount': 'Amount'
      };
      
      const result = dataObject.converted_csv(null, ynab_cols, lookup);
      
      const lines = result.trim().split('\n');
      expect(lines[1]).toBe('"2024-01-01","Purchase","Groceries","-50.00"');
    });

    test('should handle empty values', () => {
      dataObject.base_json = {
        data: [
          { 'Date': '2024-01-01', 'Description': '', 'Amount': '-50.00', 'Notes': null }
        ],
        meta: { fields: ['Date', 'Description', 'Amount', 'Notes'] }
      };
      
      const ynab_cols = ['Date', 'Payee', 'Memo', 'Amount'];
      const lookup = {
        'Date': 'Date',
        'Payee': 'Description',
        'Memo': 'Notes',
        'Amount': 'Amount'
      };
      
      const result = dataObject.converted_csv(null, ynab_cols, lookup);
      
      const lines = result.trim().split('\n');
      expect(lines[1]).toBe('"2024-01-01","","","-50.00"');
    });

    test('should respect limit parameter', () => {
      dataObject.base_json = {
        data: [
          { 'Date': '2024-01-01', 'Description': 'Purchase 1', 'Amount': '-50.00', 'Notes': 'Note 1' },
          { 'Date': '2024-01-02', 'Description': 'Purchase 2', 'Amount': '-60.00', 'Notes': 'Note 2' },
          { 'Date': '2024-01-03', 'Description': 'Purchase 3', 'Amount': '-70.00', 'Notes': 'Note 3' }
        ],
        meta: { fields: ['Date', 'Description', 'Amount', 'Notes'] }
      };
      
      const ynab_cols = ['Date', 'Payee', 'Memo', 'Amount'];
      const lookup = {
        'Date': 'Date',
        'Payee': 'Description',
        'Memo': 'Notes',
        'Amount': 'Amount'
      };
      
      const result = dataObject.converted_csv(2, ynab_cols, lookup);
      
      const lines = result.trim().split('\n');
      expect(lines).toHaveLength(3); // header + 2 rows (limited)
      expect(lines[1]).toContain('Purchase 1');
      expect(lines[2]).toContain('Purchase 2');
    });
  });

  describe('Excel File Support', () => {
    beforeEach(() => {
      // Mock XLSX for Excel tests
      global.XLSX = {
        read: jest.fn(),
        utils: {
          sheet_to_csv: jest.fn()
        }
      };
    });

    afterEach(() => {
      delete global.XLSX;
    });

    describe('isExcelFile()', () => {
      test('should detect Excel files by extension', () => {
        expect(dataObject.isExcelFile('test.xlsx')).toBe(true);
        expect(dataObject.isExcelFile('test.xls')).toBe(true);
        expect(dataObject.isExcelFile('test.xlsm')).toBe(true);
        expect(dataObject.isExcelFile('test.xlsb')).toBe(true);
        expect(dataObject.isExcelFile('TEST.XLSX')).toBe(true); // case insensitive
      });

      test('should not detect non-Excel files', () => {
        expect(dataObject.isExcelFile('test.csv')).toBe(false);
        expect(dataObject.isExcelFile('test.txt')).toBe(false);
        expect(dataObject.isExcelFile('test.pdf')).toBe(false);
        expect(dataObject.isExcelFile('')).toBe(false);
        expect(dataObject.isExcelFile(null)).toBe(false);
        expect(dataObject.isExcelFile(undefined)).toBe(false);
      });
    });

    describe('parseExcel()', () => {
      test('should parse Excel file with single worksheet', () => {
        const mockWorkbook = {
          SheetNames: ['Sheet1'],
          Sheets: {
            'Sheet1': { /* worksheet data */ }
          }
        };
        const mockCsvContent = 'Date,Description,Amount\n2024-01-01,Purchase,-50.00';
        
        global.XLSX.read.mockReturnValue(mockWorkbook);
        global.XLSX.utils.sheet_to_csv.mockReturnValue(mockCsvContent);
        
        // Mock parseCsv to return expected data
        const mockParsedData = {
          data: [{ Date: '2024-01-01', Description: 'Purchase', Amount: '-50.00' }],
          meta: { fields: ['Date', 'Description', 'Amount'] }
        };
        dataObject.parseCsv = jest.fn().mockReturnValue(mockParsedData);
        
        const result = dataObject.parseExcel('binary_data', 'test.xlsx', 'UTF-8');
        
        expect(global.XLSX.read).toHaveBeenCalledWith('binary_data', { type: 'binary' });
        expect(global.XLSX.utils.sheet_to_csv).toHaveBeenCalledWith(mockWorkbook.Sheets['Sheet1']);
        expect(dataObject.parseCsv).toHaveBeenCalledWith(mockCsvContent, 'UTF-8', 1, false, null);
        expect(result).toEqual(mockParsedData);
        expect(dataObject.worksheetNames).toEqual(['Sheet1']);
        expect(dataObject.currentWorksheet).toBe('Sheet1');
      });

      test('should parse Excel file with multiple worksheets', () => {
        const mockWorkbook = {
          SheetNames: ['Sheet1', 'Sheet2', 'Data'],
          Sheets: {
            'Sheet1': { /* worksheet 1 data */ },
            'Sheet2': { /* worksheet 2 data */ },
            'Data': { /* data worksheet */ }
          }
        };
        const mockCsvContent = 'Name,Value\nTest,123';
        
        global.XLSX.read.mockReturnValue(mockWorkbook);
        global.XLSX.utils.sheet_to_csv.mockReturnValue(mockCsvContent);
        dataObject.parseCsv = jest.fn().mockReturnValue({ data: [], meta: { fields: [] } });
        
        // Test selecting a specific worksheet (index 2 = 'Data')
        dataObject.parseExcel('binary_data', 'test.xlsx', 'UTF-8', 1, false, null, 2);
        
        expect(global.XLSX.utils.sheet_to_csv).toHaveBeenCalledWith(mockWorkbook.Sheets['Data']);
        expect(dataObject.worksheetNames).toEqual(['Sheet1', 'Sheet2', 'Data']);
        expect(dataObject.currentWorksheet).toBe('Data');
      });

      test('should handle Excel parsing errors', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        global.XLSX.read.mockImplementation(() => {
          throw new Error('Invalid Excel file');
        });
        
        expect(() => {
          dataObject.parseExcel('invalid_data', 'test.xlsx', 'UTF-8');
        }).toThrow('Failed to parse Excel file: Invalid Excel file');
        
        expect(consoleSpy).toHaveBeenCalledWith('Error parsing Excel file:', expect.any(Error));
        consoleSpy.mockRestore();
      });

      test('should handle empty workbook', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        const mockWorkbook = {
          SheetNames: [],
          Sheets: {}
        };
        
        global.XLSX.read.mockReturnValue(mockWorkbook);
        
        expect(() => {
          dataObject.parseExcel('binary_data', 'test.xlsx', 'UTF-8');
        }).toThrow('Failed to parse Excel file: No worksheets found in Excel file');
        
        expect(consoleSpy).toHaveBeenCalledWith('Error parsing Excel file:', expect.any(Error));
        consoleSpy.mockRestore();
      });

      test('should handle missing worksheet', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        const mockWorkbook = {
          SheetNames: ['Sheet1'],
          Sheets: {
            'Sheet1': { /* worksheet data */ }
          }
        };
        
        global.XLSX.read.mockReturnValue(mockWorkbook);
        
        expect(() => {
          dataObject.parseExcel('binary_data', 'test.xlsx', 'UTF-8', 1, false, null, 5); // invalid index
        }).toThrow('Failed to parse Excel file: Worksheet index 5 is out of range. Available sheets: 1');
        
        expect(consoleSpy).toHaveBeenCalledWith('Error parsing Excel file:', expect.any(Error));
        consoleSpy.mockRestore();
      });

      test('should pass through all parseCsv parameters', () => {
        const mockWorkbook = {
          SheetNames: ['Sheet1'],
          Sheets: {
            'Sheet1': { /* worksheet data */ }
          }
        };
        const mockCsvContent = 'Date,Amount\n2024-01-01,-50.00';
        
        global.XLSX.read.mockReturnValue(mockWorkbook);
        global.XLSX.utils.sheet_to_csv.mockReturnValue(mockCsvContent);
        dataObject.parseCsv = jest.fn().mockReturnValue({ data: [], meta: { fields: [] } });
        
        dataObject.parseExcel('binary_data', 'test.xlsx', 'ISO-8859-1', 3, true, ',', 0);
        
        expect(dataObject.parseCsv).toHaveBeenCalledWith(mockCsvContent, 'ISO-8859-1', 3, true, ',');
      });
    });
  });
});