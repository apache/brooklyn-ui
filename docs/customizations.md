
The UI is designed so modules can be used individually, or added as library modules in the usual NodeJS manner 
and widgets cherry-picked as needed.

There are a number of points where UI default choices can be overridden:

* Actions on Composer: by changing the config value for `'actionServiceProvider'` in `ui-modules/blueprint-composer/app/index.js`,
  a different set of actions can be displayed on the composer screen

* Composer - Virtual palette items and alternate catalog endpoints:  by registering a different `blueprintServiceProvider`
  items for the palette can come from Brooklyn and/or other sources, with other sources converted to "virtual items" that
  can extend existing Brooklyn items

* Composer - Custom Config Widgets: special widgets to use for config keys can be specified in a registered type's
  definition as a map tag, for example for the demo widget `suggestion-dropout` included we might have:
      '{ ui-composer-hints: { config-widgets: [ { key: start.timeout, suggestion-values: [ 30s, 2m, 5m, 30m, 2h ],
         widget: suggestion-dropdown, label-collapsed: fail after, label-expanded: Fail if not successful within } ] } }`;
  widgets should be registered as angular directives using the standard naming conventions (e.g. suggestionDropdownDirective),
  as done for that directive in app/index.js and app/index.less.


