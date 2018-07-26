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
package org.apache.brooklyn.ui.proxy;

import com.google.common.base.Optional;
import com.google.common.base.Stopwatch;
import com.google.common.collect.ImmutableMap;
import org.apache.commons.codec.binary.Base64;
import org.apache.commons.lang3.StringUtils;
import org.eclipse.jetty.client.api.Request;
import org.eclipse.jetty.client.api.Response;
import org.eclipse.jetty.http.HttpHeader;
import org.eclipse.jetty.proxy.ProxyServlet;
import org.osgi.service.component.annotations.*;
import org.osgi.service.event.Event;
import org.osgi.service.event.EventAdmin;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.servlet.Servlet;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import java.util.MissingResourceException;
import java.util.concurrent.TimeUnit;

@Component(
        name = "UiProxy",
        configurationPid = "org.apache.brooklyn.ui.proxy",
        configurationPolicy = ConfigurationPolicy.REQUIRE,
        service = Servlet.class,
        property = {"httpContext.id:String=proxy-context"}
)
public class UiProxy extends ProxyServlet {

    private static final Logger LOG = LoggerFactory.getLogger(UiProxy.class);
    private static final String SERVICE_PID = "service.pid";
    private static final String ALIAS = "alias";
    private static final String TARGET = "target";
    private static final String USERNAME = "username";
    private static final String PASSWORD = "password";
    private static final String METRICS_TOPIC = "decanter/collect/brooklyn-ui/ui-proxy";

    @Reference
    private EventAdmin eventAdmin;

    private String alias;
    private String target;
    private Boolean useAuthentication = Boolean.FALSE;
    private String authHeader;
    private String proxyId;

    @Override
    protected void service(final HttpServletRequest request,
                           final HttpServletResponse response) throws ServletException, IOException {
        final Stopwatch sw = Stopwatch.createStarted();
        super.service(request, response);
        sw.stop();
        eventAdmin.postEvent(new Event(METRICS_TOPIC, ImmutableMap.of(
                "id", proxyId,
                "type", "ui-proxy::remote-latency",
                "alias", alias,
                "target", target,
                "remote-latency", sw.toString()
        )));
    }

    @Override
    protected String rewriteTarget(final HttpServletRequest clientRequest) {
        final StringBuffer sb = new StringBuffer(target);
        sb.append(StringUtils.removeStart(clientRequest.getRequestURI(), alias));
        if (StringUtils.isNotEmpty(clientRequest.getQueryString())) {
            sb.append("?").append(clientRequest.getQueryString());
        }
        return sb.toString();
    }

    @Override
    protected void addProxyHeaders(HttpServletRequest clientRequest, Request proxyRequest) {
        super.addProxyHeaders(clientRequest, proxyRequest);
        if (useAuthentication) {
            proxyRequest.getHeaders().remove(HttpHeader.AUTHORIZATION);
            proxyRequest.header(HttpHeader.AUTHORIZATION, authHeader);
        }
    }

    @Override
    protected void onProxyResponseSuccess(final HttpServletRequest clientRequest,
                                          final HttpServletResponse proxyResponse, final Response serverResponse) {
        super.onProxyResponseSuccess(clientRequest, proxyResponse, serverResponse);
        eventAdmin.postEvent(new Event(METRICS_TOPIC, ImmutableMap.of(
                "id", proxyId,
                "type", "ui-proxy::response",
                "alias", alias,
                "target", target,
                "status", serverResponse.getStatus()
        )));
    }

    @Activate
    public void activate(final Map<String, String> properties) {
        LOG.info("Creating new proxy instance :: [{}]", properties.get(SERVICE_PID));
        modified(properties);
    }

    @Modified
    public void modified(final Map<String, String> properties) {
        proxyId = getFromProperties(properties, SERVICE_PID, false, "");
        alias = getFromProperties(properties, ALIAS, true, "");
        target = getFromProperties(properties, TARGET, true, "");

        if (properties.containsKey(USERNAME) && properties.containsKey(PASSWORD)) {
            useAuthentication = Boolean.TRUE;
            authHeader = generateAuthHeader(properties.get(USERNAME), properties.get(PASSWORD));
        } else {
            useAuthentication = Boolean.FALSE;
        }
        LOG.info("Updating proxy [{}] :: Proxy [{}] -> [{}], Authenticated [{}]", proxyId, alias, target, useAuthentication);
    }


    @Deactivate
    public void deactivate() {
        LOG.info("Destroying proxy [{}] :: Proxy [{}] -> [{}], Authenticated [{}]", proxyId, alias, target, useAuthentication);
        destroy();
    }

    private String getFromProperties(final Map<String, String> properties, final String key, final Boolean required, final String defaultValue) {
        Optional<String> result = Optional.fromNullable(properties.get(key));
        if (required && !result.isPresent()) {
            throw new MissingResourceException("The field [" + key + "] is marked as required", UiProxy.class.getName(), key);
        }
        return result.or(defaultValue);
    }

    private String generateAuthHeader(final String username, final String password) {
        return "Basic " + new String(Base64.encodeBase64((username + ":" + password).getBytes()));
    }

    private String clean(final String path) {
        if (StringUtils.endsWith(path, "/")) {
            return path.substring(0, path.length() - 1);
        } else {
            return path;
        }
    }

    public EventAdmin getEventAdmin() {
        return eventAdmin;
    }

    public void setEventAdmin(EventAdmin eventAdmin) {
        this.eventAdmin = eventAdmin;
    }
}
