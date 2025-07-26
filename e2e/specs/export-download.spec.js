import { test, expect } from "@playwright/test";
import { YnabConverterPage } from "../pages/ynab-converter.page";
import * as fs from "fs";
import * as path from "path";

test.describe("Export and Download", () => {
  let ynabPage;

  test.beforeEach(async ({ page }) => {
    ynabPage = new YnabConverterPage(page);
    await ynabPage.goto();

    // Wait for FileUtils to be loaded by the page
    await page.waitForFunction(() => window.FileUtils !== undefined);

    // Upload a test CSV file
    const csvContent = `Date,Description,Amount
2024-01-01,Test Transaction 1,-50.00
2024-01-02,Test Transaction 2,100.00
2024-01-03,Test Transaction 3,-25.50`;

    await page.evaluate((content) => {
      const blob = new Blob([content], { type: "text/csv" });
      const file = new File([blob], "test-export.csv", { type: "text/csv" });
      const dt = new DataTransfer();
      dt.items.add(file);

      const fileInput = document.querySelector('[data-testid="file-input"]');
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    }, csvContent);

    await ynabPage.toolWrapper.waitFor({ state: "visible" });
  });

  test("downloads converted YNAB file", async ({ page }) => {
    // Map columns
    await ynabPage.setColumnMapping("Date", "Date");
    await ynabPage.setColumnMapping("Payee", "Description");

    // For new format with Amount column
    const amountColumnExists =
      (await page.locator('[data-testid="column-select-Amount"]').count()) > 0;
    if (amountColumnExists) {
      await ynabPage.setColumnMapping("Amount", "Amount");
    } else {
      // Old format - need to handle Outflow/Inflow
      // This would require more complex logic to split positive/negative
    }

    // Download the file
    const download = await ynabPage.downloadConvertedFile();

    // Verify download
    expect(download).toBeTruthy();

    // Check filename format (should be ynab_data_YYYYMMDD.csv)
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/^ynab_data_\d{8}\.csv$/);

    // Save and verify content
    const downloadPath = await download.path();
    if (downloadPath) {
      const content = fs.readFileSync(downloadPath, "utf-8");

      // Should be valid CSV
      expect(content).toContain(",");

      // Should contain our data
      expect(content).toContain("Test Transaction 1");
      expect(content).toContain("Test Transaction 2");
    }
  });

  test("download button appears after file upload", async ({ page }) => {
    await expect(ynabPage.downloadButton).toBeVisible();
  });

  test("generates correct filename with current date", async ({ page }) => {
    const download = await ynabPage.downloadConvertedFile();
    const filename = download.suggestedFilename();

    // Get current date in YYYYMMDD format
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const expectedDate = `${year}${month}${day}`;

    expect(filename).toBe(`ynab_data_${expectedDate}.csv`);
  });

  test("exported file contains proper CSV format", async ({ page }) => {
    // Set up mappings
    await ynabPage.setColumnMapping("Date", "Date");
    await ynabPage.setColumnMapping("Payee", "Description");

    const download = await ynabPage.downloadConvertedFile();
    const downloadPath = await download.path();

    if (downloadPath) {
      const content = fs.readFileSync(downloadPath, "utf-8");
      const lines = content.trim().split("\n");

      // Should have header row
      expect(lines.length).toBeGreaterThan(1);

      // Check header contains YNAB columns
      const header = lines[0];
      expect(header).toContain("Date");
      expect(header).toContain("Payee");

      // Check data rows
      expect(lines.length).toBe(4); // Header + 3 data rows
    }
  });

  test("handles Excel file export", async ({ page }) => {
    // Upload an Excel file instead
    await page.reload();
    await ynabPage.goto();

    await ynabPage.uploadFile("test_files/test.xlsx");
    await ynabPage.toolWrapper.waitFor({ state: "visible" });

    // Download should work the same way
    const download = await ynabPage.downloadConvertedFile();
    expect(download).toBeTruthy();

    // Should still export as CSV
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/\.csv$/);
  });

  test("exported data respects column mappings", async ({ page }) => {
    // Create specific mappings
    await ynabPage.setColumnMapping("Date", "Date");
    await ynabPage.setColumnMapping("Payee", "Description");
    await ynabPage.setColumnMapping("Memo", "Amount"); // Intentionally wrong mapping

    const download = await ynabPage.downloadConvertedFile();
    const downloadPath = await download.path();

    if (downloadPath) {
      const content = fs.readFileSync(downloadPath, "utf-8");

      // The Amount values should appear in Memo column
      expect(content).toContain("-50.00");
      expect(content).toContain("100.00");

      // Parse CSV to verify structure
      const lines = content.trim().split("\n");
      const dataRow = lines[1].split(",");

      // Memo column (index 2) should have amount value
      expect(dataRow[2]).toMatch(/[\-\d\.]+/);
    }
  });
});
