# UI menu redesign / no-overlap fix

This patch replaces the crowded top tab row with a stable workspace selector and compact tool groups.

## Changes

- Main workspace navigation is now a dropdown selector.
- Quick PCB actions are grouped into two compact tool groups.
- Header wraps cleanly on smaller screens instead of overlapping buttons.
- Left tools and right inspector can still be hidden.
- Canvas height is recalculated for the new header.
- Old overflowing `.main-tabs` and `.quick-tool-strip` are hidden.

No Node, Electron, server, package or config files are changed.
