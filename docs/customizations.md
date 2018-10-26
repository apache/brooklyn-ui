
The UI is designed so modules can be used individually, or added as library modules in the usual NodeJS manner 
and widgets cherry-picked as needed.

There are a number of points where UI default choices can be overridden:

* Actions on Composer: by changing the config value for `'actionServiceProvider'` from `ui-modules/blueprint-composer/app/index.js`,
  a different set of actions can be displayed on the composer screen

* Composer - Virtual palette items and alternate catalog endpoints:  by registering a different `blueprintServiceProvider`
  items for the palette can come from Brooklyn and/or other sources, with other sources converted to "virtual items" that
  can extend existing Brooklyn items

* Composer - Custom Config Widgets: special widgets to use for config keys can be specified in a registered type's
  definition as a map tag, for example for the demo widget `suggestion-dropout` included we might have 
      '{ ui-composer-hints: { config-widgets: [ { 
         key: start.timeout, suggestion-values: [ 30s, 2m, 5m, 30m, 2h, { value: forever, description: 'No timeout' ],
         widget: suggestion-dropdown, label-collapsed: fail after, label-expanded: Fail if not successful within } ] } }`
  (as shown in the accompanying `vanillia-with-custom-widget.bom`);
  widgets should be registered as angular directives using the standard Angular naming conventions 
  (e.g. suggestionDropdownDirective), as done for that directive in app/index.js and app/index.less.

* Composer - Identify entities and other items to be preselected when "Recent" is applied by adding a tag of the form
  `{ ui-composer-recent-preselect: 100 }` (where the number `100` determines its sort order)

<!--
  Licensed to the Apache Software Foundation (ASF) under one
  or more contributor license agreements.  See the NOTICE file
  distributed with this work for additional information
  regarding copyright ownership.  The ASF licenses this file
  to you under the Apache License, Version 2.0 (the
  "License"); you may not use this file except in compliance
  with the License.  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing,
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
  KIND, either express or implied.  See the License for the
  specific language governing permissions and limitations
  under the License.
-->
