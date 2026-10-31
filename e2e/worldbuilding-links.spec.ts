import { test, expect } from "@playwright/test";

test("worldbuilding document link", async ({ page, request }) => {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  const reg = await request.post("http://127.0.0.1:4000/auth/register", {
    data: { email, displayName: "E2E User", password: "Password1", confirmPassword: "Password1" },
  });
  expect(reg.ok()).toBeTruthy();

  const loginRes = await request.post("http://127.0.0.1:4000/auth/login", {
    data: { email, password: "Password1" },
  });
  expect(loginRes.ok()).toBeTruthy();

  const projectRes = await request.post("http://127.0.0.1:4000/api/v1/projects", {
    data: { title: "Link Project" },
  });
  expect(projectRes.ok()).toBeTruthy();
  const project = (await projectRes.json()).data.project;
  const docRes = await request.post(
    `http://127.0.0.1:4000/api/v1/projects/${project.id}/documents`,
    {
      data: { title: "Linked Doc", kind: "SCENE", parentId: null, position: 0 },
    },
  );
  expect(docRes.ok()).toBeTruthy();
  const doc = (await docRes.json()).data.document;

  await page.goto("/#login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.getByRole("heading", { name: "Sanctuary", exact: true })).toBeVisible({
    timeout: 15000,
  });

  await page.goto("/?x=" + Date.now() + "#worlds");
  await page.getByRole("button", { name: /new world/i }).click();
  await page.getByLabel(/name/i).fill("Link World");
  await page.getByRole("button", { name: /create world/i }).click();
  await expect(page.getByText("Link World")).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "Link World" }).click();

  const worldsRes = await request.get("http://127.0.0.1:4000/api/v1/worlds");
  const worlds = (await worldsRes.json()).data.worlds as Array<{ id: string; name: string }>;
  const world = worlds.find((item) => item.name === "Link World");
  if (world) {
    await request.post(`http://127.0.0.1:4000/api/v1/projects/${project.id}/worlds/${world.id}`);
  }

  await page.getByRole("button", { name: /new entry/i }).click();
  await page.getByLabel(/name/i).fill("Alice");
  await page.getByRole("button", { name: /create entry/i }).click();
  await expect(page.getByText(/Alice/)).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: /Alice/ }).click();
  await page.getByLabel(/document id/i).fill(doc.id);
  await page.getByRole("button", { name: /link document/i }).click();
  await expect(page.getByText("Linked Doc").first()).toBeVisible({ timeout: 15000 });

  // Reload and verify persistence.
  await page.reload();
  await expect(page.getByText("Link World")).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Link World" }).click();
  await page.getByRole("button", { name: /Alice/ }).click();
  await expect(page.getByText("Linked Doc").first()).toBeVisible({ timeout: 15000 });
});

test("cross-account worldbuilding isolation", async ({ page, request }) => {
  const email1 = `e2e-a-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  const email2 = `e2e-b-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;

  await request.post("http://127.0.0.1:4000/auth/register", {
    data: {
      email: email1,
      displayName: "User A",
      password: "Password1",
      confirmPassword: "Password1",
    },
  });
  const login1 = await request.post("http://127.0.0.1:4000/auth/login", {
    data: { email: email1, password: "Password1" },
  });
  expect(login1.ok()).toBeTruthy();

  const worldRes = await request.post("http://127.0.0.1:4000/api/v1/worlds", {
    data: { name: "Private World", description: "secret" },
  });
  expect(worldRes.ok()).toBeTruthy();

  await request.post("http://127.0.0.1:4000/auth/register", {
    data: {
      email: email2,
      displayName: "User B",
      password: "Password1",
      confirmPassword: "Password1",
    },
  });

  await page.goto("/#login");
  await page.getByLabel(/email/i).fill(email2);
  await page.getByLabel(/password/i).fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.getByRole("heading", { name: "Sanctuary", exact: true })).toBeVisible({
    timeout: 15000,
  });

  await page.goto("/?x=" + Date.now() + "#worlds");
  await expect(page.getByText("Private World")).not.toBeVisible({ timeout: 5000 });
});
