Vendored from private jxamen/jcurve-ota, commit 84bcb919d2870e3a416bc91ac99c3272c7b8c9c5.

This copy lets Actions run without a token for a second private repository.
Keep bin/ota.mjs, package.json and package-lock.json together when updating.
Credentials are supplied through repository Actions secrets, never this directory.
