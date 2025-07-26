import { test, expect } from "@playwright/test";
import { YnabConverterPage } from "../pages/ynab-converter.page";

test.describe("Column Mapping", () => {
  let ynabPage;

  test.beforeEach(async ({ page }) => {
    ynabPage = new YnabConverterPage(page);
    await ynabPage.goto();

    // Upload a test CSV file
    const csvContent = `Transaction Date,Description,Debit,Credit,Balance
2024-01-01,Grocery Store,50.00,,1000.00
2024-01-02,Salary,,2000.00,3000.00
2024-01-03,Electric Bill,150.00,,2850.00`;

    await page.evaluate((content) => {
      const blob = new Blob([content], { type: "text/csv" });
      const file = new File([blob], "test-mapping.csv", { type: "text/csv" });
      const dt = new DataTransfer();
      dt.items.add(file);

      const fileInput = document.querySelector('[data-testid="file-input"]');
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    }, csvContent);

    await ynabPage.toolWrapper.waitFor({ state: "visible" });
  });

  test("displays column mapping dropdowns", async ({ page }) => {
    const mappingSelects = await ynabPage.columnMappingSelects.count();
    expect(mappingSelects).toBeGreaterThan(0);

    // Check for YNAB column headers using test IDs
    await expect(
      page.locator('[data-testid="column-header-Date"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="column-header-Payee"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="column-header-Memo"]'),
    ).toBeVisible();
  });

  test("allows mapping CSV columns to YNAB format", async ({ page }) => {
    // Map Date column
    await ynabPage.setColumnMapping("Date", "Transaction Date");

    // Map Payee column
    await ynabPage.setColumnMapping("Payee", "Description");

    // Verify preview updates
    const previewData = await ynabPage.getPreviewData();
    expect(previewData.length).toBeGreaterThan(0);

    // First row should have date from Transaction Date column
    expect(previewData[0][0]).toContain("2024-01-01");
  });

  test("toggles between old and new YNAB format", async ({ page }) => {
    // Check initial format using test IDs
    const outflowExists = await page
      .locator('[data-testid="column-header-Outflow"]')
      .isVisible();
    const inflowExists = await page
      .locator('[data-testid="column-header-Inflow"]')
      .isVisible();

    if (outflowExists && inflowExists) {
      // Toggle to new format
      await ynabPage.toggleFormatButton.click();

      // Should now show Amount column
      await expect(
        page.locator('[data-testid="column-header-Amount"]'),
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="column-header-Outflow"]'),
      ).not.toBeVisible();
      await expect(
        page.locator('[data-testid="column-header-Inflow"]'),
      ).not.toBeVisible();

      // Toggle back
      await ynabPage.toggleFormatButton.click();
      await expect(
        page.locator('[data-testid="column-header-Outflow"]'),
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="column-header-Inflow"]'),
      ).toBeVisible();
    } else {
      // Started with new format, toggle to old
      await ynabPage.toggleFormatButton.click();
      await expect(
        page.locator('[data-testid="column-header-Outflow"]'),
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="column-header-Inflow"]'),
      ).toBeVisible();
    }
  });

  test("inverts transaction flows", async ({ page }) => {
    // Map columns first
    await ynabPage.setColumnMapping("Date", "Transaction Date");
    await ynabPage.setColumnMapping("Payee", "Description");
    // Map both Outflow and Inflow to the same field (Balance) to enable invert flows button
    await ynabPage.setColumnMapping("Outflow", "Balance");
    await ynabPage.setColumnMapping("Inflow", "Balance");

    // Get initial preview data
    const initialData = await ynabPage.getPreviewData();

    // Click invert flows button (should now be visible)
    await ynabPage.invertFlowsButton.click();

    // Get updated preview data
    const invertedData = await ynabPage.getPreviewData();

    // Data should be different after inversion
    expect(invertedData).not.toEqual(initialData);
  });

  test("preserves column mappings when switching formats", async ({ page }) => {
    // Set up mappings
    await ynabPage.setColumnMapping("Date", "Transaction Date");
    await ynabPage.setColumnMapping("Payee", "Description");

    // Get the selected values using test IDs
    const dateMapping = await page
      .locator('[data-testid="column-select-Date"]')
      .inputValue();
    const payeeMapping = await page
      .locator('[data-testid="column-select-Payee"]')
      .inputValue();

    // Toggle format
    await ynabPage.toggleFormatButton.click();

    // Check that Date and Payee mappings are preserved
    const dateMappingAfter = await page
      .locator('[data-testid="column-select-Date"]')
      .inputValue();
    const payeeMappingAfter = await page
      .locator('[data-testid="column-select-Payee"]')
      .inputValue();

    expect(dateMappingAfter).toBe(dateMapping);
    expect(payeeMappingAfter).toBe(payeeMapping);
  });

  test("handles empty column mapping", async ({ page }) => {
    // Leave some columns unmapped
    await ynabPage.setColumnMapping("Date", "Transaction Date");
    // Leave Payee unmapped

    // Should still show preview
    const previewData = await ynabPage.getPreviewData();
    expect(previewData.length).toBeGreaterThan(0);

    // Unmapped columns should be empty (dots may be visual placeholders via CSS)
    expect(previewData[0][1].trim()).toBe(""); // Payee should be empty
  });
});
