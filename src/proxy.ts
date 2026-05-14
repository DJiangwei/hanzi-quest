import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Routes that must remain accessible without a Clerk session.
// /api/webhooks/* is hit by Clerk itself with svix-signed payloads, not a session.
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect({
      unauthenticatedUrl: new URL('/sign-in', req.url).toString(),
    });
  }
});

export const config = {
  matcher: [
    // Skip Next internals and common static assets
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run on API and trpc paths
    '/(api|trpc)(.*)',
  ],
};
