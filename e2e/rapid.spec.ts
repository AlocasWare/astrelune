import { test, expect } from "@playwright/test";

test("rapid edits preserve latest content", async ({ page, request }) => {
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
  await page.getByLabel(/title/i).fill("Rapid Project");
  await page.getByRole("button", { name: /create project/i }).click();
  await expect(page.getByText("Rapid Project")).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: /open binder/i }).click();
  await expect(page.getByText(/binder/i)).toBeVisible({ timeout: 15000 });

  await page.getByLabel(/title/i).fill("Doc");
  await page.getByRole("button", { name: /add item/i }).click();
  await expect(page.getByText("Doc")).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "Open" }).first().click();
  const editor = page.locator(".tiptap-editor").first();
  await expect(editor).toBeVisible({ timeout: 15000 });

  await editor.click();
  await page.keyboard.type("first");
  await expect(page.getByText(/^saved$/i)).toBeVisible({ timeout: 15000 });

  await editor.click();
  await page.keyboard.type(" second");
  await expect(page.getByText(/^saved$/i)).toBeVisible({ timeout: 15000 });
});
