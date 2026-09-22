"""
Fills the site's endpoint constants in from the environment, at deploy time.

    python3 scripts/fillEndpoints.py site/index.html EARLY_ACCESS_ENDPOINT ...

Neither value is a secret in the sense of a password: the browser has to POST
to one and open the other, so both end up visible in the served page, and no
amount of build-time cleverness changes that about a static site. Keeping them
out of the repository keeps them out of git history and out of search results
for the source, which is worth having on its own.

A name with nothing in the environment is left alone, and the page keeps its
fallback -- the form opens a mail client, and the beta line stays hidden.
"""
import io
import os
import sys

# Anything that could end the JavaScript string it is dropped into, and so
# turn a deployment secret into script running on the page.
FORBIDDEN = ("'", '"', '\\', '\n', '\r', '<')


def main(argv):
    if len(argv) < 3:
        print(__doc__.strip())
        return 2

    path, names = argv[1], argv[2:]
    page = io.open(path, encoding='utf-8').read()

    for name in names:
        value = (os.environ.get(name) or '').strip()
        placeholder = "var %s = '';" % name

        if placeholder not in page:
            # Renaming the constant without updating this would otherwise
            # deploy a page that silently keeps its fallback for ever.
            print('%s: no placeholder in %s' % (name, path), file=sys.stderr)
            return 1

        if not value:
            print('%s: not set, leaving the fallback in place' % name)
            continue

        bad = [c for c in FORBIDDEN if c in value]
        if bad:
            print('%s: rejected, contains %r' % (name, bad[0]), file=sys.stderr)
            return 1

        page = page.replace(placeholder, "var %s = '%s';" % (name, value), 1)
        print('%s: filled in (%d characters)' % (name, len(value)))

    io.open(path, 'w', encoding='utf-8', newline='').write(page)
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv))
