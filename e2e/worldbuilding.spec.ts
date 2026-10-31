import { test, expect } from "@playwright/test";

test("worldbuilding workflow", async ({ page, request }) => {
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

  await page.goto("/?x=" + Date.now() + "#worlds");
  await page.getByRole("button", { name: /new world/i }).click();
  await page.getByLabel(/name/i).fill("Test World");
  await page.getByRole("button", { name: /create world/i }).click();
  await expect(page.getByText("Test World")).toBeVisible({ timeout: 15000 });

  // Select world (button with name)
  await page.getByRole("button", { name: "Test World" }).click();

  // Create two entries.
  await page.getByRole("button", { name: /new entry/i }).click();
  await page.getByLabel(/name/i).fill("Alice");
  await page.getByRole("button", { name: /create entry/i }).click();
  await expect(page.getByText(/Alice/)).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: /new entry/i }).click();
  await page.getByLabel(/name/i).fill("Bob");
  await page.getByRole("button", { name: /create entry/i }).click();
  await expect(page.getByText(/Bob/)).toBeVisible({ timeout: 15000 });

  // Reload and verify world persists.
  await page.reload();
  await expect(page.getByText("Test World")).toBeVisible({ timeout: 15000 });
});
test("worldbuilding relationships", async ({ page, request }) => {
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

  await page.goto("/?x=" + Date.now() + "#worlds");
  await page.getByRole("button", { name: /new world/i }).click();
  await page.getByLabel(/name/i).fill("Rel World");
  await page.getByRole("button", { name: /create world/i }).click();
  await expect(page.getByText("Rel World")).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "Rel World" }).click();

  await page.getByRole("button", { name: /new entry/i }).click();
  await page.getByLabel(/name/i).fill("Alice");
  await page.getByRole("button", { name: /create entry/i }).click();
  await expect(page.getByText(/Alice/)).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: /new entry/i }).click();
  await page.getByLabel(/name/i).fill("Bob");
  await page.getByRole("button", { name: /create entry/i }).click();
  await expect(page.getByText(/Bob/)).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: /Alice/ }).click();
  const relationshipForm = page.locator("form").filter({ hasText: "Add relationship" });
  const targetSelect = relationshipForm.getByLabel(/target entry/i);
  await targetSelect.selectOption({ index: 1 });
  await relationshipForm.getByLabel(/type/i).fill("KNOWS");
  await relationshipForm.getByRole("button", { name: /add relationship/i }).click();
  await expect(page.getByText(/KNOWS/)).toBeVisible({ timeout: 15000 });

  await page.reload();
  await expect(page.getByText("Rel World")).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Rel World" }).click();
  await page.getByRole("button", { name: /Alice/ }).click();
  await expect(page.getByText(/KNOWS/)).toBeVisible({ timeout: 15000 });
});
