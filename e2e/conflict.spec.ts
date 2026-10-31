import { test, expect } from "@playwright/test";

test("failed save preserves content", async ({ page, request }) => {
  const email = `e2e-${Date.now()}@example.test`;
  await request.post("http://127.0.0.1:4000/auth/register", {
    data: { email, displayName: "E2E User", password: "Password1", confirmPassword: "Password1" },
  });

  await page.goto("/#login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.getByRole("heading", { name: "Sanctuary", exact: true })).toBeVisible({
    timeout: 15000,
  });

  await page.getByRole("button", { name: /new project/i }).click();
  await page.getByLabel(/title/i).fill("Fail Project");
  await page.getByRole("button", { name: /create project/i }).click();
  await expect(page.getByText("Fail Project")).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: /open binder/i }).click();
  await expect(page.getByText(/binder/i)).toBeVisible({ timeout: 15000 });

  await page.getByLabel(/title/i).fill("Doc");
  await page.getByRole("button", { name: /add item/i }).click();
  await expect(page.getByText("Doc")).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "Open" }).first().click();
  const editor = page.locator(".tiptap-editor").first();
  await expect(editor).toBeVisible({ timeout: 15000 });

  let attempts = 0;
  await page.route("**/api/v1/documents/*/content", async (route) => {
    if (route.request().method() === "PUT" && attempts === 0) {
      attempts += 1;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Save failed" } }),
      });
    } else {
      await route.continue();
    }
  });

  await editor.click();
  await page.keyboard.type("Unsaved draft");
  await page.waitForTimeout(2500);

  // Content remains in the editor after the failed save.
  await expect(editor).toContainText("Unsaved draft");
  await expect(page.getByText(/save failed/i).first()).toBeVisible({ timeout: 15000 });
});

test("stale conflict preserves content", async ({ page, request }) => {
  const email = `e2e-${Date.now()}@example.test`;
  await request.post("http://127.0.0.1:4000/auth/register", {
    data: { email, displayName: "E2E User", password: "Password1", confirmPassword: "Password1" },
  });

  await page.goto("/#login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.getByRole("heading", { name: "Sanctuary", exact: true })).toBeVisible({
    timeout: 15000,
  });

  await page.getByRole("button", { name: /new project/i }).click();
  await page.getByLabel(/title/i).fill("Conflict Project");
  await page.getByRole("button", { name: /create project/i }).click();
  await expect(page.getByText("Conflict Project")).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: /open binder/i }).click();
  await expect(page.getByText(/binder/i)).toBeVisible({ timeout: 15000 });

  await page.getByLabel(/title/i).fill("Doc");
  await page.getByRole("button", { name: /add item/i }).click();
  await expect(page.getByText("Doc")).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "Open" }).first().click();
  const editor = page.locator(".tiptap-editor").first();
  await expect(editor).toBeVisible({ timeout: 15000 });

  await editor.click();
  await page.keyboard.type("original");
  await expect(page.getByText(/^saved$/i)).toBeVisible({ timeout: 15000 });

  // Force every subsequent save to conflict.
  await page.route("**/api/v1/documents/*/content", async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "DOCUMENT_VERSION_CONFLICT", message: "Conflict" } }),
      });
    } else {
      await route.continue();
    }
  });

  await editor.click();
  await page.keyboard.type(" newer");
  await page.waitForTimeout(2500);

  // Unsaved content remains visible.
  await expect(editor).toContainText("newer");

  // Restore normal behavior.
  await page.unroute("**/api/v1/documents/*/content");
});
