// Avatar URLs a user could write into their own auth metadata, each of which
// must come out of every avatar projection as null. Shared by the projection
// tests so every site is held to the same list.
export const HOSTILE_AVATAR_URLS: Record<string, string> = {
  'plain http': 'http://lh3.googleusercontent.com/a/x',
  'another host': 'https://images.example.com/t.png?u=1',
  'a lookalike host': 'https://lh3.googleusercontent.com.example.com/a/x',
  'the bare Google domain': 'https://googleusercontent.com/a/x',
  userinfo: 'https://user:pw@lh3.googleusercontent.com/a/x',
  'an explicit port': 'https://lh3.googleusercontent.com:8443/a/x',
  overlong: `https://lh3.googleusercontent.com/${'a'.repeat(2048)}`,
  'javascript:': 'javascript:alert(1)',
  'data:': 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
  'protocol-relative': '//lh3.googleusercontent.com/a/x',
  'not a URL': 'lh3.googleusercontent.com/a/x',
};

export const GOOGLE_PICTURE = 'https://lh3.googleusercontent.com/a/dummy=s96-c';
export const OWN_AVATAR_BASE = 'https://media.example.com';
export const OWN_AVATAR_URL = `${OWN_AVATAR_BASE}/u1/photo.webp`;
