# Evidence — search/filter the excluded studies list (#1473)

Evidence for [neurostuff/neurostore#1473](https://github.com/neurostuff/neurostore/issues/1473).
The excluded-studies view (new curation interface) had no way to search. This adds a search box
that filters the list (and its keyboard-nav / selection) by title, authors, journal, year,
keywords, pmid, and doi. Verified live on the full local stack with 4 imported studies excluded
under one reason.

| | View |
|---|---|
| **before** | Exclude view, no search box, all 3 excluded studies |
| **after** | search box added; typing `reward` narrows to the matching study |

## before
![before](./before.png)

## after
![after](./after.png)
