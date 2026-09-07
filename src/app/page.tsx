import { redirect } from 'next/navigation';

// The app has no marketing landing page — every feature lives under /dashboard
// (which renders its own magic-link sign-in gate for logged-out visitors).
// Send the root route there so localhost:3000 / the deployed root isn't a 404.
export default function Home() {
  redirect('/dashboard');
}
