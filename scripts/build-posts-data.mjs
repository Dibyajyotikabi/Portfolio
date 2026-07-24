import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const root = process.cwd();
const contentDir = path.join(root, 'content/blog');
const outputFile = path.join(root, 'src/generated/posts.json');

function slugFromPath(filePath) {
  return filePath.split('/').pop().replace(/\.md$/, '');
}

function readPosts() {
  if (!fs.existsSync(contentDir)) return [];

  return fs
    .readdirSync(contentDir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const filePath = path.join(contentDir, file);
      const raw = fs.readFileSync(filePath, 'utf8');
      const { data, content } = matter(raw);
      const slug = data.slug || slugFromPath(file);

      return {
        slug,
        title: data.title || slug,
        description: data.description || '',
        date: data.date || '',
        modified: data.modified || data.date || '',
        image: data.image || '',
        tags: Array.isArray(data.tags) ? data.tags : [],
        draft: Boolean(data.draft),
        content: content.trim(),
      };
    });
}

function main() {
  const posts = readPosts();
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(posts, null, 2)}\n`);
  console.log(`Generated ${posts.length} post(s) for the client bundle.`);
}

main();
