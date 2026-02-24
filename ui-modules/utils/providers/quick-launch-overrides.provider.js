/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import angular from 'angular';
import yaml from 'js-yaml';

const MODULE_NAME = 'brooklyn.quick-launch-overrides-service';

angular.module(MODULE_NAME, [])
    .provider('quickLaunchOverrides', quickLaunchOverridesProvider);

export default MODULE_NAME;

// visible for testing
export function quickLaunchOverridesProvider() {
    // callers can do angular.config(['quickLaunchOverridesProvider', function (provider) { provider.add({ ... }) })
    // to set various configuration. to see what configuration is supported, grep for quickLaunchOverrides in this project.
    var methods = {
        convertPlanFromOriginalFormat: plan => plan,
        convertPlanToPreferredFormat: plan => plan,
    }
    methods.actor = methods;
    methods.getAsCampPlan = async (plan)=>{
        let campPlanYaml;
        let campPlanModified = false;
        try {
            campPlanYaml = (await methods.actor.convertPlanFromOriginalFormat(plan)).data;
            campPlanModified = plan.data != campPlanYaml;
        } catch (error) {
            console.warn("Unable to restore CAMP format", error, plan);
            campPlanYaml = plan.data;
        }
        let parsedPlan = null;
        try {
            parsedPlan = yaml.safeLoad(campPlanYaml);
        } catch (e) {
            console.log('Failed to parse YAML', e)
        }
        return { campPlanModified, campPlanYaml, parsedPlan };
    };
    const result = {}

    result.configureQuickLaunchOverride = () => {}
    result.configureQuickLaunch = (quickLaunch, scope, httpCaller) => {
        methods.actor = quickLaunch;
        Object.assign(quickLaunch, methods);
        result.configureQuickLaunchOverride(quickLaunch, scope, httpCaller);
    }

    return {
        $get: () => result,
        add: (props) => angular.extend(result, props),
    };
}
