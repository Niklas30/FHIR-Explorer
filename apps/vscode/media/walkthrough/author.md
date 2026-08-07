## Write profiles and instances

Use the **+** next to a category in the FHIR Explorer view, or run
**New Resource**.

For an example instance you pick the profile it conforms to first — your own
profiles, then the ones your dependencies bring, then the base FHIR resources.
That is what makes the form and the validator work against *your* constraints
instead of the bare specification.

**Open in FHIR Form Editor** renders any resource as a profile-driven form. The
file stays the source of truth: undo, dirty state and *Reopen with… Text
Editor* behave exactly as they do anywhere else, and a split view keeps the
JSON alongside.
