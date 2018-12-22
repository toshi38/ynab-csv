// This class does all the heavy lifting.
// It takes the and can format it into csv
window.DataObject = class DataObject {
  constructor() {
    this.base_json = null;
  }
  // Parse base csv file as JSON. This will be easier to work with.
  // It uses http://papaparse.com/ for handling parsing
  parse_csv(csv, encoding) {
    let existingHeaders = [];
    return (this.base_json = Papa.parse(csv, {
      skipEmptyLines: true,
      header: true,
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
    }));
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
                    tmp_row[col] = cell;
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
        return row_values.push(row[col]);
      });
      return (string += '"' + row_values.join('","') + '"\n');
    });
    return string;
  }
};