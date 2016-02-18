
define([
    "backbone", "js-yaml-parser", "underscore"
], function (Backbone, JsYamlParser, _) {

    var BrooklynYamlCompletionProposals = {};

    var Catalog = Backbone.Collection.extend({
        initialize: function(models, options) {
            this.name = options["name"];
            var that = this; 
            var model = this.model.extend({
              url: function() {
                return "/v1/" + that.name + "/" + this.id.split(":").join("/");
              }
            });
            _.bindAll(this);
            this.model = model;
        },
        url: function() {
            return "/v1/" + this.name;
        }
    });
    // currently populates catalog on startup, then refreshes on each search
    // (but only renders later)
    // ideally should be shared model refreshed periodically in background
    var catalogE = new Catalog(undefined, { name: "catalog/entities" });
    var catalogA = new Catalog(undefined, { name: "catalog/applications" });
    var catalogL = new Catalog(undefined, { name: "locations" });
    // if browser opened while server is starting this will fail on first completion
    catalogA.fetch();
    catalogE.fetch();
    catalogL.fetch();

    function findParseNodeAt(parse, position) {
      if (parse.start<=position && parse.end>=position) {
        for (var ci in parse.children) {
          var c = parse.children[ci];
          var result = findParseNodeAt(c, position);
          if (result) return result;
        }
        return parse;
      }
      return null;
    }
    
    /** adds additional fields to a parse node:
     *  * type: map, list, primitive, null
     *  * role: key, value, entry, root; or primitive if we are a primitive in a primitive (due to how it is parsed) 
     *  * key: if we are role 'value', what is our key
     *  * index: if parent is map or list, what is our position in that as a list
     *  and returns a list of the containing parse nodes, root first
     */
    function findContexts(n, position) {
        if (!n || n.role) return;
        
        if (n.result === null) {
            n.type = 'null';
        } else if (n.kind == 'sequence') {
            if (typeof n.result.length === 'undefined') {
                console.log("WARN: mismatch expected list but had no length", n);
            }
            n.type = 'list';
        } else if (n.kind == 'mapping') {
            if (typeof n.result.length !== 'undefined') {
                console.log("WARN: mismatch expected map but had length", n);
            }
            n.type = 'map';
        } else {
            if (n.kind != 'scalar') {
                console.log("WARN: mismatch expected scalar/primitive", n);
            }
            n.type = 'primitive';
        }
        
        if (!n.parent) {
            n.role = 'root';
            n.depth = 0;
            return [n];
        }
        var result = findContexts(n.parent, position);
        n.depth = n.parent.depth+1;
        result.push(n);
        
        if (n.parent.type == 'map') {
            var prev;            
            for (var ci in n.parent.children) {
                var c = n.parent.children[ci];
                if (c === n || c.start > position) {
                    n.role = (ci%2==0 ? 'key' : 'value');
                    n.index = (ci - (ci%2))/2;
                    if (n.role === 'value') {
                      n.key = prev;
                    }
                    return result;
                }
                prev = c;
            }
            console.log("not found",n,"in",n.parent.children);
            throw "did not find parse node in parent's children";
        }
        
        if (n.parent.type == 'list') {
            n.role = 'entry';
            for (var ci in n.children) {
                var c = n.parent.children[ci];
                if (c === n || c.start > position) {
                    n.index = c;
                    return result;
                }
            }
            console.log("not found",n,"in",n.parent.children);
            throw "did not find parse node in parent's children";
        }
        
        n.role = 'primitive';
        return result;
    }
    
    function findContainingParseNode(n, predicate) {
        if (typeof n === 'undefined') return null;
        if (predicate(n)) return n;
        return findContainingParseNode(n.parent, predicate);
    }
    
    function findContainingMapParseNode(n) {
        return findContainingParseNode(n, function() { return n.type === 'map'; });
    }
    
    function indentation(n) {
      var i = n.start;
      while (i>0 && n.doc.charAt(i-1)!='\n') i--;
      return n.start - i;
    }

    function spaces(n) {
      var result = '';
      while (n>0) { result+=' '; n--; }
      return result;
    }
        
    var CatalogProposer = {
        getRootProposals: function() {
          return [
              { displayText: "brooklyn.catalog:", text: "brooklyn.catalog:\n  items:\n  - " }
            ];
        },
        getProposals: function(nn, position, cmPosition) {
            var n = nn[nn.length-1];
            var result = [];
            
            var itemsKey;
            if (n.type=='list' && n.key.result=='items') itemsKey = n.key;
            else if (n.type='entry' && nn.length>2 && nn[nn.length-2].type=='list' && nn[nn.length-2].key.result=='items') itemsKey = nn[nn.length-2].key;
            if (itemsKey) {            
                result = result.concat(_.map(["id","name","itemType"],
                    function(s) { return { displayText: s, text: spaces(indentation(itemsKey)+2)+s+': ' } }));
                result.push({displayText: "item", text: spaces(indentation(itemsKey)+2)+"item"+':\n'+spaces(indentation(n)+2) });
                result = result.concat(_.map(["description","iconUrl"],
                    function(s) { return { displayText: s, text: spaces(indentation(itemsKey)+2)+s+': ' } }));
                result.push({displayText: "items", text: spaces(indentation(itemsKey)+2)+"items"+':\n'+spaces(indentation(n))+"- " });
            }

            if (n.key && n.key.result=='itemType') {
              result.concat(['template','entity','location','policy']);
            }
            
            if (n.depth==1 || (n.depth>1 && cmPosition.ch==0)) {
                result.concat([{displayText: "version", text: "  version:\n"}, 
                    {displayText: "items", text: "  items:\n  - \n"} ]);
            }
            
            return result;
        }
    }
    
    var AppBlueprintProposer = {
        getRootProposals: function() {
          return [
              { displayText: "name:", text: "name: " },
              { displayText: "location:", text: "location:\n  " },
              { displayText: "services:", text: "services:\n- type: " }
            ];
        },
        
        getServiceTypes: function(n) {
            var result = [];
            catalogE.fetch();
            catalogA.fetch();
            result = result.concat(_.map(catalogE.models, function(m) { return m.get('symbolicName'); })); 
            result = result.concat(_.map(catalogA.models, function(m) { return m.get('symbolicName'); }));
            return result; 
        },
        getServiceKeys: function(type) {
            t = catalogA.get(type) || catalogE.get(type) ||
                // look for type without ID
                _.find(catalogA.models, function(m) { return m.get('symbolicName') == type; }) || 
                _.find(catalogE.models, function(m) { return m.get('symbolicName') == type; }); 
            if (!t) return [];
            return _.map(t.get('config'), function(c) { return c.name; });
        },
        getServiceKeyProposals: function(type, key) {
            t = catalogA.get(type) || catalogE.get(type) ||
                // look for type without ID
                _.find(catalogA.models, function(m) { return m.get('symbolicName') == type; }) || 
                _.find(catalogE.models, function(m) { return m.get('symbolicName') == type; }); 
            if (!t) return [];
            var c = _.find(t.get('config'), function(c) { return c.name == key; });
            if (!c) return [];
            var ct = c.type;
            if (ct.startsWith("java.lang.") || ct.startsWith("java.util.")) ct = ct.substring(10);
            var result = [ { displayText: ct+": "+c.description, text: '', className: 'summary' } ]; 
            if (c.possibleValues) {
                _.each(c.possibleValues, function(v) { result.push(v.value); });
            }
            return result;
        },
    
        getLocationTypes: function() {
            catalogL.fetch();
            return _.map(catalogL.models, function(m) { return m.get('name'); });
        },    
        
        // TODO would be much nicer to define a yaml schema; see e.g. json-schema.org
        // and various JS implementations
        getProposals: function(nn, position, cmPosition) {
            var n = nn[nn.length-1];
            var result = [];
//            console.log("context at position "+position, nn);
            while (n.role === 'primitive') n = n.parent;
            if (nn[1].key && nn[1].key.result === 'services') {
                // in services block
                var canAddService = true;
                
                if (n.depth == 3 && n.role == 'value' && n.parent.role == 'entry') {
                    // in a block for a particular service
                    canAddService = false;
                    if (n.key.result === 'type') {
                        result = result.concat(_.map(this.getServiceTypes(n.parent), function(t) { return t+'\n'; }));
                    } else if (n.key.result === 'location') {
                        result = result.concat(_.map(this.getLocationTypes(n.parent), function(t) { 
                            return t+'\n'; }));
                    
                    } else {
                        // no assistance for values of other keys atm; show summary if available
                        var type = nn[2].result['type'];
                        result = result.concat(
                            this.getServiceKeyProposals(type, n.key.result) ||
                                [{ displayText: 'No assistance available for key', 
                                   className: 'summary', text: '' }]);
                    }
                }
                
                if (n.depth >= 2 && n.role == 'entry' && nn[2].result['type']) {
                    var type = nn[2].result['type'];
                    result = result.concat(
                        _.map(this.getServiceKeys(type), function(keyname) {
                            return { displayText: keyname, text: spaces(indentation(nn[2]))+keyname+": " };
                        }));
                }
                
                if (n.depth > 2) {
                    // deep in a service, no special assistance currently offered
                }
                
                if (canAddService && (position == nn[1].end || position == nn[1].end+1)) {
                    result.push( { displayText: 'Add a service', className: 'summary', text: '\n- type: ' } );
                }
            }
            if (nn[1].key && nn[1].key.result === 'location') {
                if (n.depth <= 2) {
                    result = result.concat(_.map(this.getLocationTypes(n.parent), function(t) { 
                            return t+'\n'; }));
                }
            }
            // TODO other blocks
            return result;
        }
    }

    // cmPosition is {line: N, ch: N} format
    BrooklynYamlCompletionProposals.getCompletionProposals = function(mode, cm) {
        var proposer = mode === 'catalog' ? CatalogProposer : AppBlueprintProposer;
        var text = cm.getValue();
        var cmPosition = cm.getCursor();
        // absolute position in doc
        var position = cm.getRange({line: 0, ch: 0}, cmPosition).length;
         
        var parse;
        try {
            parse = JsYamlParser.parse(text);
            if (typeof parse.result == 'string') {
                throw "primitive not supported, parse as empty and let completion apply";
            }
        } catch (e) {
            // parse failed -- parse to beginning of line
            try {
                parse = JsYamlParser.parse(text.substring(0, text.length - cmPosition.ch)+spaces(cmPosition.ch));
            } catch (e) {
                console.log('parse failed', e);
                return [];
            }
        }
        try {
            var result;
            if (typeof parse === 'undefined') {
                // editor empty -- return defaults
                result = proposer.getRootProposals();
            } else {
                n = findParseNodeAt(parse, position);
                if (!n) {
                  // shouldn't happen... fall back to returning empty
                  console.log("no parse node containing curpos");
                  result = proposer.getRootProposals();
                } else {
                    var nn = findContexts(n, position);
                    
                    if (n.role === 'root') {
                      result = proposer.getRootProposals();
                    } else {
                      result = proposer.getProposals(nn, position, cmPosition);
                    }
                }
            }
            var wordSoFar = '';
            var lineSoFar = '';
            var i=0;
            while (position > wordSoFar.length) {
                var c = text.charAt(position-wordSoFar.length-1);
                if (c=='\n' || c==' ' || c=='\t') break;
                wordSoFar = '' + c + wordSoFar;
            }
            while (position > lineSoFar.length) {
                var c = text.charAt(position-lineSoFar.length-1);
                if (c=='\n') break;
                lineSoFar = '' + c + lineSoFar;
            }
            result = _.compact(_.map(result, function(proposal) {
                var proposalObj;
                if (typeof proposal === 'object') {
                    proposalObj = proposal;
                    proposal = proposalObj.text;
                }  else {
                    proposalObj = { text: proposal, displayText: proposal };
                }
                if (proposal[0]==' ') {
                  // proposal should start with 'lineSoFar'
                  if (proposal.lastIndexOf(lineSoFar, 0)!=0) {
                    // also match '  - ' in lieu of '    ',
                    // needed for catalog (for service we always add the 'type' in the previous expansion)
                    var proposalIfListStart = proposal.replace(/( *)  /,'$1- ');
                    if (proposalIfListStart.lastIndexOf(lineSoFar, 0)!=0) {
                      return null;
                    }
                    proposalObj.text = proposalIfListStart;
                  }
                  proposalObj.to = cmPosition;
                  proposalObj.from = { line: cmPosition.line, ch: 0 };
                } else {
                  // proposal should start with 'wordSoFar'
                  if (proposal.lastIndexOf(wordSoFar, 0)!=0) return null;
                  proposalObj.to = cmPosition;
                  proposalObj.from = { line: cmPosition.line, ch: cmPosition.ch - wordSoFar.length };
                }
                return proposalObj;
            }));
//            console.log("proposals:", result);
            return result;
            
        } catch (e) {
            console.log('completion failed', e, e.stack);
            return [];
        }
    }
    
    return BrooklynYamlCompletionProposals;

});