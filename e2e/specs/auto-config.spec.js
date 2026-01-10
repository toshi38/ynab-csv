import { test, expect } from "@playwright/test";
import { YnabConverterPage } from "../pages/ynab-converter.page";
import path from "path";

test.describe("Auto-matching Configuration", () => {
  let ynabPage;

  test.beforeEach(async ({ page }) => {
    ynabPage = new YnabConverterPage(page);
    await ynabPage.goto();
    // Clear any saved configurations before each test
    await ynabPage.clearLocalStorage();
    await page.reload();
    await ynabPage.page.waitForSelector(".show_on_load", { state: "visible" });
  });

  test.describe("Auto-save on download", () => {
    test("saves configuration when downloading converted file", async ({
      page,
    }) => {
      // Upload chase_statement_2024.csv
      const filePath = path.resolve("test_files/chase_statement_2024.csv");
      await ynabPage.uploadFile(filePath);

      // Map columns
      await ynabPage.setColumnMapping("Date", "Date");
      await ynabPage.setColumnMapping("Payee", "Description");
      await ynabPage.setColumnMapping("Outflow", "Amount");

      // Download the file (which should auto-save config)
      await ynabPage.downloadConvertedFile();

      // Verify config was saved to localStorage
      const configs = await ynabPage.getLocalStorageConfigs();
      expect(configs).not.toBeNull();
      expect(Object.keys(configs.configs).length).toBeGreaterThan(0);
    });
  });

  test.describe("Auto-apply on upload", () => {
    test("auto-applies configuration when uploading file with matching headers", async ({
      page,
    }) => {
      // First, upload and configure chase_statement_2024.csv
      const filePath2024 = path.resolve("test_files/chase_statement_2024.csv");
      await ynabPage.uploadFile(filePath2024);

      await ynabPage.setColumnMapping("Date", "Date");
      await ynabPage.setColumnMapping("Payee", "Description");
      await ynabPage.setColumnMapping("Outflow", "Amount");

      // Download to save the config
      await ynabPage.downloadConvertedFile();

      // Reload the page to reset state
      await page.reload();
      await ynabPage.page.waitForSelector(".show_on_load", {
        state: "visible",
      });

      // Now upload chase_statement_2025.csv (same headers)
      const filePath2025 = path.resolve("test_files/chase_statement_2025.csv");
      await ynabPage.uploadFile(filePath2025);

      // Should show auto-apply notification
      await expect(ynabPage.autoApplyNotification).toBeVisible({
        timeout: 5000,
      });

      // The notification message should indicate auto-apply
      const message = await ynabPage.getAutoApplyMessage();
      expect(message).toContain("auto");
    });

    test("does not auto-apply when uploading file with different headers", async ({
      page,
    }) => {
      // First, upload and configure chase_statement_2024.csv
      const chaseFile = path.resolve("test_files/chase_statement_2024.csv");
      await ynabPage.uploadFile(chaseFile);

      await ynabPage.setColumnMapping("Date", "Date");
      await ynabPage.setColumnMapping("Payee", "Description");

      // Download to save the config
      await ynabPage.downloadConvertedFile();

      // Reload the page to reset state
      await page.reload();
      await ynabPage.page.waitForSelector(".show_on_load", {
        state: "visible",
      });

      // Now upload wells_fargo file (different headers)
      const wellsFargoFile = path.resolve(
        "test_files/wells_fargo_checking.csv",
      );
      await ynabPage.uploadFile(wellsFargoFile);

      // Should NOT show auto-apply notification
      await expect(ynabPage.autoApplyNotification).not.toBeVisible();
    });
  });

  test.describe("startAtRow handling", () => {
    test("auto-applies configuration with correct startAtRow for files with metadata rows", async ({
      page,
    }) => {
      // Set start row to 3 BEFORE uploading (dropdown is only visible on landing page)
      await ynabPage.openConfigDropdown();
      await ynabPage.startRowInput.fill("3");

      // Wait for Angular to process
      await page.waitForTimeout(300);

      // Close dropdown
      await page.click("body");

      // Upload file with headers on row 3
      const metadataFile = path.resolve("test_files/metadata_header_row3.csv");
      await ynabPage.uploadFile(metadataFile);

      // Map columns
      await ynabPage.setColumnMapping("Date", "Date");
      await ynabPage.setColumnMapping("Payee", "Payee");
      await ynabPage.setColumnMapping("Outflow", "Amount");

      // Download to save config
      await ynabPage.downloadConvertedFile();

      // Reload and upload second file with same structure
      await page.reload();
      await ynabPage.page.waitForSelector(".show_on_load", {
        state: "visible",
      });

      const metadataFileV2 = path.resolve(
        "test_files/metadata_header_row3_v2.csv",
      );
      await ynabPage.uploadFile(metadataFileV2);

      // Should auto-apply with correct startAtRow
      await expect(ynabPage.autoApplyNotification).toBeVisible({
        timeout: 5000,
      });

      // Verify the preview data has correct content (startAtRow was applied)
      const previewData = await ynabPage.getPreviewData();
      // The first row should have a date, not metadata text (trim whitespace)
      expect(previewData[0][0].trim()).toMatch(/^\d{4}-\d{2}-\d{2}/);
    });
  });

  test.describe("Semicolon delimiter", () => {
    test("preserves semicolon delimiter setting in saved config", async ({
      page,
    }) => {
      // Set delimiter to semicolon BEFORE uploading (dropdown is only visible on landing page)
      await ynabPage.openConfigDropdown();
      await ynabPage.delimiterSelect.selectOption(";");

      // Wait for Angular to process
      await page.waitForTimeout(300);

      // Close dropdown
      await page.click("body");

      // Upload kontoutdrag file (semicolon delimited)
      const kontoutdragFile = path.resolve(
        "test_files/kontoutdrag 20251227-0654.csv",
      );
      await ynabPage.uploadFile(kontoutdragFile);

      // Map columns
      await ynabPage.setColumnMapping("Date", "Booking date");
      await ynabPage.setColumnMapping("Payee", "Text");
      await ynabPage.setColumnMapping("Outflow", "Amount");

      // Download to save config
      await ynabPage.downloadConvertedFile();

      // Verify config was saved with correct delimiter
      const configs = await ynabPage.getLocalStorageConfigs();
      const configId = Object.keys(configs.configs)[0];
      const savedConfig = configs.configs[configId];

      expect(savedConfig.chosenDelimiter).toBe(";");
    });
  });

  test.describe("Saved configs management", () => {
    test("shows saved configurations on landing page", async ({ page }) => {
      // First, create a saved config
      const filePath = path.resolve("test_files/chase_statement_2024.csv");
      await ynabPage.uploadFile(filePath);

      await ynabPage.setColumnMapping("Date", "Date");
      await ynabPage.setColumnMapping("Payee", "Description");

      await ynabPage.downloadConvertedFile();

      // Reload to go back to landing page
      await page.reload();
      await ynabPage.page.waitForSelector(".show_on_load", {
        state: "visible",
      });

      // Should show saved configs card
      await expect(ynabPage.savedConfigsCard).toBeVisible();

      // Should have at least one config
      const count = await ynabPage.getSavedConfigsCount();
      expect(count).toBeGreaterThan(0);
    });

    test("can delete a saved configuration", async ({ page }) => {
      // Create a saved config
      const filePath = path.resolve("test_files/chase_statement_2024.csv");
      await ynabPage.uploadFile(filePath);

      await ynabPage.setColumnMapping("Date", "Date");
      await ynabPage.setColumnMapping("Payee", "Description");

      await ynabPage.downloadConvertedFile();

      // Reload to go back to landing page
      await page.reload();
      await ynabPage.page.waitForSelector(".show_on_load", {
        state: "visible",
      });

      // Get initial count
      const initialCount = await ynabPage.getSavedConfigsCount();
      expect(initialCount).toBeGreaterThan(0);

      // Delete the config
      await ynabPage.deleteConfigAt(0);

      // Wait for deletion to process
      await page.waitForTimeout(500);

      // Count should be reduced
      const finalCount = await ynabPage.getSavedConfigsCount();
      expect(finalCount).toBe(initialCount - 1);
    });
  });

  test.describe("Save with custom name", () => {
    test("allows saving configuration with custom name via prompt", async ({
      page,
    }) => {
      // Upload a file
      const filePath = path.resolve("test_files/chase_statement_2024.csv");
      await ynabPage.uploadFile(filePath);

      await ynabPage.setColumnMapping("Date", "Date");
      await ynabPage.setColumnMapping("Payee", "Description");

      // Set up dialog handler BEFORE triggering the save
      page.once("dialog", async (dialog) => {
        await dialog.accept("My Custom Chase Config");
      });

      // Click the dropdown toggle to show options
      const dropdownToggle = ynabPage.saveConfigDropdown.locator(
        ".dropdown-toggle-split",
      );
      await dropdownToggle.click();

      // Click "Save as..." option
      const saveAsButton = page.locator('[data-testid="save-config-as"]');
      await saveAsButton.click();

      // Wait for save to process
      await page.waitForTimeout(500);

      // Verify config was saved with custom name
      const configs = await ynabPage.getLocalStorageConfigs();
      const configId = Object.keys(configs.configs)[0];
      const savedConfig = configs.configs[configId];

      expect(savedConfig.name).toBe("My Custom Chase Config");
    });
  });
});
