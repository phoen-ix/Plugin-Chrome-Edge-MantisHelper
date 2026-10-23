# Screenshots

Every page the extension shows, taken by the docs tour (`e2e/docs/tour.spec.ts`) in headless
Chromium with a fictional Mantis address. Regenerate them with `scripts/docs-screenshots.sh`
(see the main [README](../../README.md#screenshots)).

The context menu entry **Open “…” in Mantis** is part of the browser's own menu, which no
screenshot of a page can show.

## Options: not configured yet

A fresh install: the field is empty and the line below it says what to enter.

<img src="options-empty.png" alt="Mantis Helper Options with an empty Mantis URL field and the hint to enter the address of the Mantis installation" width="800">

## Options: unusable URL

An address without `http://` or `https://` is rejected: the hint stays, and **Save** does not save it.

<img src="options-invalid.png" alt="Mantis Helper Options with mantis.example.com typed in and the hint still shown below the field" width="800">

## Options: saved

After **Save**, the base address has become the issue URL prefix, and the line below shows which
address issue 1234 will open.

<img src="options-saved.png" alt="Mantis Helper Options after saving https://mantis.example.com/: the field shows https://mantis.example.com/view.php?id=, the preview says Issue 1234 will open https://mantis.example.com/view.php?id=1234, and Options saved. is shown" width="800">

## Invalid selection

Opens in a new tab when the selection holds no issue number, or several that are equally likely
(here: “Issues 12 and 34”).

<img src="menu-invalid-selection.png" alt="The Invalid selection page: No single issue number found in the selection" width="737">
