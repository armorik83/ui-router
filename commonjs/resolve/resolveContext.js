"use strict";
/** @module resolve */ /** for typedoc */
var common_1 = require("../common/common");
var hof_1 = require("../common/hof");
var predicates_1 = require("../common/predicates");
var trace_1 = require("../common/trace");
var coreservices_1 = require("../common/coreservices");
var interface_1 = require("./interface");
var common_2 = require("../common/common");
var pathFactory_1 = require("../path/pathFactory");
// TODO: make this configurable
var defaultResolvePolicy = interface_1.ResolvePolicy[interface_1.ResolvePolicy.LAZY];
var ResolveContext = (function () {
    function ResolveContext(_path) {
        this._path = _path;
        common_1.extend(this, {
            _nodeFor: function (state) {
                return common_1.find(this._path, hof_1.propEq('state', state));
            },
            _pathTo: function (state) {
                return pathFactory_1.PathFactory.subPath(this._path, state);
            }
        });
    }
    /**
     * Gets the available Resolvables for the last element of this path.
     *
     * @param state the State (within the ResolveContext's Path) for which to get resolvables
     * @param options
     *
     * options.omitOwnLocals: array of property names
     *   Omits those Resolvables which are found on the last element of the path.
     *
     *   This will hide a deepest-level resolvable (by name), potentially exposing a parent resolvable of
     *   the same name further up the state tree.
     *
     *   This is used by Resolvable.resolve() in order to provide the Resolvable access to all the other
     *   Resolvables at its own PathElement level, yet disallow that Resolvable access to its own injectable Resolvable.
     *
     *   This is also used to allow a state to override a parent state's resolve while also injecting
     *   that parent state's resolve:
     *
     *   state({ name: 'G', resolve: { _G: function() { return "G"; } } });
     *   state({ name: 'G.G2', resolve: { _G: function(_G) { return _G + "G2"; } } });
     *   where injecting _G into a controller will yield "GG2"
     */
    ResolveContext.prototype.getResolvables = function (state, options) {
        options = common_1.defaults(options, { omitOwnLocals: [] });
        var path = (state ? this._pathTo(state) : this._path);
        var last = common_1.tail(path);
        return path.reduce(function (memo, node) {
            var omitProps = (node === last) ? options.omitOwnLocals : [];
            var filteredResolvables = common_1.omit(node.resolves, omitProps);
            return common_1.extend(memo, filteredResolvables);
        }, {});
    };
    /** Inspects a function `fn` for its dependencies.  Returns an object containing any matching Resolvables */
    ResolveContext.prototype.getResolvablesForFn = function (fn) {
        var deps = coreservices_1.services.$injector.annotate(fn, coreservices_1.services.$injector.strictDi);
        return common_1.pick(this.getResolvables(), deps);
    };
    ResolveContext.prototype.isolateRootTo = function (state) {
        return new ResolveContext(this._pathTo(state));
    };
    ResolveContext.prototype.addResolvables = function (resolvables, state) {
        common_1.extend(this._nodeFor(state).resolves, resolvables);
    };
    /** Gets the resolvables declared on a particular state */
    ResolveContext.prototype.getOwnResolvables = function (state) {
        return common_1.extend({}, this._nodeFor(state).resolves);
    };
    // Returns a promise for an array of resolved path Element promises
    ResolveContext.prototype.resolvePath = function (options) {
        var _this = this;
        if (options === void 0) { options = {}; }
        trace_1.trace.traceResolvePath(this._path, options);
        var promiseForNode = function (node) { return _this.resolvePathElement(node.state, options); };
        return coreservices_1.services.$q.all(common_1.map(this._path, promiseForNode)).then(function (all) { return all.reduce(common_2.mergeR, {}); });
    };
    // returns a promise for all the resolvables on this PathElement
    // options.resolvePolicy: only return promises for those Resolvables which are at 
    // the specified policy, or above.  i.e., options.resolvePolicy === 'lazy' will
    // resolve both 'lazy' and 'eager' resolves.
    ResolveContext.prototype.resolvePathElement = function (state, options) {
        var _this = this;
        if (options === void 0) { options = {}; }
        // The caller can request the path be resolved for a given policy and "below" 
        var policy = options && options.resolvePolicy;
        var policyOrdinal = interface_1.ResolvePolicy[policy || defaultResolvePolicy];
        // Get path Resolvables available to this element
        var resolvables = this.getOwnResolvables(state);
        var matchesRequestedPolicy = function (resolvable) { return getPolicy(state.resolvePolicy, resolvable) >= policyOrdinal; };
        var matchingResolves = common_1.filter(resolvables, matchesRequestedPolicy);
        var getResolvePromise = function (resolvable) { return resolvable.get(_this.isolateRootTo(state), options); };
        var resolvablePromises = common_1.map(matchingResolves, getResolvePromise);
        trace_1.trace.traceResolvePathElement(this, matchingResolves, options);
        return coreservices_1.services.$q.all(resolvablePromises);
    };
    /**
     * Injects a function given the Resolvables available in the path, from the first node
     * up to the node for the given state.
     *
     * First it resolves all the resolvable depencies.  When they are done resolving, it invokes
     * the function.
     *
     * @return a promise for the return value of the function.
     *
     * @param fn: the function to inject (i.e., onEnter, onExit, controller)
     * @param locals: are the angular $injector-style locals to inject
     * @param options: options (TODO: document)
     */
    ResolveContext.prototype.invokeLater = function (fn, locals, options) {
        var _this = this;
        if (locals === void 0) { locals = {}; }
        if (options === void 0) { options = {}; }
        var resolvables = this.getResolvablesForFn(fn);
        trace_1.trace.tracePathElementInvoke(common_1.tail(this._path), fn, Object.keys(resolvables), common_1.extend({ when: "Later" }, options));
        var getPromise = function (resolvable) { return resolvable.get(_this, options); };
        var promises = common_1.map(resolvables, getPromise);
        return coreservices_1.services.$q.all(promises).then(function () {
            try {
                return _this.invokeNow(fn, locals, options);
            }
            catch (error) {
                return coreservices_1.services.$q.reject(error);
            }
        });
    };
    /**
     * Immediately injects a function with the dependent Resolvables available in the path, from
     * the first node up to the node for the given state.
     *
     * If a Resolvable is not yet resolved, then null is injected in place of the resolvable.
     *
     * @return the return value of the function.
     *
     * @param fn: the function to inject (i.e., onEnter, onExit, controller)
     * @param locals: are the angular $injector-style locals to inject
     * @param options: options (TODO: document)
     */
    // Injects a function at this PathElement level with available Resolvables
    // Does not wait until all Resolvables have been resolved; you must call PathElement.resolve() (or manually resolve each dep) first
    ResolveContext.prototype.invokeNow = function (fn, locals, options) {
        if (options === void 0) { options = {}; }
        var resolvables = this.getResolvablesForFn(fn);
        trace_1.trace.tracePathElementInvoke(common_1.tail(this._path), fn, Object.keys(resolvables), common_1.extend({ when: "Now  " }, options));
        var resolvedLocals = common_1.map(resolvables, hof_1.prop("data"));
        return coreservices_1.services.$injector.invoke(fn, options.bind || null, common_1.extend({}, locals, resolvedLocals));
    };
    return ResolveContext;
}());
exports.ResolveContext = ResolveContext;
/**
 * Given a state's resolvePolicy attribute and a resolvable from that state, returns the policy ordinal for the Resolvable
 * Use the policy declared for the Resolve. If undefined, use the policy declared for the State.  If
 * undefined, use the system defaultResolvePolicy.
 *
 * @param stateResolvePolicyConf The raw resolvePolicy declaration on the state object; may be a String or Object
 * @param resolvable The resolvable to compute the policy for
 */
function getPolicy(stateResolvePolicyConf, resolvable) {
    // Normalize the configuration on the state to either state-level (a string) or resolve-level (a Map of string:string)
    var stateLevelPolicy = (predicates_1.isString(stateResolvePolicyConf) ? stateResolvePolicyConf : null);
    var resolveLevelPolicies = (predicates_1.isObject(stateResolvePolicyConf) ? stateResolvePolicyConf : {});
    var policyName = resolveLevelPolicies[resolvable.name] || stateLevelPolicy || defaultResolvePolicy;
    return interface_1.ResolvePolicy[policyName];
}
//# sourceMappingURL=resolveContext.js.map