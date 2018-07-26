This builds a KAR archive for simplified installation into a Karaf container (Brooklyn).
Simply copy the resulting `target/*.kar` file to the `deploy/` folder of Brooklyn.
Alternatively in a Karaf shell, run `kar:install URL` pointing at the KAR.

(All the above assume `noAutoRefreshBundles=true` is set in `etc/org.apache.karaf.kar.cfg`.)

The file can be copied to `deploy/` prior to launch, with the result ZIPped up again to 
make a redistributable Brooklyn bundle containing preferred branding. If using RPM or DEB
you may need to make an additional package or step to install this KAR file.)

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
