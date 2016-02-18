
define([
    "js-yaml"
], function (jsyaml) {

    'use strict';

    var JsYamlParser = {};

    function newYamlParseNode(doc, parent, state) {
        return {
            doc: doc,
            parent: parent,
            children: [],

            start: state.position,
        };
    }

    function closeYamlNode(node, state) {
        node.end = state.position;
        node.result = state.result;
    }

    /** returns a YamlParseNode containing { doc, parent, children, start, end, result } */ 
    JsYamlParser.parse = function(input) {
        var rootNode, node;
        var l = function(event, state) {
            if (event === 'open') {
                node = newYamlParseNode(input, node, state);
            } else if (event == 'close') {
                closeYamlNode(node, state);
                if (node.parent) {
                    node.parent.children.push(node);
                    node = node.parent;
                } else {
                    if (rootNode != null) throw 'doc should have only one root node';
                    rootNode = node;
                    node = null;
                }
            }
        };
        var result = jsyaml.safeLoad(input, {listener: l});
        return rootNode;
    };

    return JsYamlParser;
});
