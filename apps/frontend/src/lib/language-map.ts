const extensionToLanguage: Record<string, string> = {
  // JavaScript / TypeScript
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".ts": "typescript",
  ".tsx": "typescriptreact",
  ".mts": "typescript",
  ".cts": "typescript",

  // Web
  ".html": "html",
  ".htm": "html",
  ".css": "css",
  ".scss": "scss",
  ".less": "less",
  ".svg": "xml",

  // Data / Config
  ".json": "json",
  ".jsonc": "json",
  ".xml": "xml",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "ini",
  ".ini": "ini",
  ".env": "ini",
  ".properties": "ini",

  // Markup / Docs
  ".md": "markdown",
  ".mdx": "markdown",
  ".txt": "plaintext",
  ".log": "plaintext",

  // C# / .NET
  ".cs": "csharp",
  ".csx": "csharp",
  ".csproj": "xml",
  ".sln": "plaintext",
  ".razor": "razor",

  // Python
  ".py": "python",
  ".pyi": "python",
  ".pyw": "python",

  // Shell
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
  ".fish": "shell",
  ".ps1": "powershell",
  ".psm1": "powershell",
  ".bat": "bat",
  ".cmd": "bat",

  // Go
  ".go": "go",

  // Rust
  ".rs": "rust",

  // Java / Kotlin
  ".java": "java",
  ".kt": "kotlin",
  ".kts": "kotlin",

  // C / C++
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".hpp": "cpp",
  ".cc": "cpp",

  // Ruby
  ".rb": "ruby",

  // PHP
  ".php": "php",

  // SQL
  ".sql": "sql",

  // Docker
  ".dockerfile": "dockerfile",

  // GraphQL
  ".graphql": "graphql",
  ".gql": "graphql",

  // Misc
  ".lua": "lua",
  ".r": "r",
  ".swift": "swift",
  ".dart": "dart",
};

// Files without extensions that map to specific languages
const filenameToLanguage: Record<string, string> = {
  Dockerfile: "dockerfile",
  Makefile: "makefile",
  Jenkinsfile: "groovy",
  Vagrantfile: "ruby",
  Gemfile: "ruby",
  Rakefile: "ruby",
  ".gitignore": "ini",
  ".dockerignore": "ini",
  ".editorconfig": "ini",
  ".eslintrc": "json",
  ".prettierrc": "json",
};

export function getLanguageFromPath(filePath: string): string {
  const fileName = filePath.split(/[/\\]/).pop() ?? "";

  // Check exact filename match first
  if (filenameToLanguage[fileName]) {
    return filenameToLanguage[fileName];
  }

  // Check extension
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot >= 0) {
    const ext = fileName.slice(lastDot).toLowerCase();
    return extensionToLanguage[ext] ?? "plaintext";
  }

  return "plaintext";
}
