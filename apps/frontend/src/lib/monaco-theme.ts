export const THEME_NAME = "excaliterm-dark";

export const excalitermDarkTheme = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "", foreground: "e0e0e0" },
    { token: "comment", foreground: "6a737d", fontStyle: "italic" },
    { token: "keyword", foreground: "c792ea" },
    { token: "keyword.control", foreground: "c792ea" },
    { token: "string", foreground: "c3e88d" },
    { token: "string.escape", foreground: "89ddff" },
    { token: "number", foreground: "f78c6c" },
    { token: "regexp", foreground: "89ddff" },
    { token: "type", foreground: "ffcb6b" },
    { token: "type.identifier", foreground: "ffcb6b" },
    { token: "delimiter", foreground: "89ddff" },
    { token: "delimiter.bracket", foreground: "bfc7d5" },
    { token: "tag", foreground: "f07178" },
    { token: "attribute.name", foreground: "c792ea" },
    { token: "attribute.value", foreground: "c3e88d" },
    { token: "variable", foreground: "bfc7d5" },
    { token: "variable.predefined", foreground: "82aaff" },
    { token: "constant", foreground: "89ddff" },
    { token: "function", foreground: "82aaff" },
    { token: "operator", foreground: "89ddff" },
    { token: "annotation", foreground: "ffcb6b" },
    { token: "identifier", foreground: "bfc7d5" },
  ],
  colors: {
    // Editor
    "editor.background": "#1a1a24",
    "editor.foreground": "#e0e0e0",
    "editor.lineHighlightBackground": "#22222e",
    "editor.selectionBackground": "#3d3d5c50",
    "editor.inactiveSelectionBackground": "#3d3d5c30",
    "editor.findMatchBackground": "#ffcb6b30",
    "editor.findMatchHighlightBackground": "#ffcb6b20",

    // Editor gutter
    "editorLineNumber.foreground": "#444466",
    "editorLineNumber.activeForeground": "#8888aa",
    "editorGutter.background": "#1a1a24",

    // Cursor
    "editorCursor.foreground": "#89ddff",

    // Editor widgets
    "editorWidget.background": "#1e1e2a",
    "editorWidget.border": "#333355",
    "editorSuggestWidget.background": "#1e1e2a",
    "editorSuggestWidget.border": "#333355",
    "editorSuggestWidget.selectedBackground": "#2d2d44",

    // Scrollbar
    "scrollbar.shadow": "#00000040",
    "scrollbarSlider.background": "#33335540",
    "scrollbarSlider.hoverBackground": "#33335560",
    "scrollbarSlider.activeBackground": "#33335580",

    // Minimap
    "minimap.background": "#1a1a24",

    // Indent guides
    "editorIndentGuide.background": "#2a2a3e",
    "editorIndentGuide.activeBackground": "#444466",

    // Bracket matching
    "editorBracketMatch.background": "#33335540",
    "editorBracketMatch.border": "#89ddff60",

    // Overview ruler
    "editorOverviewRuler.border": "#1a1a24",
  },
};
