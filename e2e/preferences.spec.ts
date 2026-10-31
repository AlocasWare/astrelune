import { test, expect } from "@playwright/test";

test("preferences persistence", async ({ page, request }) => {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
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

  await page.goto("/?x=" + Date.now() + "#settings");
  await page.getByLabel(/theme/i).selectOption("DARK");
  await page.getByRole("button", { name: /save preferences/i }).click();
  await expect(page.getByText(/preferences saved/i)).toBeVisible({ timeout: 15000 });

  await page.reload();
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByLabel(/theme/i)).toHaveValue("DARK");

  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(theme).toBe("DARK");
});
test("editor font preference persists", async ({ page, request }) => {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
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

  await page.goto("/?x=" + Date.now() + "#settings");
  await page.getByLabel(/editor font family/i).fill("monospace");
  await page.getByRole("button", { name: /save preferences/i }).click();
  await expect(page.getByText(/preferences saved/i)).toBeVisible({ timeout: 15000 });

  await page.goto("/?x=" + Date.now() + "#projects");
  await page.getByRole("button", { name: /new project/i }).click();
  await page.getByLabel(/title/i).fill("Font Project");
  await page.getByRole("button", { name: /create project/i }).click();
  await expect(page.getByText("Font Project")).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: /open binder/i }).click();
  await expect(page.getByText(/binder/i)).toBeVisible({ timeout: 15000 });

  await page.getByLabel(/title/i).fill("Doc");
  await page.getByRole("button", { name: /add item/i }).click();
  await expect(page.getByText("Doc")).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "Open" }).first().click();
  const editor = page.locator(".tiptap-editor .ProseMirror").first();
  await expect(editor).toBeVisible({ timeout: 15000 });

  const fontFamily = await editor.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(fontFamily).toContain("monospace");

  await page.reload();
  await page.goto("/?x=" + Date.now() + "#settings");
  await expect(page.getByLabel(/editor font family/i)).toHaveValue("monospace");
});
test("editor typography preferences persist", async ({ page, request }) => {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
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

  await page.goto("/?x=" + Date.now() + "#settings");
  await page.getByLabel(/editor font size/i).fill("24");
  await page.getByLabel(/editor line height/i).fill("2.5");
  await page.getByRole("button", { name: /save preferences/i }).click();
  await expect(page.getByText(/preferences saved/i)).toBeVisible({ timeout: 15000 });

  await page.goto("/?x=" + Date.now() + "#projects");
  await page.getByRole("button", { name: /new project/i }).click();
  await page.getByLabel(/title/i).fill("Type Project");
  await page.getByRole("button", { name: /create project/i }).click();
  await expect(page.getByText("Type Project")).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: /open binder/i }).click();
  await expect(page.getByText(/binder/i)).toBeVisible({ timeout: 15000 });

  await page.getByLabel(/title/i).fill("Doc");
  await page.getByRole("button", { name: /add item/i }).click();
  await expect(page.getByText("Doc")).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "Open" }).first().click();
  const editor = page.locator(".tiptap-editor .ProseMirror").first();
  await expect(editor).toBeVisible({ timeout: 15000 });

  const fontSize = await editor.evaluate((el) => getComputedStyle(el).fontSize);
  const lineHeight = await editor.evaluate((el) => getComputedStyle(el).lineHeight);
  expect(fontSize).toBe("24px");
  expect(Number.parseFloat(lineHeight)).toBeCloseTo(2.5 * 24, 1);

  await page.reload();
  await page.goto("/?x=" + Date.now() + "#settings");
  await expect(page.getByLabel(/editor font size/i)).toHaveValue("24");
  await expect(page.getByLabel(/editor line height/i)).toHaveValue("2.5");
});
