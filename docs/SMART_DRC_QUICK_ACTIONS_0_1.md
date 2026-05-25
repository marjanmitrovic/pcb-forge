# Smart DRC Quick Actions 0.1

This patch adds quick-action metadata and UI buttons to DRC issues.

The DRC panel now supports optional callbacks:

- `onSelectIssueTarget(issue)`
- `onApplyQuickFix(issue, action)`

If these callbacks are not passed from `App.tsx`, the panel still builds and shows helpful alerts instead of changing the board.

Recommended next integration in App:

1. Select target object by `issue.targetType` and `issue.targetId`.
2. Apply safe fixes:
   - increase trace width
   - increase via size
   - delete invalid trace/via
   - move component inward
   - open DRC rules panel
3. Rerun DRC after every applied fix.

This patch does not touch package.json, Electron, server, Vite or Node settings.
