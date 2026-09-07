/** Dashboard content is private financial information, never a search result. */
export default function Head() {
  return <meta name="robots" content="noindex, nofollow, noarchive" />;
}
