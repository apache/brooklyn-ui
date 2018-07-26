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
import org.apache.commons.codec.binary.Base64;
import org.apache.commons.lang3.StringUtils;
import org.eclipse.jetty.http.HttpHeader;
import org.osgi.service.component.annotations.Activate;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.ConfigurationPolicy;
import org.osgi.service.http.HttpContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.security.auth.Subject;
import javax.security.auth.callback.*;
import javax.security.auth.login.LoginContext;
import javax.security.auth.login.LoginException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import java.io.IOException;
import java.net.URL;
import java.util.Map;

@Component(
        name = "UiProxyHttpContext",
        configurationPid = "org.apache.brooklyn.ui.proxy.security",
        configurationPolicy = ConfigurationPolicy.OPTIONAL,
        immediate = true,
        service = HttpContext.class, property = {"httpContext.id:String=proxy-context", "ui.proxy.security.realm:String=karaf"}
)
public class UiProxyHttpContext implements HttpContext {
    private static final Logger LOG = LoggerFactory.getLogger(UiProxyHttpContext.class);
    private String realm = "webconsole";

    @Override
    public boolean handleSecurity(final HttpServletRequest request, final HttpServletResponse response) throws IOException {
        final HttpSession session = request.getSession(true);
        LOG.info("Handling security for session [{}] in realm [{}]", session.getId(), realm);
        final Optional<String[]> credentials = readCredentials(request.getHeader(HttpHeader.AUTHORIZATION.name()));
        if (credentials.isPresent()) {
            try {
                final LoginContext login = new LoginContext(realm, new UsernamePasswordCallbackHandler(credentials.get()[0], credentials.get()[1]));
                login.login();
                request.setAttribute(HttpContext.AUTHENTICATION_TYPE, "Basic");
                request.setAttribute(HttpContext.REMOTE_USER, credentials.get()[0]);
                final Subject subject = login.getSubject();
                subject.setReadOnly();
                session.setAttribute("javax.security.auth.subject", subject);
                return true;
            } catch (LoginException e) {
                LOG.warn("Login attempt failed for user [{}] on session [{}]", credentials.get()[0], session.getId());
            }
        }
        response.setHeader("WWW-Authenticate", "Basic realm=\"" + realm + "\"");
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Must be authenticated to access this resource");
        return false;
    }

    private Optional<String[]> readCredentials(String header) {
        if (StringUtils.startsWith(header, "Basic")) {
            final String credentials = new String(Base64.decodeBase64(StringUtils.substringAfter(header, "Basic").trim()));
            return Optional.of(credentials.split(":", 2));
        }
        return Optional.absent();
    }

    @Override
    public URL getResource(String name) {
        return null;
    }

    @Override
    public String getMimeType(String name) {
        return null;
    }


    @Activate
    public void activate(final Map<String, String> properties) {
        modified(properties);
    }

    public void modified(final Map<String, String> properties) {
        final String realmFromProperties = properties.get("ui.proxy.security.realm");
        if (StringUtils.isNotEmpty(realmFromProperties)) {
            realm = realmFromProperties;
        }
    }


    private class UsernamePasswordCallbackHandler implements CallbackHandler {
        private final String username;
        private final String password;

        public UsernamePasswordCallbackHandler(String username, String password) {
            this.username = username;
            this.password = password;
        }

        @Override
        public void handle(Callback[] callbacks) throws IOException, UnsupportedCallbackException {
            for (final Callback callback : callbacks) {
                if (callback instanceof NameCallback) {
                    ((NameCallback) callback).setName(username);
                } else if (callback instanceof PasswordCallback) {
                    ((PasswordCallback) callback).setPassword(password.toCharArray());
                }
            }
        }
    }
}
