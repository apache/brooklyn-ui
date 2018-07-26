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

import com.google.common.base.Stopwatch;
import com.google.common.collect.ImmutableMap;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.testng.annotations.BeforeTest;
import org.testng.annotations.DataProvider;
import org.testng.annotations.Test;

import javax.servlet.http.HttpServletRequest;

import java.util.Map;
import java.util.MissingResourceException;
import java.util.UUID;

import static org.mockito.Mockito.*;
import static org.mockito.BDDMockito.*;
import static org.assertj.core.api.Assertions.*;

/**
 * Created by mark on 22/03/2016.
 */
public class UIProxyTest {

    private static final Logger LOG = LoggerFactory.getLogger(UIProxyTest.class);

    private UiProxy uiProxy;
    private HttpServletRequest mockReq;

    @BeforeTest
    public void setup() {
        uiProxy = new UiProxy();
        mockReq = mock(HttpServletRequest.class);
    }

    @Test(dataProvider = "success")
    public void happyPath(String alias, String target, String reqURI, String reqQueryString) {
        given(mockReq.getRequestURI()).willReturn(alias + reqURI);
        given(mockReq.getQueryString()).willReturn(reqQueryString);
        uiProxy.activate(ImmutableMap.of("alias", alias, "target", target));
        final String result = uiProxy.rewriteTarget(mockReq);
        LOG.info("Rewritten URI [{}]", result);
        assertThat(result).isNotEmpty();
        assertThat(result).startsWith(target);
        if (StringUtils.isNotEmpty(reqQueryString)) {
            assertThat(result).endsWith("?" + reqQueryString);
        } else {
            assertThat(result).endsWith(reqURI);
        }
    }

    @Test(expectedExceptions = MissingResourceException.class, expectedExceptionsMessageRegExp = "The field \\[.*\\] is marked as required")
    public void missingRequiredField() {
        uiProxy.activate(ImmutableMap.of("target", UUID.randomUUID().toString()));
    }

    @DataProvider(name = "success")
    public Object[][] dataProvider() {
        return new Object[][]{
                {"/seg1", "http://example.com", "/some/path", null},
                {"/seg1", "http://example.com", "/some/path", "key1=val1&key2=true"},
                {"/seg1/", "http://example.com/", "some/path", "key1=val1&key2=true"},
                {"/test", "http://example.com/path", "/test/test/test", null},
                {"/seg1/seg2/", "http://example.com/test", "", null}
        };
    }
}
