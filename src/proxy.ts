import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/unauthorized",
  "/api/cron/daily",
]);

const protectedProxy = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) await auth.protect();
});

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (process.env.NODE_ENV !== "production" && process.env.DEMO_MODE === "true") {
    return NextResponse.next();
  }
  return protectedProxy(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|txt|xml|webmanifest)).*)",
    "/(api)(.*)",
  ],
};
