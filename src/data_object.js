// This class does all the heavy lifting.
// It takes the and can format it into csv
window.DataObject = class DataObject {
  constructor() {
    this.base_json = null;
  }

  // Detect if the file content is Excel format based on file extension or content
  isExcelFile(filename) {
    return FileUtils.isExcelFile(filename);
  }

  // Parse Excel file and convert to CSV format that existing parseCsv can handle
  parseExcel(
    fileContent,
    filename,
    encoding,
    startAtRow = 1,
    extraRow = false,
    delimiter = null,
    worksheetIndex = 0,
  ) {
    try {
      // Determine the appropriate data type for SheetJS based on file format
      let dataType = "binary";

      if (FileUtils.getExcelReadingMethod(filename) === "arrayBuffer") {
        // XLS and XLSB files use OLE2 format and should be read as array buffer
        dataType = "array";
        // Convert ArrayBuffer to Uint8Array if needed
        if (fileContent instanceof ArrayBuffer) {
          fileContent = new Uint8Array(fileContent);
        }
      } else {
        // XLSX and XLSM files are ZIP-based and can be read as binary string
        dataType = "binary";
      }

      // Read the Excel file using SheetJS with appropriate data type
      const workbook = XLSX.read(fileContent, { type: dataType });

      // Validate that we have a proper workbook
      if (!workbook || typeof workbook !== "object") {
        throw new Error(
          "Invalid Excel file: Unable to parse workbook structure",
        );
      }

      // Get worksheet names for potential multi-sheet support
      const worksheetNames = workbook.SheetNames;

      if (!worksheetNames || worksheetNames.length === 0) {
        throw new Error("No worksheets found in Excel file");
      }

      // Use specified worksheet index or default to first sheet
      let worksheetName;
      if (worksheetIndex >= 0 && worksheetIndex < worksheetNames.length) {
        worksheetName = worksheetNames[worksheetIndex];
      } else if (worksheetIndex === 0 || worksheetIndex === undefined) {
        worksheetName = worksheetNames[0];
      } else {
        throw new Error(
          `Worksheet index ${worksheetIndex} is out of range. Available sheets: ${worksheetNames.length}`,
        );
      }

      const worksheet = workbook.Sheets[worksheetName];

      if (!worksheet) {
        throw new Error(`Worksheet not found: ${worksheetName}`);
      }

      // Convert worksheet to CSV format
      const csvContent = XLSX.utils.sheet_to_csv(worksheet);

      // Validate that we got meaningful CSV content
      if (!csvContent || csvContent.trim().length === 0) {
        throw new Error("No data found in selected worksheet");
      }

      // Additional validation: check if content looks like binary garbage
      if (this._containsBinaryGarbage(csvContent)) {
        throw new Error(
          "Excel file appears to be corrupted or in an unsupported format",
        );
      }

      // Store worksheet info for potential UI use
      this.worksheetNames = worksheetNames;
      this.currentWorksheet = worksheetName;

      // Now parse the CSV content using existing parseCsv method
      return this.parseCsv(
        csvContent,
        encoding,
        startAtRow,
        extraRow,
        delimiter,
      );
    } catch (error) {
      console.error("Error parsing Excel file:", error);
      throw new Error(`Failed to parse Excel file: ${error.message}`);
    }
  }

  // Helper method to detect if CSV content contains binary garbage
  _containsBinaryGarbage(csvContent) {
    // Check for excessive non-printable characters
    const nonPrintableCount = (
      csvContent.match(/[\x00-\x08\x0E-\x1F\x7F-\xFF]/g) || []
    ).length;
    const totalLength = csvContent.length;

    // If more than 30% of content is non-printable, it's likely binary garbage
    return totalLength > 0 && nonPrintableCount / totalLength > 0.3;
  }

  // Parse base csv file as JSON. This will be easier to work with.
  // It uses http://papaparse.com/ for handling parsing
  parseCsv(csv, encoding, startAtRow = 1, extraRow = false, delimiter = null) {
    let existingHeaders = [];
    let config = {
      header: true,
      skipEmptyLines: true,
      beforeFirstChunk: function (chunk) {
        var rows = chunk.split("\n");
        var startIndex = startAtRow - 1;
        rows = rows.slice(startIndex);

        if (extraRow) {
          // If first row duplication is turned on, we add the first row to the top of the set again.
          rows.unshift(rows[0]);
        }

        return rows.join("\n");
      },
      transformHeader: function (header) {
        if (header.trim().length == 0) {
          header = "Unnamed column";
        }
        if (existingHeaders.indexOf(header) != -1) {
          let new_header = header;
          let counter = 0;
          while (existingHeaders.indexOf(new_header) != -1) {
            counter++;
            new_header = header + " (" + counter + ")";
          }
          header = new_header;
        }
        existingHeaders.push(header);
        return header;
      },
    };
    if (delimiter !== null) {
      config.delimiter = delimiter;
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

  static fixTwoDigitYear(dateStr) {
    if (!dateStr) return dateStr;
    if (/\d{4}/.test(dateStr)) return dateStr;
    // Year at start: YY-MM-DD, YY/MM/DD — only when first part > 31 (unambiguously a year)
    var startMatch = dateStr.match(/^(\d{2})([/\-.]\d{1,2}[/\-.]\d{1,2})$/);
    if (startMatch && parseInt(startMatch[1], 10) > 31) {
      return "20" + startMatch[1] + startMatch[2];
    }
    // Year at end: MM/DD/YY, DD.MM.YY, DD-MM-YY
    dateStr = dateStr.replace(
      /^(\d{1,2}[/\-.]\d{1,2}[/\-.])(\d{2})$/,
      "$120$2",
    );
    return dateStr;
  }

  hasShortYearDates(dateColumnName) {
    if (!this.base_json || !this.base_json.data || !dateColumnName) {
      return false;
    }
    var rows = this.base_json.data.slice(0, 10);
    var shortCount = 0;
    var total = 0;
    rows.forEach(function (row) {
      var val = row[dateColumnName];
      if (val && typeof val === "string" && val.trim().length > 0) {
        total++;
        if (!/\d{4}/.test(val)) {
          shortCount++;
        }
      }
    });
    return total > 0 && shortCount > total / 2;
  }

  // This method converts base_json into a json file with YNAB specific fields based on
  //   which fields you choose in the dropdowns in the browser.

  // --- parameters ----
  // limit: expects an integer and limits how many rows get parsed (specifically for preview)
  //     pass in false or null to do all.
  // lookup: hash definition of YNAB column names to selected base column names. Lets us
  //     convert the uploaded CSV file into the columns that YNAB expects.
  // inverted_outflow: if true, positive values represent outflow while negative values represent inflow
  // inverted_amount: if true, flip the sign on Amount values (positive becomes negative, negative becomes positive)
  // fix_dates: if true, convert 2-digit years to 4-digit years in Date column
  converted_json(
    limit,
    ynab_cols,
    lookup,
    inverted_outflow = false,
    inverted_amount = false,
    fix_dates = false,
  ) {
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
                case "Date":
                  tmp_row[col] = fix_dates
                    ? DataObject.fixTwoDigitYear(cell)
                    : cell;
                  break;
                case "Outflow":
                  if (lookup["Outflow"] == lookup["Inflow"]) {
                    if (!inverted_outflow) {
                      tmp_row[col] = cell.startsWith("-") ? cell.slice(1) : "";
                    } else {
                      tmp_row[col] = cell.startsWith("-") ? "" : cell;
                    }
                  } else {
                    tmp_row[col] = cell.startsWith("-") ? cell.slice(1) : cell;
                  }
                  break;
                case "Inflow":
                  if (lookup["Outflow"] == lookup["Inflow"]) {
                    if (!inverted_outflow) {
                      tmp_row[col] = cell.startsWith("-") ? "" : cell;
                    } else {
                      tmp_row[col] = cell.startsWith("-") ? cell.slice(1) : "";
                    }
                  } else {
                    tmp_row[col] = cell.startsWith("-") ? cell.slice(1) : cell;
                  }
                  break;
                case "Amount":
                  if (inverted_amount) {
                    // Flip sign: remove "-" if negative, add "-" if positive
                    tmp_row[col] = cell.startsWith("-")
                      ? cell.slice(1)
                      : "-" + cell;
                  } else {
                    tmp_row[col] = cell;
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

  converted_csv(
    limit,
    ynab_cols,
    lookup,
    inverted_outflow,
    inverted_amount,
    fix_dates = false,
  ) {
    var string;
    if (this.base_json === null) {
      return nil;
    }
    // Papa.unparse string
    string = '"' + ynab_cols.join('","') + '"\n';
    this.converted_json(
      limit,
      ynab_cols,
      lookup,
      inverted_outflow,
      inverted_amount,
      fix_dates,
    ).forEach(function (row) {
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
