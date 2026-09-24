# Changelog

All notable changes to the "String Utility Belt" extension are documented here.

## 1.3.0

- Initial release, built on String Utility Belt's core engine: 242 of its 246 utilities
  run in the editor (the browser-only ones and custom JavaScript are web-app only).
- `String Utility Belt: Transform Selection…` — pick a utility, optionally customize its
  parameters, and run it on every selection (or the whole document if nothing is selected).
- `String Utility Belt: Repeat Last Transform` — reruns the last utility + params.
- `String Utility Belt: Run Pipeline (share link or JSON)…` — runs a full saved pipeline,
  pasted as a share link/payload or loaded from a `.json` file, over the selection;
  pipelines using a utility the editor can't run are refused with the list.
- `String Utility Belt: Describe Utility…` — opens a markdown doc with a utility's
  parameters and worked examples.
- Keybinding `Ctrl+Alt+U` / `Cmd+Alt+U` for Transform Selection.
