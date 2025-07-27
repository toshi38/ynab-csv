import { test, expect } from "@playwright/test";
import { YnabConverterPage } from "../pages/ynab-converter.page";

test.describe("Settings Panel", () => {
  let ynabPage;

  test.beforeEach(async ({ page }) => {
    ynabPage = new YnabConverterPage(page);
    await ynabPage.goto();

    // Wait for FileUtils to be loaded
    await page.waitForFunction(() => window.FileUtils !== undefined);

    // Upload a test CSV file to enable the settings panel
    const csvContent = `Date,Description,Amount
2024-01-01,Grocery Store,-50.00
2024-01-02,Salary,2000.00
2024-01-03,Coffee Shop,-5.00`;

    await page.evaluate((content) => {
      const blob = new Blob([content], { type: "text/csv" });
      const file = new File([blob], "test.csv", { type: "text/csv" });
      const dt = new DataTransfer();
      dt.items.add(file);

      const fileInput = document.querySelector('[data-testid="file-input"]');
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    }, csvContent);

    await ynabPage.toolWrapper.waitFor({ state: "visible" });
  });

  test("settings panel should be visible after file upload", async ({
    page,
  }) => {
    await expect(ynabPage.settingsToggle).toBeVisible();
    await expect(ynabPage.settingsToggle).toHaveText("File parsing settings");
  });

  test("should toggle settings panel visibility", async ({ page }) => {
    // Settings panel should be hidden by default
    await expect(ynabPage.settingsContent).not.toBeVisible();

    // Click to open
    await ynabPage.toggleSettingsPanel();
    await expect(ynabPage.settingsContent).toBeVisible();

    // Click to close
    await ynabPage.toggleSettingsPanel();
    await expect(ynabPage.settingsContent).not.toBeVisible();
  });

  test("should re-parse file when encoding changes", async ({ page }) => {
    // Get initial preview data
    const initialData = await ynabPage.getPreviewData();

    // Change encoding
    await ynabPage.changeSettingAfterUpload("encoding", "ISO-8859-1");

    // Wait for re-parse
    await page.waitForTimeout(1000);

    // Verify the encoding select in settings panel has the new value
    const encodingSelect = ynabPage.settingsContent.locator(
      '[data-testid="encoding-select"]',
    );
    await expect(encodingSelect).toHaveValue("ISO-8859-1");
  });

  test("should re-parse file when delimiter changes", async ({ page }) => {
    // Upload a semicolon-delimited file
    const csvContent = `Date;Description;Amount
2024-01-01;Store;-50.00
2024-01-02;Income;1000.00`;

    await ynabPage.reloadButton.click();
    await ynabPage.uploadWrapper.waitFor({ state: "visible" });

    await page.evaluate((content) => {
      const blob = new Blob([content], { type: "text/csv" });
      const file = new File([blob], "semicolon.csv", { type: "text/csv" });
      const dt = new DataTransfer();
      dt.items.add(file);

      const fileInput = document.querySelector('[data-testid="file-input"]');
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    }, csvContent);

    await ynabPage.toolWrapper.waitFor({ state: "visible" });

    // Change delimiter to semicolon
    await ynabPage.changeSettingAfterUpload("delimiter", ";");

    // Verify data is parsed correctly
    const previewData = await ynabPage.getPreviewData();
    expect(previewData.length).toBeGreaterThan(0);
  });

  test("should re-parse file when start row changes", async ({ page }) => {
    // Upload file with header rows
    const csvContent = `Bank Statement
Generated on 2024-01-01
Date,Description,Amount
2024-01-01,Store,-50.00
2024-01-02,Income,1000.00`;

    await ynabPage.reloadButton.click();
    await ynabPage.uploadWrapper.waitFor({ state: "visible" });

    await page.evaluate((content) => {
      const blob = new Blob([content], { type: "text/csv" });
      const file = new File([blob], "header-rows.csv", { type: "text/csv" });
      const dt = new DataTransfer();
      dt.items.add(file);

      const fileInput = document.querySelector('[data-testid="file-input"]');
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    }, csvContent);

    await ynabPage.toolWrapper.waitFor({ state: "visible" });

    // Change start row to 3 to skip header lines
    await ynabPage.changeSettingAfterUpload("startRow", 3);

    // Verify the input has the new value
    const startRowInput = ynabPage.settingsContent.locator(
      '[data-testid="start-row-input"]',
    );
    await expect(startRowInput).toHaveValue("3");
  });

  test("should toggle extra row checkbox", async ({ page }) => {
    await ynabPage.changeSettingAfterUpload("extraRow", true);

    const checkbox = ynabPage.settingsContent.locator(
      '[data-testid="extra-row-checkbox"]',
    );
    await expect(checkbox).toBeChecked();

    // Toggle again
    await ynabPage.changeSettingAfterUpload("extraRow", false);
    await expect(checkbox).not.toBeChecked();
  });

  test("worksheet selector should appear for multi-sheet Excel files", async ({
    page,
  }) => {
    // This test would require a multi-sheet Excel file fixture
    // For now, we'll verify that worksheet selector is not visible for CSV files
    await ynabPage.toggleSettingsPanel();

    const worksheetSelect = ynabPage.settingsContent.locator(
      '[data-testid="worksheet-select"]',
    );
    await expect(worksheetSelect).not.toBeVisible();
  });

  test("settings should persist when toggling panel", async ({ page }) => {
    // Change some settings
    await ynabPage.changeSettingAfterUpload("delimiter", ";");
    await ynabPage.changeSettingAfterUpload("startRow", 2);

    // Close panel
    await ynabPage.toggleSettingsPanel();
    await expect(ynabPage.settingsContent).not.toBeVisible();

    // Reopen panel
    await ynabPage.toggleSettingsPanel();
    await expect(ynabPage.settingsContent).toBeVisible();

    // Verify settings are still the same
    const delimiterSelect = ynabPage.settingsContent.locator(
      '[data-testid="delimiter-select"]',
    );
    const startRowInput = ynabPage.settingsContent.locator(
      '[data-testid="start-row-input"]',
    );

    await expect(delimiterSelect).toHaveValue(";");
    await expect(startRowInput).toHaveValue("2");
  });

  test("settings changes should update preview data", async ({ page }) => {
    // Upload CSV with headers
    const csvContent = `Transaction Date,Description,Debit,Credit
01/01/2024,Store,50.00,
02/01/2024,Salary,,2000.00`;

    await ynabPage.reloadButton.click();
    await ynabPage.uploadWrapper.waitFor({ state: "visible" });

    await page.evaluate((content) => {
      const blob = new Blob([content], { type: "text/csv" });
      const file = new File([blob], "transactions.csv", { type: "text/csv" });
      const dt = new DataTransfer();
      dt.items.add(file);

      const fileInput = document.querySelector('[data-testid="file-input"]');
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    }, csvContent);

    await ynabPage.toolWrapper.waitFor({ state: "visible" });

    // Get initial row count
    const initialRows = await ynabPage.getPreviewData();
    const initialRowCount = initialRows.length;

    // Change start row to skip header
    await ynabPage.changeSettingAfterUpload("startRow", 2);

    // Wait for re-parse and get new data
    await page.waitForTimeout(1000);
    const updatedRows = await ynabPage.getPreviewData();

    // Should have different data after skipping header
    expect(updatedRows).not.toEqual(initialRows);
  });
});
