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
});