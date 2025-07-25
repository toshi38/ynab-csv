// This class does all the heavy lifting.
// It takes the and can format it into csv
window.DataObject = class DataObject {
  constructor() {
    this.base_json = null;
  }

  // Detect if the file content is Excel format based on file extension or content
  isExcelFile(filename) {
    if (!filename) return false;
    const extension = filename.toLowerCase().split('.').pop();
    return ['xlsx', 'xls', 'xlsm', 'xlsb'].includes(extension);
  }

  // Parse Excel file and convert to CSV format that existing parseCsv can handle
  parseExcel(fileContent, filename, encoding, startAtRow=1, extraRow=false, delimiter=null, worksheetIndex=0) {
    try {
      // Read the Excel file using SheetJS
      const workbook = XLSX.read(fileContent, { type: 'binary' });
      
      // Get worksheet names for potential multi-sheet support
      const worksheetNames = workbook.SheetNames;
      
      if (worksheetNames.length === 0) {
        throw new Error('No worksheets found in Excel file');
      }
      
      // Use specified worksheet index or default to first sheet
      let worksheetName;
      if (worksheetIndex >= 0 && worksheetIndex < worksheetNames.length) {
        worksheetName = worksheetNames[worksheetIndex];
      } else if (worksheetIndex === 0 || worksheetIndex === undefined) {
        worksheetName = worksheetNames[0];
      } else {
        throw new Error(`Worksheet index ${worksheetIndex} is out of range. Available sheets: ${worksheetNames.length}`);
      }
      
      const worksheet = workbook.Sheets[worksheetName];
      
      if (!worksheet) {
        throw new Error(`Worksheet not found: ${worksheetName}`);
      }
      
      // Convert worksheet to CSV format
      const csvContent = XLSX.utils.sheet_to_csv(worksheet);
      
      // Store worksheet info for potential UI use
      this.worksheetNames = worksheetNames;
      this.currentWorksheet = worksheetName;
      
      // Now parse the CSV content using existing parseCsv method
      return this.parseCsv(csvContent, encoding, startAtRow, extraRow, delimiter);
      
    } catch (error) {
      console.error('Error parsing Excel file:', error);
      throw new Error(`Failed to parse Excel file: ${error.message}`);
    }
  }

  // Parse base csv file as JSON. This will be easier to work with.
  // It uses http://papaparse.com/ for handling parsing
  parseCsv(csv, encoding, startAtRow=1, extraRow=false, delimiter=null) {
    let existingHeaders = [];
    let config = {
      header: true,
      skipEmptyLines: true,
      beforeFirstChunk: function(chunk) {
        var rows = chunk.split("\n");
        var startIndex = startAtRow - 1;
        rows = rows.slice(startIndex);

        if (extraRow) {
        // If first row duplication is turned on, we add the first row to the top of the set again.
          rows.unshift(rows[0]);
        }

        return rows.join("\n");
      },
      transformHeader: function(header) {
        if (header.trim().length == 0) {
          header = "Unnamed column";
        }
        if (existingHeaders.indexOf(header) != -1) {
          let new_header = header;
          let counter = 0;
          while(existingHeaders.indexOf(new_header) != -1){
            counter++;
            new_header = header + " (" + counter + ")";
          }
          header = new_header;
        }
        existingHeaders.push(header);
        return header;
      }
    }
    if (delimiter !== null) {
      config.delimiter = delimiter
    }

    var result = Papa.parse(csv, config);

    return (this.base_json = result);
  }

  fields() {
    return this.base_json.meta.fields;
  }

  rows() {
    return this.base_json.data;
  }

  // This method converts base_json into a json file with YNAB specific fields based on
  //   which fields you choose in the dropdowns in the browser.

  // --- parameters ----
  // limit: expects an integer and limits how many rows get parsed (specifically for preview)
  //     pass in false or null to do all.
  // lookup: hash definition of YNAB column names to selected base column names. Lets us
  //     convert the uploaded CSV file into the columns that YNAB expects.
  // inverted_outflow: if true, positive values represent outflow while negative values represent inflow
  converted_json(limit, ynab_cols, lookup, inverted_outflow = false) {
    var value;
    if (this.base_json === null) {
      return null;
    }
    value = [];
    // TODO: You might want to check for errors. Papaparse has an errors field.
    if (this.base_json.data) {
      this.base_json.data.forEach(function (row, index) {
        var tmp_row;
        if (!limit || index < limit) {
          tmp_row = {};
          ynab_cols.forEach(function (col) {
            var cell;
            cell = row[lookup[col]];
            // Some YNAB columns need special formatting,
            //   the rest are just returned as they are.
            if (cell) {
              switch (col) {
                case "Outflow":

                  if (lookup['Outflow'] == lookup['Inflow']) {
                    if (!inverted_outflow) {
                      tmp_row[col] = cell.startsWith('-') ? cell.slice(1) : "";
                    } else {
                      tmp_row[col] = cell.startsWith('-') ? "" : cell;
                    }
                  } else {
                    tmp_row[col] = cell.startsWith('-') ? cell.slice(1) : cell;
                  }
                  break;
                case "Inflow":
                  if (lookup['Outflow'] == lookup['Inflow']) {
                    if (!inverted_outflow) {
                      tmp_row[col] = cell.startsWith('-') ? "" : cell;
                    } else {
                      tmp_row[col] = cell.startsWith('-') ? cell.slice(1) : "";
                    }
                  } else {
                    tmp_row[col] = cell.startsWith('-') ? cell.slice(1) : cell;
                  }
                  break;
                default:
                  tmp_row[col] = cell;
              }
            }
          });
          value.push(tmp_row);
        }
      });
    }
    return value;
  }

  converted_csv(limit, ynab_cols, lookup, inverted_outflow) {
    var string;
    if (this.base_json === null) {
      return nil;
    }
    // Papa.unparse string
    string = '"' + ynab_cols.join('","') + '"\n';
    this.converted_json(limit, ynab_cols, lookup, inverted_outflow).forEach(function (row) {
      var row_values;
      row_values = [];
      ynab_cols.forEach(function (col) {
        var row_value;
        row_value = row[col] || "";
        // escape text which might already have a quote in it
        row_value = row_value.replace(/"/g, '""').trim();
        return row_values.push(row_value);
      });
      return (string += '"' + row_values.join('","') + '"\n');
    });
    return string;
  }
};