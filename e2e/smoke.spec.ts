import { test, expect } from "@playwright/test";

test("registration", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.test`;
  await page.goto("/#register");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/display name/i).fill("E2E User");
  await page.getByLabel(/^password$/i).fill("Password1");
  await page.getByLabel(/confirm password/i).fill("Password1");
  await page.getByRole("button", { name: /register/i }).click();
  await expect(page.getByText(/account created/i)).toBeVisible({ timeout: 15000 });
});

test("login", async ({ page, request }) => {
  const email = `e2e-${Date.now()}@example.test`;
  await request.post("http://127.0.0.1:4000/auth/register", {
    data: {
      email,
      displayName: "E2E User",
      password: "Password1",
      confirmPassword: "Password1",
    },
  });

  await page.goto("/#login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForTimeout(5000);
  await expect(page.getByRole("heading", { name: "Sanctuary", exact: true })).toBeVisible({
    timeout: 15000,
  });
});

test("writing workflow", async ({ page, request }) => {
  const email = `e2e-${Date.now()}@example.test`;
  await request.post("http://127.0.0.1:4000/auth/register", {
    data: {
      email,
      displayName: "E2E User",
      password: "Password1",
      confirmPassword: "Password1",
    },
  });

  await page.goto("/#login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForTimeout(5000);
  await expect(page.getByRole("heading", { name: "Sanctuary", exact: true })).toBeVisible({
    timeout: 15000,
  });

  await page.getByRole("button", { name: /new project/i }).click();
  await page.getByLabel(/title/i).fill("E2E Project");
  await page.getByRole("button", { name: /create project/i }).click();
  await expect(page.getByText("E2E Project")).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: /open binder/i }).click();
  await expect(page.getByText(/binder/i)).toBeVisible({ timeout: 15000 });

  await page.getByLabel(/title/i).fill("Scene One");
  await page.getByRole("button", { name: /add item/i }).click();
  await expect(page.getByText("Scene One")).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "Open" }).first().click();
  const editor = page.locator(".tiptap-editor").first();
  await expect(editor).toBeVisible({ timeout: 15000 });

  await editor.click();
  await page.keyboard.type("Hello world");
  await expect(page.getByText(/^saved$/i)).toBeVisible({ timeout: 15000 });

  await page.reload();
  await expect(page.getByRole("heading", { name: "Sanctuary", exact: true })).toBeVisible({
    timeout: 15000,
  });
  await page
    .getByRole("button", { name: /open binder/i })
    .first()
    .click();
  await expect(page.getByText(/binder/i)).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Open" }).first().click();
  await expect(page.locator(".tiptap-editor")).toContainText("Hello world", { timeout: 15000 });
});
