# Extraction fixtures

`constitution.items.json` — the `TextItem[]` pdf.js produced for the first 20
pages of *The Constitution of the United States of America, As Amended* (House
Document 110-50), downloaded from
https://www.govinfo.gov/content/pkg/CDOC-110hdoc50/pdf/CDOC-110hdoc50.pdf.
It is a work of the U.S. Government, so it is in the public domain, and it is
born-digital rather than scanned — real typography, columns, footnotes and
running headers, which is what makes it worth regressing against.

The items were produced by running the shipped extractor page
(`src/extraction/extractorHtml.ts`) against the PDF, so the fixture cannot drift
away from the code that runs on the device. Regenerating requires only the PDF;
see `__tests__/extraction.fixture.test.ts` for what it guards.
