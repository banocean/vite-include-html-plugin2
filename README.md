# vite-plugin-include

Vite plugin to inline HTML partials recursively with `<include src="..." />`.

## Config

```javascript
import { defineConfig } from "vite";
import includeHtml from "vite-plugin-include";

export default defineConfig({
  plugins: [includeHtml()],
});
```

## Usage

```html
<!-- Relative to current file -->
<include src="header.html" />
<include src="./partials/nav.html"></include>

<!-- Relative to vite project root -->
<include src="/partials/footer.html" />
```

# Features

- Recursive includes are supported, so you can include files that themselves include other files.
- Relative paths and absolute paths are supported (absolute point to vite project root).
- Simple, short and lightweight, with no dependencies.

## License

Licensed under the [MIT License](LICENSE).
