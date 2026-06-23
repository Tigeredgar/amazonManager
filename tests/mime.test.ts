import { describe, expect, it } from "vitest";

import { extractMessageBody, getHeader } from "@/lib/gmail/mime";

const encode = (value: string) => Buffer.from(value).toString("base64url");

describe("Gmail MIME extraction", () => {
  it("prefers plain text and reads case-insensitive headers", () => {
    const payload = {
      mimeType: "multipart/alternative",
      headers: [{ name: "Subject", value: "Delivered: Item" }],
      parts: [
        { mimeType: "text/plain", body: { data: encode("plain order body") } },
        { mimeType: "text/html", body: { data: encode("<p>html order body</p>") } },
      ],
    };
    expect(extractMessageBody(payload)).toBe("plain order body");
    expect(getHeader(payload, "subject")).toBe("Delivered: Item");
  });

  it("converts HTML without retaining image tags", () => {
    const payload = {
      mimeType: "text/html",
      body: { data: encode('<p>Order body</p><img src="https://tracker.example/pixel">') },
    };
    expect(extractMessageBody(payload)).toContain("Order body");
    expect(extractMessageBody(payload)).not.toContain("tracker.example");
  });
});
