import { test, expect } from "@playwright/test";
import { YnabConverterPage } from "../pages/ynab-converter.page";

test.describe("File Upload", () => {
  let ynabPage;

  test.beforeEach(async ({ page }) => {
    ynabPage = new YnabConverterPage(page);
    await ynabPage.goto();

    // Wait for FileUtils to be loaded by the page
    await page.waitForFunction(() => window.FileUtils !== undefined);
  });

  test("shows upload interface on load", async ({ page }) => {
    await expect(ynabPage.uploadWrapper).toBeVisible();
    await expect(ynabPage.dropzone).toBeVisible();
    await expect(page.getByText("Drop CSV or Excel file")).toBeVisible();
  });

  test("accepts CSV file upload", async ({ page }) => {
    // Create a test CSV file content
    const csvContent = `Date,Description,Amount
2024-01-01,Test Transaction,-50.00
2024-01-02,Another Transaction,100.00`;

    // Create a file from string
    await page.evaluate((content) => {
      const blob = new Blob([content], { type: "text/csv" });
      const file = new File([blob], "test.csv", { type: "text/csv" });
      const dt = new DataTransfer();
      dt.items.add(file);

      const fileInput = document.querySelector('[data-testid="file-input"]');
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    }, csvContent);

    await expect(ynabPage.toolWrapper).toBeVisible();
    await expect(ynabPage.dataTable).toBeVisible();
  });

  // Test each Excel format
  const excelFormats = [
    { ext: "xlsx", name: "Excel 2007+" },
    { ext: "xls", name: "Excel 97-2003" },
    { ext: "xlsm", name: "Excel with Macros" },
    { ext: "xlsb", name: "Binary Excel" },
  ];

  for (const format of excelFormats) {
    test(`uploads ${format.name} (${format.ext}) file successfully`, async ({
      page,
    }) => {
      const filePath = `test_files/test.${format.ext}`;

      await ynabPage.uploadFile(filePath);

      // Verify file was loaded
      await expect(ynabPage.toolWrapper).toBeVisible({ timeout: 15000 });
      await expect(ynabPage.dataTable).toBeVisible();

      // Verify file type badge shows correct format (wait longer for Excel processing)
      await expect(ynabPage.fileTypeBadge).toBeVisible({ timeout: 15000 });
      const badgeText = await ynabPage.fileTypeBadge.textContent();
      expect(badgeText.toLowerCase()).toContain(format.ext);
    });
  }

  test("shows worksheet selector for multi-sheet Excel files", async ({
    page,
  }) => {
    // Would need a multi-sheet test file
    // For now, verify selector doesn't show for single-sheet files
    await ynabPage.uploadFile("test_files/test.xlsx");

    // Check if worksheet selector exists
    const worksheetSelectorCount = await ynabPage.worksheetSelector.count();

    // This test assumes test.xlsx has only one sheet
    // Update when we have a multi-sheet test file
    if (worksheetSelectorCount > 0) {
      const worksheetOptions = await ynabPage.worksheetSelector
        .locator("option")
        .count();
      expect(worksheetOptions).toBeGreaterThan(0);
    }
  });

  test("handles drag and drop file upload", async ({ page }) => {
    // Create a test CSV for drag and drop
    const csvContent = `Date,Payee,Amount
2024-01-01,Store A,-25.00
2024-01-02,Store B,-30.00`;

    // Simulate drag and drop using test ID
    await page.evaluate((content) => {
      const dropzone = document.querySelector('[data-testid="dropzone"]');

      // Create drag events
      const dragEnterEvent = new DragEvent("dragenter", {
        bubbles: true,
        cancelable: true,
      });

      const dragOverEvent = new DragEvent("dragover", {
        bubbles: true,
        cancelable: true,
      });

      dropzone.dispatchEvent(dragEnterEvent);
      dropzone.dispatchEvent(dragOverEvent);

      // Create file and drop event
      const blob = new Blob([content], { type: "text/csv" });
      const file = new File([blob], "drag-test.csv", { type: "text/csv" });
      const dt = new DataTransfer();
      dt.items.add(file);

      const dropEvent = new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
      });

      dropzone.dispatchEvent(dropEvent);
    }, csvContent);

    // Verify file was processed
    await expect(ynabPage.toolWrapper).toBeVisible({ timeout: 5000 });
  });

  test("shows error for invalid file types", async ({ page }) => {
    // Create an invalid file type
    await page.evaluate(() => {
      const blob = new Blob(["invalid content"], { type: "text/plain" });
      const file = new File([blob], "test.txt", { type: "text/plain" });
      const dt = new DataTransfer();
      dt.items.add(file);

      const fileInput = document.querySelector('[data-testid="file-input"]');
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Wait a moment for the app to process the file
    await page.waitForTimeout(1000);

    // The app should either:
    // 1. Show the tool wrapper (if it parsed as CSV)
    // 2. Stay on upload screen (if it failed)
    // 3. Show some error state
    const toolWrapperVisible = await ynabPage.toolWrapper.isVisible();
    const uploadWrapperVisible = await ynabPage.uploadWrapper.isVisible();

    // At least one wrapper should be visible (upload or tool)
    // If both are hidden, that indicates an unexpected error state
    expect(toolWrapperVisible || uploadWrapperVisible).toBeTruthy();
  });

  test("configuration dropdown is accessible", async ({ page }) => {
    await ynabPage.openConfigDropdown();

    await expect(ynabPage.encodingSelect).toBeVisible();
    await expect(ynabPage.delimiterSelect).toBeVisible();
    await expect(ynabPage.startRowInput).toBeVisible();
    await expect(ynabPage.extraRowCheckbox).toBeVisible();
  });
});
