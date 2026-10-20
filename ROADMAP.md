# RoomWeave: development plan

Estimated future effort: **68–100 hours**. These milestones are proposed, not implemented or approved paid work. Reassess scope after practical use.

## 1. Snapping, guides and multi-selection — 16–24 hours

Implement consistent world-coordinate snapping, alignment guides and grouped moves at every zoom. Undo one gesture as one operation; cancel without partial changes.

Definition of done: documented behavior, regression tests, matched before/after UI evidence where visible, valid import/export, and preservation of current undo and storage behavior.

## 2. Rotation and constrained geometry — 16–22 hours

Add rotated objects, oriented collision checks and polygonal rooms with explicit units. Preserve old imports and keep rendering and geometry validation in agreement.

Definition of done: documented behavior, regression tests, matched before/after UI evidence where visible, valid import/export, and preservation of current undo and storage behavior.

## 3. Viewport and gesture behavior — 12–18 hours

Add pan, pinch, resize-during-drag handling and nested scroll controls. Verify pointer capture, cancellation and coordinate stability.

Definition of done: documented behavior, regression tests, matched before/after UI evidence where visible, valid import/export, and preservation of current undo and storage behavior.

## 4. Inspector and accessible navigation — 12–18 hours

Add numeric multi-edit, object grouping, keyboard spatial navigation and focus recovery after deletion. Keep measurements readable at narrow widths.

Definition of done: documented behavior, regression tests, matched before/after UI evidence where visible, valid import/export, and preservation of current undo and storage behavior.

## 5. Print, persistence and release — 12–18 hours

Add measured paginated printouts, draft recovery, robust import diagnostics and multi-browser/device validation.

Definition of done: documented behavior, regression tests, matched before/after UI evidence where visible, valid import/export, and preservation of current undo and storage behavior.

## Suggested first session

Implement snapping and alignment guides at every zoom, with pointer cancellation and keyboard-equivalent moves. Verify exported geometry after undo and reload.

## Delivery order

Freeze the user-visible requirement and a passing control before implementation. Finish one bounded feature at a time; do not combine all milestones into one evaluation prompt. Record implemented behavior and remaining limitations in the README after each release.
