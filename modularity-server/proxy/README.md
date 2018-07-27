# Brooklyn UI :: Dumb proxy

## How To Add a Proxy

1. `feature:install brooklyn-ui-proxy`
2. Create config admin PID of the form `org.apache.brooklyn.ui.proxy-myNewProxy`
3. Add the `alias` entry. The alias is the path that the proxy will be exposed on eg alias = /my-proxy will be exposed on http://localhost:8181/my-proxy
4. Add the `target` entry. The target is the proxy destination.

## Add a proxy from the command line
```
karaf@brooklyn()> config:edit org.apache.brooklyn.ui.proxy-myNewProxy
karaf@brooklyn()> config:property-set alias /my-proxy
karaf@brooklyn()> config:property-set target http://localhost:9999/myDatabase
karaf@brooklyn()> config:update
```

## Add a proxy using a cfg file

Create a new cfg file in `<karaf_home/etc/` the file must have the same form as above ie  `org.apache.brooklyn.ui.proxy-myNewProxy.cfg`

Add the two required fields
```
alias = /my-proxy
target = http://localhost:9999/myDatabase
```


## Authenticated Target (Basic)
Add the fields `username` & `password` to the above PID
```
alias = /my-proxy
target = http://localhost:9999/myDatabase
username = admin
password = p@55w0rd
```

## Proxy Authentication

All created proxies use a default httpContext `proxy-context` this can be overridden by setting the field `httpContext.id`

By default the `UiProxyHttpContext` uses the `karaf` realm this can be configured by adding the PID `org.apache.brooklyn.ui.proxy.security/ui.proxy.security.realm`

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
