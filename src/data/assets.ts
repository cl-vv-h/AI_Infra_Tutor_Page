// Eagerly import supported learning assets under content/ as URLs.
// Builds a filename -> URL map so relative paths like `./assets/foo.svg`
// in markdown can be rewritten to resolvable URLs at render time.

const assetModules = import.meta.glob('./content/**/*.{svg,png,jpg,jpeg,webp,gif}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

// Map from filename to URL. Filenames are unique across the content tree.
const assetUrlByFilename: Record<string, string> = {}
for (const [path, url] of Object.entries(assetModules)) {
  const filename = path.split('/').pop()!
  if (!assetUrlByFilename[filename]) {
    assetUrlByFilename[filename] = url
  }
}

export function resolveAssetPath(src: string): string {
  if (!src) return src
  if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('/')) {
    return src
  }
  const filename = src.split('/').pop()!
  return assetUrlByFilename[filename] ?? src
}

/**
 * Rewrite relative image paths in markdown to resolvable URLs.
 * Handles both `![alt](./assets/x.svg)` and `<img src="./assets/x.svg">` forms.
 */
export function rewriteImagePaths(markdown: string): string {
  if (!markdown) return markdown
  return markdown
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, src) => {
      const resolved = resolveAssetPath(src.trim())
      return `![${alt}](${resolved})`
    })
    .replace(/<img([^>]+)src="(?!data:|https?:|\/)([^"]+)"/g, (_match, prefix, src) => {
      const resolved = resolveAssetPath(src.trim())
      return `<img${prefix}src="${resolved}"`
    })
}
