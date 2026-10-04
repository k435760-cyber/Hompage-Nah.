import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const root = import.meta.dirname;
const school = JSON.parse(readFileSync(resolve(root, 'src/school.json'), 'utf8'));
const pages = ['index', 'about', 'notice', 'news', 'meals', 'login'];

// HTML 안의 %SCHOOL_NAME% 같은 자리표시자를 school.json 값으로 채웁니다.
const schoolHtml = {
  name: 'school-html',
  transformIndexHtml: (html) =>
    html
      .replaceAll('%SCHOOL_NAME%', school.name)
      .replaceAll('%SCHOOL_MOTTO%', school.motto),
};

export default defineConfig({
  plugins: [schoolHtml],
  build: {
    rollupOptions: {
      input: Object.fromEntries(pages.map((p) => [p, resolve(root, `${p}.html`)])),
    },
  },
});
