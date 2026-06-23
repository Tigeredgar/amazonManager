import { expect, test } from "@playwright/test";

test("dashboard presents deadlines and item-level workflows", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Decide before the window closes/i })).toBeVisible();
  await expect(page.getByText("Portable rechargeable handheld fan", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: /Plan return/i }).first()).toBeVisible();
  await expect(page.getByText("7d left")).toBeVisible();
});

test("dashboard adapts to a mobile viewport", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
  await expect(page.getByText("Needs attention").first()).toBeVisible();
});
