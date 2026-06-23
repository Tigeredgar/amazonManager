import "server-only";

import { currentUser } from "@clerk/nextjs/server";

import { allowedEmails, isDemoMode } from "@/lib/env";

export type AppUser = {
  id: string;
  email: string;
  firstName: string | null;
  demo: boolean;
};

export async function getAllowedUser(): Promise<AppUser | null> {
  if (isDemoMode()) {
    return {
      id: "demo-user",
      email: "demo@example.com",
      firstName: "Demo",
      demo: true,
    };
  }

  const user = await currentUser();
  if (!user) return null;

  const primaryEmail = user.emailAddresses.find(
    ({ id }) => id === user.primaryEmailAddressId,
  )?.emailAddress;
  const email = primaryEmail?.trim().toLowerCase();
  if (!email || !allowedEmails().includes(email)) return null;

  return {
    id: user.id,
    email,
    firstName: user.firstName,
    demo: false,
  };
}

export async function requireAllowedUser() {
  const user = await getAllowedUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
