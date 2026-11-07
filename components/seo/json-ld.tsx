/**
 * A page's JSON-LD. It must be raw script text and Next has no metadata API
 * for it, so a script tag is the documented route. The value is built locally
 * from our own copy; `<` is escaped so a title can never close the tag.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD is raw script text built locally from our own copy, with `<` escaped — see comment above.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}
