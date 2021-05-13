# Brooklyn UI login page

This page is intended as an optional replacement for the browser dependant
login popup.  It has the same functionality using a static login form.

This can be enabled by add the following to etc/brooklyn.cfg:

```
brooklyn.webconsole.security.unauthenticated.endpoints=brooklyn-ui-login
brooklyn.webconsole.security.login.form=brooklyn-ui-login
```