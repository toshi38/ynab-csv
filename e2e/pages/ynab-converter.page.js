export class YnabConverterPage {
  constructor(page) {
    this.page = page;

    // File upload elements
    this.fileInput = page.locator('[data-testid="file-input"]');
    this.dropzone = page.locator('[data-testid="dropzone"]');
    this.uploadWrapper = page.locator('[data-testid="upload-wrapper"]');

    // Data display elements
    this.toolWrapper = page.locator('[data-testid="tool-wrapper"]');
    this.dataTable = page.locator('[data-testid="data-preview-table"]');
    this.fileTypeBadge = page.locator('[data-testid="file-type-badge"]');

    // Excel worksheet selector
    this.worksheetSelector = page.locator('[data-testid="worksheet-select"]');

    // Configuration elements
    this.encodingSelect = page.locator('[data-testid="encoding-select"]');
    this.delimiterSelect = page.locator('[data-testid="delimiter-select"]');
    this.startRowInput = page.locator('[data-testid="start-row-input"]');
    this.extraRowCheckbox = page.locator('[data-testid="extra-row-checkbox"]');
    this.configDropdown = page.locator('[data-testid="config-dropdown"]');

    // Column mapping selects
    this.columnMappingSelects = page.locator('[data-testid^="column-select-"]');

    // Profile elements
    this.profileSelect = page.locator('[data-testid="profile-select"]');

    // Action buttons
    this.downloadButton = page.locator('[data-testid="download-button"]');
    this.invertFlowsButton = page.locator(
      '[data-testid="invert-flows-button"]',
    );
    this.toggleFormatButton = page.locator(
      '[data-testid="toggle-format-button"]',
    );
    this.reloadButton = page.locator('[data-testid="reload-button"]');
  }

  async goto() {
    await this.page.goto("/");
    await this.page.waitForSelector(".show_on_load", { state: "visible" });
  }

  async uploadFile(filePath) {
    await this.fileInput.setInputFiles(filePath);
    await this.toolWrapper.waitFor({ state: "visible" });
  }

  async dragAndDropFile(filePath) {
    const dataTransfer = await this.page.evaluateHandle(
      () => new DataTransfer(),
    );

    await this.page.dispatchEvent('[data-testid="dropzone"]', "dragenter", {
      dataTransfer,
    });
    await this.page.dispatchEvent('[data-testid="dropzone"]', "dragover", {
      dataTransfer,
    });

    await this.fileInput.setInputFiles(filePath);
    const files = await this.fileInput.inputValue();

    await this.page.dispatchEvent('[data-testid="dropzone"]', "drop", {
      dataTransfer: await this.page.evaluateHandle((files) => {
        const dt = new DataTransfer();
        // Simulate file drop
        return dt;
      }, files),
    });

    await this.toolWrapper.waitFor({ state: "visible" });
  }

  async selectWorksheet(index) {
    await this.worksheetSelector.selectOption({ index: index.toString() });
  }

  async setColumnMapping(ynabColumn, csvColumn) {
    const select = this.page.locator(
      `[data-testid="column-select-${ynabColumn}"]`,
    );

    // Wait for the select to have options available and find the option value
    const optionValue = await this.page.evaluate(
      ({ selectId, targetColumn }) => {
        const select = document.querySelector(`[data-testid="${selectId}"]`);
        if (!select) return false;
        const options = Array.from(select.options);

        // Try to find option that matches the target column
        const matchingOption = options.find(
          (option) =>
            option.textContent.includes(targetColumn) ||
            option.value.includes(targetColumn) ||
            option.label === targetColumn ||
            option.label.startsWith(targetColumn), // Handle "Transaction Date (1)" format
        );

        return matchingOption ? matchingOption.value : false;
      },
      { selectId: `column-select-${ynabColumn}`, targetColumn: csvColumn },
    );

    if (optionValue) {
      await select.selectOption(optionValue);

      // Wait for AngularJS to process the change and update the preview
      await this.page.waitForFunction(
        () => {
          // Check if Angular scope exists and has processed the change
          const scope = angular.element(document.body).scope();
          return scope && scope.preview && scope.preview.length > 0;
        },
        { timeout: 5000 },
      );

      // Small additional wait to ensure DOM updates are complete
      await this.page.waitForTimeout(100);
    } else {
      throw new Error(
        `Could not find option for column: ${csvColumn} in ${ynabColumn} select`,
      );
    }
  }

  async getPreviewData() {
    // Use data-testid selectors for reliable element targeting
    const rows = await this.page
      .locator(
        '[data-testid="data-preview-table"] [data-testid^="preview-row-"]',
      )
      .all();
    const data = [];

    for (const row of rows) {
      const cells = await row
        .locator('[data-testid^="preview-cell-"]')
        .allTextContents();
      data.push(cells);
    }

    return data;
  }

  async downloadConvertedFile() {
    // Ensure data is processed and download button is available
    await this.downloadButton.waitFor({ state: "visible" });

    // Wait for any pending Angular operations to complete
    await this.page.waitForFunction(
      () => {
        const scope = angular.element(document.body).scope();
        return scope && scope.preview && scope.preview.length > 0;
      },
      { timeout: 5000 },
    );

    const downloadPromise = this.page.waitForEvent("download");
    await this.downloadButton.click();
    const download = await downloadPromise;
    return download;
  }

  async openConfigDropdown() {
    await this.configDropdown.click();
    await this.page.locator(".dropdown-menu").waitFor({ state: "visible" });
  }

  async setEncoding(encoding) {
    await this.openConfigDropdown();
    await this.encodingSelect.selectOption(encoding);
  }

  async setDelimiter(delimiter) {
    await this.openConfigDropdown();
    await this.delimiterSelect.selectOption(delimiter);
  }

  async setStartRow(row) {
    await this.openConfigDropdown();
    await this.startRowInput.fill(row.toString());
  }

  async toggleExtraRow() {
    await this.openConfigDropdown();
    await this.extraRowCheckbox.click();
  }

  async getCurrentProfile() {
    return await this.profileSelect.inputValue();
  }

  async selectProfile(profileName) {
    await this.profileSelect.selectOption(profileName);
  }
}
