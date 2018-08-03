
The UI is designed so modules can be used individually, or added as library modules in the usual NodeJS manner 
and widgets cherry-picked as needed.

There are a number of points where UI default choices can be overridden:

* Actions on Composer: by changing the config value for `'actionServiceProvider'` in `ui-modules/blueprint-composer/app/index.js`,
  a different set of actions can be displayed on the composer screen

* Composer - Virtual palette items and alternate catalog endpoints:  by registering a different `blueprintServiceProvider`
  items for the palette can come from Brooklyn and/or other sources, with other sources converted to "virtual items" that
  can extend existing Brooklyn items

