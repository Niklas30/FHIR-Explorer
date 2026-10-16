## A project is a folder, not a database row

Your resources are ordinary `.json` files in the IG Publisher layout, so git,
the file explorer, the IG Publisher and Sushi all keep working on them.

**Create FHIR Project** opens a form: package id, version, canonical URL and
the dependencies to start with. It writes a `package.json` and the `input/`
directories, then installs what you ticked.

Already have an IG repo? Just open it. A folder with a `sushi-config.yaml`, an
`ig.ini` or a FHIR `package.json` is recognised as-is — nothing to convert.
